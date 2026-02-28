import { render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { BackupProvider } from "@/lib/backup/BackupProvider";
import type { BackupManifest } from "@/lib/backup/types";
import { SnapshotBrowser } from "../SnapshotBrowser";

const manifest: BackupManifest = {
  manifestVersion: 1,
  snapshots: [
    {
      filename: "sessions/abc/1_manual.json.gz",
      sessionKeyHash: "abc",
      sessionLabel: "Interview A",
      createdAt: 1,
      reason: "manual",
      appVersion: "1.0.0",
      schemaVersion: 1,
      compressedSize: 100,
      checksum: "x",
    },
  ],
  globalSnapshots: [
    {
      filename: "sessions/global/2_manual.json.gz",
      sessionKeyHash: "global",
      sessionLabel: null,
      createdAt: 2,
      reason: "manual",
      appVersion: "1.0.0",
      schemaVersion: 1,
      compressedSize: 100,
      checksum: "y",
    },
  ],
};

const provider: BackupProvider = {
  isSupported: () => true,
  enable: async () => ({ ok: true, locationLabel: "folder" }),
  verifyAccess: async () => true,
  writeSnapshot: async () => undefined,
  writeManifest: async () => undefined,
  readManifest: async () => manifest,
  readSnapshot: async () => new Uint8Array([1]),
  deleteSnapshots: async () => undefined,
};

describe("SnapshotBrowser", () => {
  it("shows global snapshots as a dedicated session", async () => {
    render(
      <SnapshotBrowser
        open
        onClose={() => undefined}
        providerType="filesystem"
        externalProvider={provider}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText("backup.snapshots.title")).toBeInTheDocument();
    });

    expect(screen.getByText("2 backup.snapshots.sessions")).toBeInTheDocument();
  });
});
