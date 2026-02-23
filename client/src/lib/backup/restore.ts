import { writeGlobalState, writeSessionsSync } from "@/lib/storage";
import type { PersistedSessionsState } from "@/lib/store/types";
import type { BackupProvider } from "./BackupProvider";
import { deserializeSnapshot } from "./snapshotSerializer";
import type { SnapshotEntry } from "./types";

export interface RestoreCandidate {
  entry: SnapshotEntry;
  sessionLabel: string | null;
  minutesAgo: number;
}

const RESTORE_CHECKED_KEY = "flowscribe:restore-checked";

/**
 * Check if there is a recent backup snapshot to offer for restore.
 *
 * Returns null if:
 * - Provider is not accessible
 * - Local storage already has sessions with segments (no data loss)
 * - No snapshots in manifest
 * - Already checked this browser session
 */
export async function checkForRestoreCandidate(
  provider: BackupProvider,
  currentSessionsState: PersistedSessionsState,
): Promise<RestoreCandidate | null> {
  // Only check once per browser session
  try {
    if (sessionStorage.getItem(RESTORE_CHECKED_KEY)) return null;
  } catch (_e) {
    // ignore
  }

  // If local data exists (any session has segments), no restore needed
  const hasLocalData = Object.values(currentSessionsState.sessions).some(
    (s) => s.segments.length > 0,
  );
  if (hasLocalData) return null;

  // Check backup accessibility
  try {
    const accessible = await provider.verifyAccess();
    if (!accessible) return null;
  } catch (_e) {
    return null;
  }

  // Read manifest
  let manifest = null;
  try {
    manifest = await provider.readManifest();
  } catch (_e) {
    return null;
  }
  if (!manifest || manifest.snapshots.length === 0) return null;

  // Get latest session snapshot
  const sorted = manifest.snapshots.slice().sort((a, b) => b.createdAt - a.createdAt);
  const latest = sorted[0];

  const minutesAgo = Math.floor((Date.now() - latest.createdAt) / 60_000);

  return {
    entry: latest,
    sessionLabel: latest.sessionLabel,
    minutesAgo,
  };
}

/**
 * Restore a snapshot from the backup provider into localStorage.
 * Returns ok=true on success, ok=false with error message on failure.
 */
export async function restoreSnapshot(
  provider: BackupProvider,
  entry: SnapshotEntry,
): Promise<{ ok: true } | { ok: false; error: string; nextEntry?: SnapshotEntry }> {
  let data: Uint8Array | null = null;
  try {
    data = await provider.readSnapshot(entry.filename);
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }

  if (!data) {
    return { ok: false, error: "Snapshot file not found" };
  }

  let snapshot = null;
  try {
    snapshot = await deserializeSnapshot(data);
  } catch (e) {
    // Checksum failed — try to find next snapshot
    let nextEntry: SnapshotEntry | undefined;
    try {
      const manifest = await provider.readManifest();
      if (manifest) {
        const sorted = manifest.snapshots
          .filter((s) => s.filename !== entry.filename)
          .sort((a, b) => b.createdAt - a.createdAt);
        nextEntry = sorted[0];
      }
    } catch (_e) {
      // ignore
    }
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Checksum verification failed",
      nextEntry,
    };
  }

  // Write session data to localStorage
  const newSessionsState: PersistedSessionsState = {
    sessions: { [snapshot.sessionKey]: snapshot.session },
    activeSessionKey: snapshot.sessionKey,
  };
  writeSessionsSync(newSessionsState);

  if (snapshot.globalState) {
    writeGlobalState(snapshot.globalState);
  }

  // Mark restore as checked for this session
  try {
    sessionStorage.setItem(RESTORE_CHECKED_KEY, "1");
  } catch (_e) {
    // ignore
  }

  return { ok: true };
}

/**
 * Mark the restore check as done for this browser session (dismiss banner).
 */
export function dismissRestoreCheck(): void {
  try {
    sessionStorage.setItem(RESTORE_CHECKED_KEY, "1");
  } catch (_e) {
    // ignore
  }
}
