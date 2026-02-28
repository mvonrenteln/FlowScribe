import { beforeEach, describe, expect, it } from "vitest";
import { FileSystemProvider, isValidSnapshotPath } from "../providers/FileSystemProvider";
import type { SnapshotEntry } from "../types";

// ─── In-memory mock of the File System Access API ────────────────────────────

class MockFileHandle {
  readonly kind = "file" as const;
  readonly name: string;
  private data: Uint8Array = new Uint8Array(0);

  constructor(name: string) {
    this.name = name;
  }

  async getFile(): Promise<File> {
    // Return a File-like object whose arrayBuffer() works in jsdom
    const buf = this.data.slice().buffer;
    return { arrayBuffer: () => Promise.resolve(buf) } as unknown as File;
  }

  async createWritable(): Promise<FileSystemWritableFileStream> {
    const self = this;
    return {
      async write(chunk: BufferSource) {
        if (chunk instanceof ArrayBuffer) {
          self.data = new Uint8Array(chunk);
        } else {
          self.data = new Uint8Array(chunk as Uint8Array);
        }
      },
      async close() {
        /* no-op */
      },
    } as unknown as FileSystemWritableFileStream;
  }
}

class MockDirectoryHandle {
  readonly kind = "directory" as const;
  readonly name: string;
  private dirs = new Map<string, MockDirectoryHandle>();
  private files = new Map<string, MockFileHandle>();

  constructor(name: string) {
    this.name = name;
  }

  async getDirectoryHandle(
    name: string,
    options?: { create?: boolean },
  ): Promise<MockDirectoryHandle> {
    let sub = this.dirs.get(name);
    if (!sub) {
      if (!options?.create) {
        throw new DOMException(`Directory "${name}" not found`, "NotFoundError");
      }
      sub = new MockDirectoryHandle(name);
      this.dirs.set(name, sub);
    }
    return sub;
  }

  async getFileHandle(name: string, options?: { create?: boolean }): Promise<MockFileHandle> {
    let fh = this.files.get(name);
    if (!fh) {
      if (!options?.create) {
        throw new DOMException(`File "${name}" not found`, "NotFoundError");
      }
      fh = new MockFileHandle(name);
      this.files.set(name, fh);
    }
    return fh;
  }

  async removeEntry(name: string): Promise<void> {
    if (!this.files.delete(name) && !this.dirs.delete(name)) {
      throw new DOMException(`Entry "${name}" not found`, "NotFoundError");
    }
  }

