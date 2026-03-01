import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DownloadProvider } from "../providers/DownloadProvider";
import type { SnapshotEntry } from "../types";

const createEntry = (filename: string): SnapshotEntry => ({
  filename,
  sessionKeyHash: "session-hash",
  sessionLabel: "Session",
  createdAt: 1234,
  reason: "manual",
  appVersion: "1.0.0",
  schemaVersion: 1,
  compressedSize: 3,
  checksum: "deadbeef",
});

describe("DownloadProvider", () => {
  const originalCreateElement = document.createElement.bind(document);

  let provider: DownloadProvider;
  let clickSpy: ReturnType<typeof vi.fn>;
  let createObjectURLSpy: ReturnType<typeof vi.fn>;
  let revokeObjectURLSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.useFakeTimers();
    provider = new DownloadProvider();
    clickSpy = vi.fn();

    vi.spyOn(document, "createElement").mockImplementation(((tagName: string) => {
      if (tagName !== "a") {
        return originalCreateElement(tagName);
      }

      const anchor = originalCreateElement("a");
      Object.defineProperty(anchor, "click", {
        value: clickSpy,
        configurable: true,
      });
      return anchor;
    }) as Document["createElement"]);

    vi.spyOn(document.body, "appendChild").mockImplementation((node: Node) => node);
    vi.spyOn(document.body, "removeChild").mockImplementation((node: Node) => node);
    createObjectURLSpy = vi.fn(() => "blob:mock");
    revokeObjectURLSpy = vi.fn(() => undefined);
    Object.defineProperty(URL, "createObjectURL", {
      configurable: true,
      writable: true,
      value: createObjectURLSpy,
    });
    Object.defineProperty(URL, "revokeObjectURL", {
      configurable: true,
      writable: true,
      value: revokeObjectURLSpy,
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("triggers one download for a single snapshot", async () => {
    await provider.writeSnapshot(createEntry("sessions/one/1_manual.json.gz"), new Uint8Array([1]));

    provider.triggerDownload();

    expect(clickSpy).toHaveBeenCalledTimes(1);
    expect(createObjectURLSpy).toHaveBeenCalledTimes(1);
    expect(revokeObjectURLSpy).toHaveBeenCalledTimes(1);
  });

  it("triggers one download per queued snapshot", async () => {
    await provider.writeSnapshot(createEntry("sessions/one/1_manual.json.gz"), new Uint8Array([1]));
    await provider.writeSnapshot(createEntry("sessions/two/2_manual.json.gz"), new Uint8Array([2]));
    await provider.writeSnapshot(
      createEntry("sessions/three/3_manual.json.gz"),
      new Uint8Array([3]),
    );

    provider.triggerDownload();
    await vi.runAllTimersAsync();

    expect(clickSpy).toHaveBeenCalledTimes(3);
    expect(createObjectURLSpy).toHaveBeenCalledTimes(3);
    expect(revokeObjectURLSpy).toHaveBeenCalledTimes(3);
  });

  it("reports no pending download after queue drain", async () => {
    await provider.writeSnapshot(createEntry("sessions/one/1_manual.json.gz"), new Uint8Array([1]));
    expect(provider.hasPendingDownload()).toBe(true);

    provider.triggerDownload();

    expect(provider.hasPendingDownload()).toBe(false);
  });

  it("does nothing when triggered with an empty queue", async () => {
    provider.triggerDownload();
    await vi.runAllTimersAsync();
    provider.triggerDownload();
    await vi.runAllTimersAsync();

    expect(clickSpy).not.toHaveBeenCalled();
    expect(createObjectURLSpy).not.toHaveBeenCalled();
    expect(revokeObjectURLSpy).not.toHaveBeenCalled();
  });
});
