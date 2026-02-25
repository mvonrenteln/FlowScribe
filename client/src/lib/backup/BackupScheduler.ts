import { readGlobalState, readSessionsState } from "@/lib/storage";
import type { BackupProvider } from "./BackupProvider";
import { pruneManifest } from "./retention";
import { computeChecksum, serializeSnapshot } from "./snapshotSerializer";
import type {
  BackupConfig,
  BackupManifest,
  BackupReason,
  BackupState,
  SnapshotEntry,
} from "./types";
import { APP_VERSION, EMPTY_MANIFEST, SCHEMA_VERSION } from "./types";

/**
 * Grace period after the last content change. When the hard interval fires,
 * a backup is deferred by up to DEBOUNCE_MS to avoid writing a snapshot
 * mid-edit. The interval itself is the primary driver — not this timer.
 */
const DEBOUNCE_MS = 30_000;
/**
 * Maximum total deferral after the interval fires. If the user edits
 * continuously, the backup happens at most MAX_DEFER_MS later anyway.
 */
const MAX_DEFER_MS = 5 * 60_000;
const REMINDER_INTERVAL_MS = 20 * 60_000;
const DIRTY_REMINDER_THRESHOLD_MS = 20 * 60_000;

interface MinimalStoreState {
  segments: unknown[];
  speakers: unknown[];
  tags: unknown[];
  chapters: unknown[];
  sessionKey: string;
  sessionLabel: string | null;
  /**
   * A stable fingerprint of the persisted global state fields (e.g. lexicon,
   * spellcheck, AI configs, backupConfig). Changes whenever a user-facing global
   * setting changes. Must NOT change on session-only edits, playback, UI state, etc.
   * Computed by `store.ts` and exposed on the store for the scheduler.
   */
  globalStateFingerprint: string;
  backupConfig: BackupConfig;
  backupState: BackupState;
  setBackupConfig: (patch: Partial<BackupConfig>) => void;
  setBackupState: (patch: Partial<BackupState>) => void;
}

interface MinimalStore {
  getState: () => MinimalStoreState;
  subscribe: (listener: () => void) => () => void;
}

/**
 * Computes a short filesystem-safe hash of a session key.
 */
async function hashSessionKey(sessionKey: string): Promise<string> {
  const checksum = await computeChecksum(sessionKey);
  return checksum.slice(0, 12);
}

function buildSnapshotFilename(
  sessionKeyHash: string,
  reason: BackupReason,
  isGlobal = false,
): string {
  const ts = Date.now();
  const safeReason = reason.replace(/[^a-z0-9]/g, "-");
  if (isGlobal) {
    return `global/${ts}_${safeReason}.json.gz`;
  }
  return `sessions/${sessionKeyHash}/${ts}_${safeReason}.json.gz`;
}

interface DownloadProviderLike {
  triggerDownload: () => void;
  hasPendingDownload: () => boolean;
}

function isDownloadProvider(p: BackupProvider): p is BackupProvider & DownloadProviderLike {
  return typeof (p as unknown as DownloadProviderLike).triggerDownload === "function";
}

/**
 * Manages automatic backup scheduling.
 *
 * Subscribes to store changes, detects dirty sessions, and writes
 * compressed snapshots to the configured backup provider.
 */
export class BackupScheduler {
  private provider: BackupProvider;
  private dirtySessions = new Map<
    string,
    {
      isDirty: boolean;
      dirtyAt: number;
      /** Reference-snapshot of the session content at the time of the last backup (or at start). */
      lastBackedUpSegments: unknown[];
      lastBackedUpSpeakers: unknown[];
      lastBackedUpTags: unknown[];
      lastBackedUpChapters: unknown[];
    }
  >();
  private globalDirty = false;
  /** The globalStateFingerprint value at the time of the last successful global backup. */
  private lastBackedUpGlobalFingerprint: string | null = null;
  /** The last fingerprint seen from the store, used to detect real global-state changes. */
  private lastSeenGlobalFingerprint: string | null = null;
  /** Timestamp of the last real content change (segment count change). */
  private lastContentChangeAt = 0;
  /** Timer for the grace-period deferral after the interval fires. */
  private deferTimer: ReturnType<typeof setTimeout> | null = null;
  /** When the interval first fired for the current dirty cycle (for MAX_DEFER_MS cap). */
  private intervalFiredAt = 0;
  private hardIntervalTimer: ReturnType<typeof setInterval> | null = null;
  private reminderTimer: ReturnType<typeof setInterval> | null = null;
  /** Tracks the currently active hard-interval duration so we can detect config changes. */
  private currentIntervalMs = 20 * 60_000;
  private criticalEventHandler: ((e: Event) => void) | null = null;
  private unsubscribeStore: (() => void) | null = null;
  private store: MinimalStore | null = null;
  /** Guards against re-entrant onStateChange calls triggered by setBackupState within the handler. */
  private isHandlingStateChange = false;

