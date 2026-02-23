import { readGlobalState, readSessionsState } from "@/lib/storage";
import type { BackupProvider } from "./BackupProvider";
import { pruneManifest } from "./retention";
import { computeChecksum, serializeSnapshot } from "./snapshotSerializer";
import type { BackupConfig, BackupManifest, BackupReason, SnapshotEntry } from "./types";
import { APP_VERSION, EMPTY_MANIFEST, SCHEMA_VERSION } from "./types";

const DEBOUNCE_MS = 30_000;
const HARD_INTERVAL_MS = 3 * 60_000;
const REMINDER_INTERVAL_MS = 20 * 60_000;
const DIRTY_REMINDER_THRESHOLD_MS = 20 * 60_000;

interface MinimalStoreState {
  segments: unknown[];
  sessionKey: string;
  sessionLabel: string | null;
  backupConfig: BackupConfig;
  setBackupConfig: (patch: Partial<BackupConfig>) => void;
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
  private dirtySessions = new Map<string, { dirtyAt: number; lastBackedUpState: string }>();
  private globalDirty = false;
  private lastBackedUpGlobalKey: string | null = null;
  private debounceTimer: ReturnType<typeof setTimeout> | null = null;
  private hardIntervalTimer: ReturnType<typeof setInterval> | null = null;
  private reminderTimer: ReturnType<typeof setInterval> | null = null;
  private criticalEventHandler: ((e: Event) => void) | null = null;
  private unsubscribeStore: (() => void) | null = null;
  private store: MinimalStore | null = null;

  constructor(provider: BackupProvider) {
    this.provider = provider;
  }

  start(store: MinimalStore): void {
    this.store = store;

    // Subscribe to store changes
    this.unsubscribeStore = store.subscribe(() => {
      this.onStateChange(store.getState());
    });

    // Hard interval: backup every 3 minutes regardless
    this.hardIntervalTimer = setInterval(() => {
      const state = store.getState();
      if (state.backupConfig.enabled && this.hasDirty()) {
        void this.backupBatch("scheduled");
      }
    }, HARD_INTERVAL_MS);

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
    if (this.debounceTimer) clearTimeout(this.debounceTimer);
    if (this.hardIntervalTimer) clearInterval(this.hardIntervalTimer);
    if (this.reminderTimer) clearInterval(this.reminderTimer);
    if (this.criticalEventHandler) {
      window.removeEventListener("flowscribe:backup-critical", this.criticalEventHandler);
    }
    if (this.unsubscribeStore) this.unsubscribeStore();
    this.debounceTimer = null;
    this.hardIntervalTimer = null;
    this.reminderTimer = null;
    this.criticalEventHandler = null;
    this.unsubscribeStore = null;
  }

  private onStateChange(state: MinimalStoreState): void {
    if (!state.backupConfig.enabled) return;

    const sessionKey = state.sessionKey;
    // Cheap dirty key: segments length + sessionKey
    const dirtyKey = `${sessionKey}:${state.segments.length}`;
    const existing = this.dirtySessions.get(sessionKey);

    if (!existing || existing.lastBackedUpState !== dirtyKey) {
      this.dirtySessions.set(sessionKey, {
        dirtyAt: existing?.dirtyAt ?? Date.now(),
        lastBackedUpState: dirtyKey,
      });
    }

    // Mark global state as potentially dirty on any store change
    this.globalDirty = true;

    this.scheduleBatch();
  }

  private hasDirty(): boolean {
    return this.dirtySessions.size > 0 || this.globalDirty;
  }

  private scheduleBatch(): void {
    if (this.debounceTimer) clearTimeout(this.debounceTimer);
    this.debounceTimer = setTimeout(() => {
      this.debounceTimer = null;
      void this.backupBatch("scheduled");
    }, DEBOUNCE_MS);
  }

  async backupNow(reason: BackupReason): Promise<void> {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }
    await this.backupBatch(reason);
  }

  private async backupBatch(reason: BackupReason = "scheduled"): Promise<void> {
    if (!this.store) return;
    const state = this.store.getState();
    if (!state.backupConfig.enabled) return;

    try {
      const accessible = await this.provider.verifyAccess();
      if (!accessible) {
        state.setBackupConfig({ status: "paused", lastError: "Backup folder not accessible" });
        return;
      }

      // Read current manifest
      const manifest: BackupManifest = (await this.provider.readManifest()) ?? {
        ...EMPTY_MANIFEST,
      };

      const sessionsState = readSessionsState();

      // Backup dirty sessions
      for (const [sessionKey] of this.dirtySessions) {
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
      this.dirtySessions.clear();

      // Backup global state if needed
      if (this.globalDirty && state.backupConfig.includeGlobalState) {
        const globalState = readGlobalState();
        if (globalState) {
          const globalKey = JSON.stringify(Object.keys(globalState).sort());
          if (globalKey !== this.lastBackedUpGlobalKey) {
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
            this.lastBackedUpGlobalKey = globalKey;
          }
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

      state.setBackupConfig({
        lastBackupAt: Date.now(),
        lastError: null,
        status: "enabled",
      });
    } catch (e) {
      const errorMsg = e instanceof Error ? e.message : String(e);
      state.setBackupConfig({ status: "error", lastError: errorMsg });
    }
  }

  private maybeShowReminder(): void {
    if (!this.store) return;
    const state = this.store.getState();
    if (!state.backupConfig.enabled) return;
    if (state.backupConfig.disableDirtyReminders) return;
    if (this.dirtySessions.size === 0) return;

    // Check if any session has been dirty for more than 20 minutes
    const now = Date.now();
    const hasLongDirty = Array.from(this.dirtySessions.values()).some(
      ({ dirtyAt }) => now - dirtyAt > DIRTY_REMINDER_THRESHOLD_MS,
    );

    if (!hasLongDirty) return;

    // Only remind for download provider or paused status
    if (!this.provider.isSupported() || state.backupConfig.status === "paused") {
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