  /** Test helper: check whether a file exists at a nested path like "sessions/global/foo.gz". */
  hasFile(path: string): boolean {
    const parts = path.split("/");
    if (parts.length === 1) return this.files.has(parts[0]);
    const sub = this.dirs.get(parts[0]);
    if (!sub) return false;
    return sub.hasFile(parts.slice(1).join("/"));
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const makeEntry = (overrides: Partial<SnapshotEntry> = {}): SnapshotEntry => ({
  filename: "sessions/abc123/1234_scheduled.json.gz",
  sessionKeyHash: "abc123",
  sessionLabel: "Test",
  createdAt: 1234,
  reason: "scheduled",
  appVersion: "1.0.0",
  schemaVersion: 1,
  compressedSize: 42,
  checksum: "deadbeef",
  ...overrides,
});

const TEST_DATA = new TextEncoder().encode("snapshot-payload");

/** Compare Uint8Array content (avoids vitest cross-buffer toEqual quirk). */
const expectPayload = (result: Uint8Array | null, expected: string): void => {
  expect(result).not.toBeNull();
  // biome-ignore lint/style/noNonNullAssertion: guarded by the assertion above
  expect(new TextDecoder().decode(result!)).toBe(expected);
};

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("FileSystemProvider", () => {
  let root: MockDirectoryHandle;
  let provider: FileSystemProvider;

  beforeEach(() => {
    root = new MockDirectoryHandle("backup-root");
    provider = FileSystemProvider.fromHandle(root as unknown as FileSystemDirectoryHandle);
  });

  describe("isValidSnapshotPath", () => {
    it("accepts valid snapshot paths", () => {
      expect(isValidSnapshotPath("sessions/abc123/1234567890_scheduled.json.gz")).toBe(true);
      expect(isValidSnapshotPath("sessions/global/1234567890_manual.json.gz")).toBe(true);
      expect(isValidSnapshotPath("global/1234567890_manual.json.gz")).toBe(true);
    });

    it("rejects traversal attack paths", () => {
      expect(isValidSnapshotPath("../../../etc/passwd")).toBe(false);
      expect(isValidSnapshotPath("sessions/../../../etc/passwd")).toBe(false);
      expect(isValidSnapshotPath("sessions/abc123/../../etc/passwd")).toBe(false);
    });

    it("rejects other unsafe paths", () => {
      expect(isValidSnapshotPath("/absolute/path")).toBe(false);
      expect(isValidSnapshotPath("sessions/abc 123/file.json.gz")).toBe(false);
      expect(isValidSnapshotPath("")).toBe(false);
      expect(isValidSnapshotPath("sessions/abc123\\file.json.gz")).toBe(false);
    });
  });

  // ── Session snapshots (baseline sanity) ──────────────────────────────────

  describe("session snapshots", () => {
    it("writes a session snapshot into sessions/<hash>/", async () => {
      const entry = makeEntry({
        filename: "sessions/abc123/1234_scheduled.json.gz",
        sessionKeyHash: "abc123",
      });

      await provider.writeSnapshot(entry, TEST_DATA);

      expect(root.hasFile("sessions/abc123/1234_scheduled.json.gz")).toBe(true);
    });

    it("reads a session snapshot back via sessions/<hash>/<file> path", async () => {
      const entry = makeEntry({
        filename: "sessions/abc123/1234_scheduled.json.gz",
        sessionKeyHash: "abc123",
      });
      await provider.writeSnapshot(entry, TEST_DATA);

      const result = await provider.readSnapshot("sessions/abc123/1234_scheduled.json.gz");
      expectPayload(result, "snapshot-payload");
    });

    it("deletes a session snapshot", async () => {
      const entry = makeEntry({
        filename: "sessions/abc123/1234_scheduled.json.gz",
        sessionKeyHash: "abc123",
      });
      await provider.writeSnapshot(entry, TEST_DATA);

      await provider.deleteSnapshots(["sessions/abc123/1234_scheduled.json.gz"]);

      const result = await provider.readSnapshot("sessions/abc123/1234_scheduled.json.gz");
      expect(result).toBeNull();
    });
  });

  // ── Global snapshots (the bug fix) ───────────────────────────────────────

  describe("global snapshots", () => {
    const globalEntry = makeEntry({
      filename: "sessions/global/9999_scheduled.json.gz",
      sessionKeyHash: "global",
      sessionLabel: null,
    });

    it("writes a global snapshot into sessions/global/", async () => {
      await provider.writeSnapshot(globalEntry, TEST_DATA);

      expect(root.hasFile("sessions/global/9999_scheduled.json.gz")).toBe(true);
    });

    it("reads a global snapshot via canonical sessions/global/<file> path", async () => {
      await provider.writeSnapshot(globalEntry, TEST_DATA);

      const result = await provider.readSnapshot("sessions/global/9999_scheduled.json.gz");
      expectPayload(result, "snapshot-payload");
    });

    it("deletes a global snapshot via canonical sessions/global/<file> path", async () => {
      await provider.writeSnapshot(globalEntry, TEST_DATA);

      await provider.deleteSnapshots(["sessions/global/9999_scheduled.json.gz"]);

      const result = await provider.readSnapshot("sessions/global/9999_scheduled.json.gz");
      expect(result).toBeNull();
    });
  });

  // ── Legacy global/ path compat ───────────────────────────────────────────

  describe("legacy global/ path normalization", () => {
    const globalEntry = makeEntry({
      filename: "sessions/global/9999_scheduled.json.gz",
      sessionKeyHash: "global",
      sessionLabel: null,
    });

    it("reads a global snapshot via legacy global/<file> path", async () => {
      await provider.writeSnapshot(globalEntry, TEST_DATA);

      // Legacy format: "global/9999_scheduled.json.gz" (missing "sessions/" prefix)
      const result = await provider.readSnapshot("global/9999_scheduled.json.gz");
      expectPayload(result, "snapshot-payload");
    });

    it("deletes a global snapshot via legacy global/<file> path", async () => {
      await provider.writeSnapshot(globalEntry, TEST_DATA);

      await provider.deleteSnapshots(["global/9999_scheduled.json.gz"]);

      // Verify file is actually gone
      const result = await provider.readSnapshot("sessions/global/9999_scheduled.json.gz");
      expect(result).toBeNull();
    });

    it("handles mixed canonical and legacy paths in a single deleteSnapshots call", async () => {
      // Write two snapshots
      const entry1 = makeEntry({
        filename: "sessions/global/1111_scheduled.json.gz",
        sessionKeyHash: "global",
        sessionLabel: null,
        createdAt: 1111,
      });
      const entry2 = makeEntry({
        filename: "sessions/global/2222_scheduled.json.gz",
        sessionKeyHash: "global",
        sessionLabel: null,
        createdAt: 2222,
      });
      await provider.writeSnapshot(entry1, TEST_DATA);
      await provider.writeSnapshot(entry2, TEST_DATA);

      // Delete one with canonical path, one with legacy path
      await provider.deleteSnapshots([
        "sessions/global/1111_scheduled.json.gz",
        "global/2222_scheduled.json.gz",
      ]);

      expect(await provider.readSnapshot("sessions/global/1111_scheduled.json.gz")).toBeNull();
      expect(await provider.readSnapshot("sessions/global/2222_scheduled.json.gz")).toBeNull();
    });
  });

  // ── Edge cases ───────────────────────────────────────────────────────────

  describe("edge cases", () => {
    it("readSnapshot returns null for non-existent file", async () => {
      const result = await provider.readSnapshot("sessions/missing/nope.json.gz");
      expect(result).toBeNull();
    });

    it("deleteSnapshots silently ignores non-existent files", async () => {
      // Should not throw
      await provider.deleteSnapshots(["sessions/missing/nope.json.gz", "global/nope.json.gz"]);
    });

    it("deleteSnapshots is a no-op for empty array", async () => {
      await provider.deleteSnapshots([]);
    });

    it("readSnapshot returns null for traversal path", async () => {
      const result = await provider.readSnapshot("sessions/abc123/../../etc/passwd");
      expect(result).toBeNull();
    });

    it("deleteSnapshots skips traversal path silently", async () => {
      const entry = makeEntry({
        filename: "sessions/abc123/1234_scheduled.json.gz",
        sessionKeyHash: "abc123",
      });
      await provider.writeSnapshot(entry, TEST_DATA);

      await provider.deleteSnapshots(["sessions/abc123/../../etc/passwd"]);

      const result = await provider.readSnapshot("sessions/abc123/1234_scheduled.json.gz");
      expectPayload(result, "snapshot-payload");
    });
  });
});
