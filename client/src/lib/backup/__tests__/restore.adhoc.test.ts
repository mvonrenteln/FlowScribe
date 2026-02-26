import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { openRestoreFromFolder } from "../restore";

// Mock FileSystemProvider so tests do not touch the real File System Access API
const mockReadManifest = vi.fn();
const mockFromHandle = vi.fn();

vi.mock("@/lib/backup/providers/FileSystemProvider", () => ({
  FileSystemProvider: {
    fromHandle: (...args: unknown[]) => mockFromHandle(...args),
  },
}));

type ExtendedWindow = Window & {
  showDirectoryPicker?: (options?: { mode?: string }) => Promise<FileSystemDirectoryHandle>;
};

const fakeHandle = { name: "backup-folder" } as unknown as FileSystemDirectoryHandle;

const makeProvider = (manifest: unknown = null) => {
  const provider = { readManifest: mockReadManifest };
  mockFromHandle.mockReturnValue(provider);
  mockReadManifest.mockResolvedValue(manifest);
  return provider;
};

describe("openRestoreFromFolder", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  afterEach(() => {
    delete (window as ExtendedWindow).showDirectoryPicker;
  });

  it("throws when File System Access API is not supported", async () => {
    delete (window as ExtendedWindow).showDirectoryPicker;

    await expect(openRestoreFromFolder()).rejects.toThrow(
      "File System Access API not supported in this browser",
    );
  });

  it("re-throws AbortError when the user cancels the picker", async () => {
    const mockPicker = vi
      .fn()
      .mockRejectedValue(new DOMException("The user aborted a request.", "AbortError"));
    (window as ExtendedWindow).showDirectoryPicker = mockPicker;

    await expect(openRestoreFromFolder()).rejects.toMatchObject({
      name: "AbortError",
    });
    expect(mockPicker).toHaveBeenCalledOnce();
  });

  it("throws when the selected folder has no manifest.json", async () => {
    const mockPicker = vi.fn().mockResolvedValue(fakeHandle);
    (window as ExtendedWindow).showDirectoryPicker = mockPicker;

    makeProvider(null); // readManifest returns null

    await expect(openRestoreFromFolder()).rejects.toThrow("Not a valid FlowScribe backup folder");
    expect(mockFromHandle).toHaveBeenCalledWith(fakeHandle);
  });

  it("throws when the manifest exists but contains no snapshots", async () => {
    const mockPicker = vi.fn().mockResolvedValue(fakeHandle);
    (window as ExtendedWindow).showDirectoryPicker = mockPicker;

    makeProvider({ snapshots: [] });

    await expect(openRestoreFromFolder()).rejects.toThrow("Not a valid FlowScribe backup folder");
  });

  it("returns provider, manifest, and handle on success", async () => {
    const manifest = {
      snapshots: [
        { filename: "snap-1.bin", createdAt: Date.now(), sessionLabel: "Test", sessionKey: "k1" },
      ],
    };
    const mockPicker = vi.fn().mockResolvedValue(fakeHandle);
    (window as ExtendedWindow).showDirectoryPicker = mockPicker;

    const provider = makeProvider(manifest);

    const result = await openRestoreFromFolder();

    expect(result.handle).toBe(fakeHandle);
    expect(result.provider).toBe(provider);
    expect(result.manifest).toBe(manifest);
    expect(mockPicker).toHaveBeenCalledWith({ mode: "readwrite" });
    expect(mockFromHandle).toHaveBeenCalledWith(fakeHandle);
  });
});