  constructor(provider: BackupProvider) {
    this.provider = provider;
  }

  start(store: MinimalStore): void {
    this.store = store;

    // Seed the dirty-tracking baseline so that the very first store notification
    // with unchanged content does not spuriously schedule a backup.
    const seed = store.getState();
    if (seed.sessionKey) {
      this.dirtySessions.set(seed.sessionKey, {
        isDirty: false,
        dirtyAt: Date.now(),
        lastBackedUpSegments: seed.segments,
        lastBackedUpSpeakers: seed.speakers,
        lastBackedUpTags: seed.tags,
        lastBackedUpChapters: seed.chapters,
      });
    }
    // Seed the global-state fingerprint baseline so that the initial store
    // notification (with an unchanged global state) does not spuriously set globalDirty.
    this.lastSeenGlobalFingerprint = seed.globalStateFingerprint;

    // Subscribe to store changes
    this.unsubscribeStore = store.subscribe(() => {
      this.onStateChange(store.getState());
    });

    // Hard interval: the primary backup trigger, fires every backupIntervalMinutes.
    const initialIntervalMs = store.getState().backupConfig.backupIntervalMinutes * 60_000;
    this.currentIntervalMs = initialIntervalMs;
    this.hardIntervalTimer = setInterval(() => {
      const state = store.getState();
      if (state.backupConfig.enabled && this.hasDirty()) {
        if (this.intervalFiredAt === 0) this.intervalFiredAt = Date.now();
        this.attemptScheduledBackup();
      }
    }, initialIntervalMs);

    // Reminder interval for download provider / paused state
    this.reminderTimer = setInterval(() => {
      this.maybeShowReminder();
    }, REMINDER_INTERVAL_MS);

    // Listen for critical backup events (e.g. manual backup or quota exceeded)
    this.criticalEventHandler = () => {
      void this.backupNow("critical");
    };
    window.addEventListener("flowscribe:backup-critical", this.criticalEventHandler);

    // Before unload: set dirty flag in sessionStorage
    window.addEventListener("beforeunload", () => {
      if (this.hasDirty()) {
        try {
          sessionStorage.setItem("flowscribe:backup-dirty", "1");
        } catch (_e) {
          // ignore
        }
      }
    });
  }

  stop(): void {
    if (this.deferTimer) clearTimeout(this.deferTimer);
    if (this.hardIntervalTimer) clearInterval(this.hardIntervalTimer);
    if (this.reminderTimer) clearInterval(this.reminderTimer);
    if (this.criticalEventHandler) {
      window.removeEventListener("flowscribe:backup-critical", this.criticalEventHandler);
    }
    if (this.unsubscribeStore) this.unsubscribeStore();
    this.deferTimer = null;
    this.hardIntervalTimer = null;
    this.reminderTimer = null;
    this.criticalEventHandler = null;
    this.unsubscribeStore = null;
  }

  private onStateChange(state: MinimalStoreState): void {
    // Guard against re-entrant calls caused by setBackupState within this handler.
    if (this.isHandlingStateChange) return;
    if (!state.backupConfig.enabled) return;

    // Restart hard interval when the user changes backupIntervalMinutes
    const configuredIntervalMs = state.backupConfig.backupIntervalMinutes * 60_000;
    if (configuredIntervalMs !== this.currentIntervalMs) {
      this.restartHardInterval(configuredIntervalMs);
    }

    const sessionKey = state.sessionKey;
    const existing = this.dirtySessions.get(sessionKey);

    // Detect real session content changes via reference equality on Zustand's immutable arrays.
    // Any mutation (segment text edit, speaker rename, tag/chapter change) produces a new
    // array reference, so this comparison catches all user-facing edits — not just count changes.
    const sessionContentChanged =
      !existing ||
      existing.lastBackedUpSegments !== state.segments ||
      existing.lastBackedUpSpeakers !== state.speakers ||
      existing.lastBackedUpTags !== state.tags ||
      existing.lastBackedUpChapters !== state.chapters;
    if (sessionContentChanged) {
      // Record when the user last made a real content change.
      // The hard interval uses this to decide whether to defer.
      this.lastContentChangeAt = Date.now();
      this.dirtySessions.set(sessionKey, {
        isDirty: true,
        dirtyAt: existing?.dirtyAt ?? Date.now(),
        lastBackedUpSegments: state.segments,
        lastBackedUpSpeakers: state.speakers,
        lastBackedUpTags: state.tags,
        lastBackedUpChapters: state.chapters,
      });
      // Suppress re-entrant call triggered by this setBackupState.
      this.isHandlingStateChange = true;
      state.setBackupState({ isDirty: true });
      this.isHandlingStateChange = false;
    }

    // Mark global state dirty only when a user-facing global setting actually changed.
    // The fingerprint is updated by store.ts exclusively when buildGlobalStatePayload
    // returns a new reference for any field (backupConfig, lexicon, spellcheck, AI configs…).
    // Session-only changes (segments, currentTime, UI state) must not set globalDirty.
    const fp = state.globalStateFingerprint;
    if (fp !== this.lastSeenGlobalFingerprint) {
      this.lastSeenGlobalFingerprint = fp;
      // Only mark dirty if the new fingerprint differs from the last backed-up one.
      if (fp !== this.lastBackedUpGlobalFingerprint) {
        this.globalDirty = true;
      }
    }
  }

