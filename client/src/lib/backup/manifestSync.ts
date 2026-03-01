import type { BackupProvider } from "./BackupProvider";
import type { BackupManifest, SnapshotEntry } from "./types";

interface ManifestReconcileResult {
  manifest: BackupManifest;
  changed: boolean;
}

const MAX_CONCURRENT_EXISTENCE_CHECKS = 8;

const snapshotExists = async (provider: BackupProvider, filename: string): Promise<boolean> => {
  if (typeof provider.hasSnapshot === "function") {
    return provider.hasSnapshot(filename);
  }
  const data = await provider.readSnapshot(filename);
  return data !== null;
};

const keepExistingSnapshots = async (
  provider: BackupProvider,
  entries: SnapshotEntry[],
): Promise<SnapshotEntry[]> => {
  const existing: SnapshotEntry[] = [];
  for (let index = 0; index < entries.length; index += MAX_CONCURRENT_EXISTENCE_CHECKS) {
    const chunk = entries.slice(index, index + MAX_CONCURRENT_EXISTENCE_CHECKS);
    const chunkMatches = await Promise.all(
      chunk.map(async (entry) => {
        const exists = await snapshotExists(provider, entry.filename);
        return exists ? entry : null;
      }),
    );
    existing.push(...chunkMatches.filter((entry): entry is SnapshotEntry => entry !== null));
  }
  return existing;
};

export async function reconcileManifestWithDisk(
  provider: BackupProvider,
  manifest: BackupManifest,
): Promise<ManifestReconcileResult> {
  const [snapshots, globalSnapshots] = await Promise.all([
    keepExistingSnapshots(provider, manifest.snapshots),
    keepExistingSnapshots(provider, manifest.globalSnapshots),
  ]);

  const changed =
    snapshots.length !== manifest.snapshots.length ||
    globalSnapshots.length !== manifest.globalSnapshots.length;

  return {
    manifest: {
      ...manifest,
      snapshots,
      globalSnapshots,
    },
    changed,
  };
}
