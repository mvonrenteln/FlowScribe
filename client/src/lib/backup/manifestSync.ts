import type { BackupProvider } from "./BackupProvider";
import type { BackupManifest, SnapshotEntry } from "./types";

interface ManifestReconcileResult {
  manifest: BackupManifest;
  changed: boolean;
}

const keepExistingSnapshots = async (
  provider: BackupProvider,
  entries: SnapshotEntry[],
): Promise<SnapshotEntry[]> => {
  const existing = await Promise.all(
    entries.map(async (entry) => {
      const data = await provider.readSnapshot(entry.filename);
      return data ? entry : null;
    }),
  );
  return existing.filter((entry): entry is SnapshotEntry => entry !== null);
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