  private restartHardInterval(intervalMs: number): void {
    if (this.hardIntervalTimer) clearInterval(this.hardIntervalTimer);
    this.currentIntervalMs = intervalMs;
    this.hardIntervalTimer = setInterval(() => {
      const state = this.store?.getState();
      if (state?.backupConfig.enabled && this.hasDirty()) {
        if (this.intervalFiredAt === 0) this.intervalFiredAt = Date.now();
        this.attemptScheduledBackup();
      }
    }, intervalMs);
  }

  private hasDirty(): boolean {
    const anySessionDirty = Array.from(this.dirtySessions.values()).some((s) => s.isDirty);
    return anySessionDirty || this.globalDirty;
  }

  /**
   * Called by the hard interval. Writes a scheduled backup unless the user is
   * actively editing, in which case it defers by DEBOUNCE_MS (30 s). The
   * deferral is capped at MAX_DEFER_MS (5 min) after the interval first fired.
   */
  private attemptScheduledBackup(): void {
    if (!this.hasDirty()) {
      this.intervalFiredAt = 0;
      return;
    }

    const now = Date.now();
    const msSinceEdit = now - this.lastContentChangeAt;
    const msSinceIntervalFired = now - this.intervalFiredAt;

    if (msSinceEdit < DEBOUNCE_MS && msSinceIntervalFired < MAX_DEFER_MS) {
      // User is actively editing — defer until the grace period expires.
      if (this.deferTimer) clearTimeout(this.deferTimer);
      const remaining = DEBOUNCE_MS - msSinceEdit + 100;
      this.deferTimer = setTimeout(() => {
        this.deferTimer = null;
        this.attemptScheduledBackup();
      }, remaining);
      return;
    }

    // User is idle (or MAX_DEFER_MS exceeded) — backup now.
    this.intervalFiredAt = 0;
    void this.backupBatch("scheduled");
  }

  async backupNow(reason: BackupReason): Promise<void> {
    // Cancel any pending grace-period deferral
    if (this.deferTimer) {
      clearTimeout(this.deferTimer);
      this.deferTimer = null;
    }
    this.intervalFiredAt = 0;
    await this.backupBatch(reason);
  }

