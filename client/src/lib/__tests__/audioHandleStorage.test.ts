import { describe, expect, it, vi } from "vitest";
import {
  buildAudioRefKey,
  getAllAudioHandleKeys,
  loadAudioHandleForAudioRef,
  queryAudioHandlePermission,
  requestAudioHandlePermission,
} from "@/lib/audioHandleStorage";
import type { FileReference } from "@/lib/fileReference";

describe("audio handle storage", () => {
  it("builds stable keys from file identity only", () => {
    const ref: FileReference = { name: "audio.wav", size: 12, lastModified: 34 };

    expect(buildAudioRefKey(ref)).toBe(
      JSON.stringify({ name: "audio.wav", size: 12, lastModified: 34 }),
    );
  });

  it("falls back safely when IndexedDB is unavailable", async () => {
    vi.stubGlobal("indexedDB", undefined);

    await expect(loadAudioHandleForAudioRef("missing")).resolves.toBeNull();
    await expect(getAllAudioHandleKeys()).resolves.toEqual([]);

    vi.unstubAllGlobals();
  });

  it("treats missing permission APIs as already allowed", async () => {
    const handle = {} as FileSystemFileHandle;

    await expect(queryAudioHandlePermission(handle)).resolves.toBe(true);
    await expect(requestAudioHandlePermission(handle)).resolves.toBe(true);
  });

  it("maps file handle permission states to booleans", async () => {
    const queryPermission = vi.fn<() => Promise<PermissionState>>().mockResolvedValue("granted");
    const requestPermission = vi.fn<() => Promise<PermissionState>>().mockResolvedValue("denied");
    const handle = { queryPermission, requestPermission } as FileSystemFileHandle;

    await expect(queryAudioHandlePermission(handle)).resolves.toBe(true);
    await expect(requestAudioHandlePermission(handle)).resolves.toBe(false);
    expect(queryPermission).toHaveBeenCalledWith({ mode: "read" });
    expect(requestPermission).toHaveBeenCalledWith({ mode: "read" });
  });
});