  private async backupBatch(reason: BackupReason = "scheduled"): Promise<void> {
    if (!this.store) return;
    const state = this.store.getState();
    if (!state.backupConfig.enabled) return;

    state.setBackupState({ isSaving: true });

    try {
      const accessible = await this.provider.verifyAccess();
      if (!accessible) {
        state.setBackupState({ status: "paused", lastError: "Backup folder not accessible" });
        return;
      }

      // Read current manifest
      const manifest: BackupManifest = (await this.provider.readManifest()) ?? {
        ...EMPTY_MANIFEST,
      };

      const sessionsState = readSessionsState();

      // Backup dirty sessions
      for (const [sessionKey, dirtyEntry] of this.dirtySessions) {
        if (!dirtyEntry.isDirty) continue;
        const session = sessionsState.sessions[sessionKey];
        if (!session) continue;

        const sessionKeyHash = await hashSessionKey(sessionKey);
        const filename = buildSnapshotFilename(sessionKeyHash, reason);

        const snapshotData = {
          schemaVersion: SCHEMA_VERSION,
          appVersion: APP_VERSION,
          createdAt: Date.now(),
          sessionKey,
          reason,
          checksum: "",
          session,
        };

        const data = await serializeSnapshot(snapshotData);

        const entry: SnapshotEntry = {
          filename,
          sessionKeyHash,
          sessionLabel: session.label ?? null,
          createdAt: snapshotData.createdAt,
          reason,
          appVersion: APP_VERSION,
          schemaVersion: SCHEMA_VERSION,
          compressedSize: data.length,
          checksum: snapshotData.checksum,
        };

        await this.provider.writeSnapshot(entry, data);
        manifest.snapshots.push(entry);
      }
      // After backup, reset dirty tracking to the current state so the next
      // identical notification is not treated as a content change.
      this.dirtySessions.clear();
      const currentState = this.store.getState();
      if (currentState.sessionKey) {
        this.dirtySessions.set(currentState.sessionKey, {
          isDirty: false,
          dirtyAt: Date.now(),
          lastBackedUpSegments: currentState.segments,
          lastBackedUpSpeakers: currentState.speakers,
          lastBackedUpTags: currentState.tags,
          lastBackedUpChapters: currentState.chapters,
        });
      }

      // Backup global state if needed
      if (this.globalDirty && state.backupConfig.includeGlobalState) {
        const globalState = readGlobalState();
        if (globalState) {
          const filename = buildSnapshotFilename("global", reason, true);

          const snapshotData = {
            schemaVersion: SCHEMA_VERSION,
            appVersion: APP_VERSION,
            createdAt: Date.now(),
            sessionKey: "__global__",
            reason,
            checksum: "",
            session: {
              audioRef: null,
              transcriptRef: null,
              segments: [],
              speakers: [],
              tags: [],
              selectedSegmentId: null,
              currentTime: 0,
              isWhisperXFormat: false,
            },
            globalState,
          };

          const data = await serializeSnapshot(snapshotData);
          const globalEntry: SnapshotEntry = {
            filename,
            sessionKeyHash: "global",
            sessionLabel: null,
            createdAt: snapshotData.createdAt,
            reason,
            appVersion: APP_VERSION,
            schemaVersion: SCHEMA_VERSION,
            compressedSize: data.length,
            checksum: snapshotData.checksum,
          };

          await this.provider.writeSnapshot(globalEntry, data);
          manifest.globalSnapshots.push(globalEntry);
          // Record the fingerprint that was current when this backup ran so that
          // the next onStateChange can skip globalDirty if nothing changed.
          this.lastBackedUpGlobalFingerprint = this.lastSeenGlobalFingerprint;
        }
      }
      this.globalDirty = false;

      // Prune and write manifest
      const { manifest: pruned, toDelete } = pruneManifest(
        manifest,
        state.backupConfig.maxSnapshotsPerSession,
        state.backupConfig.maxGlobalSnapshots,
      );
      if (toDelete.length > 0) {
        await this.provider.deleteSnapshots(toDelete);
      }
      await this.provider.writeManifest(pruned);

      state.setBackupState({
        lastBackupAt: Date.now(),
        lastError: null,
        status: "enabled",
        isSaving: false,
        isDirty: false,
      });
    } catch (e) {
      const errorMsg = e instanceof Error ? e.message : String(e);
      state.setBackupState({ status: "error", lastError: errorMsg, isSaving: false });
    }
  }

  private maybeShowReminder(): void {
    if (!this.store) return;
    const state = this.store.getState();
    if (!state.backupConfig.enabled) return;
    if (state.backupConfig.disableDirtyReminders) return;
    const dirtySessions = Array.from(this.dirtySessions.values()).filter((s) => s.isDirty);
    if (dirtySessions.length === 0) return;

    // Check if any session has been dirty for more than 20 minutes
    const now = Date.now();
    const hasLongDirty = dirtySessions.some(
      ({ dirtyAt }) => now - dirtyAt > DIRTY_REMINDER_THRESHOLD_MS,
    );

    if (!hasLongDirty) return;

    // Only remind for download provider or paused status
    if (!this.provider.isSupported() || state.backupState.status === "paused") {
      try {
        window.dispatchEvent(
          new CustomEvent("flowscribe:backup-reminder", {
            detail: { canDisable: true },
          }),
        );
      } catch (_e) {
        // ignore
      }
    }
  }

  triggerDownload(): void {
    if (isDownloadProvider(this.provider)) {
      this.provider.triggerDownload();
    }
  }

  hasPendingDownload(): boolean {
    if (isDownloadProvider(this.provider)) {
      return this.provider.hasPendingDownload();
    }
    return false;
  }
}
