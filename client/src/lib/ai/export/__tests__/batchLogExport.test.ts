import { afterEach, describe, expect, it, vi } from "vitest";
import type { BatchLogRow } from "@/components/shared/BatchLog/BatchLog";
import {
  buildBatchLogExport,
  downloadAsJson,
  exportBatchLog,
  exportRevisionBatchLog,
  mapBatchLogRowToExport,
  mapRevisionLogEntryToExport,
} from "@/lib/ai/export/batchLogExport";
import type { AIRevisionBatchLogEntry } from "@/lib/store/types";

describe("batch log export", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  const stubUrlApis = () => {
    Object.defineProperty(URL, "createObjectURL", {
      value: vi.fn(() => "blob:export"),
      configurable: true,
    });
    Object.defineProperty(URL, "revokeObjectURL", {
      value: vi.fn(),
      configurable: true,
    });
  };

  it("maps batch rows without dropping diagnostic payloads", () => {
    const row: BatchLogRow = {
      id: "batch-1",
      batchLabel: "1",
      expected: 3,
      returned: 2,
      durationMs: 123,
      used: 1,
      ignored: 1,
      suggestions: 2,
      unchanged: 0,
      skipped: 1,
      processed: "2/3",
      issues: "one failed",
      loggedAt: 99,
      requestPayload: "request",
      responsePayload: "response",
    };

    expect(mapBatchLogRowToExport(row)).toEqual(row);
  });

  it("maps revision entries to export rows", () => {
    const entry: AIRevisionBatchLogEntry = {
      segmentId: "seg-1",
      status: "failed",
      loggedAt: 5,
      durationMs: 10,
      error: "No response",
      errorCode: "EMPTY_RESPONSE",
      responsePayload: "{}",
    };

    expect(mapRevisionLogEntryToExport(entry)).toEqual({
      segmentId: "seg-1",
      status: "failed",
      loggedAt: 5,
      durationMs: 10,
      error: "No response",
      errorCode: "EMPTY_RESPONSE",
      requestPayload: undefined,
      responsePayload: "{}",
    });
  });

  it("wraps exported rows with feature metadata and timestamp", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-02T03:04:05.000Z"));

    expect(buildBatchLogExport("segment-merge", [{ id: "row" }])).toEqual({
      exportedAt: "2026-01-02T03:04:05.000Z",
      featureType: "segment-merge",
      batches: [{ id: "row" }],
    });
  });

  it("downloads JSON and revokes the temporary object URL", () => {
    const click = vi.fn();
    const anchor = document.createElement("a");
    anchor.click = click;
    vi.spyOn(document, "createElement").mockReturnValue(anchor);
    stubUrlApis();

    downloadAsJson({ ok: true }, "batch-log");

    expect(anchor.href).toBe("blob:export");
    expect(anchor.download).toBe("batch-log.json");
    expect(click).toHaveBeenCalledOnce();
    expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:export");
  });

  it("exports batch and revision logs through the shared download path", () => {
    const click = vi.fn();
    const anchor = document.createElement("a");
    anchor.click = click;
    vi.spyOn(document, "createElement").mockReturnValue(anchor);
    stubUrlApis();

    exportBatchLog("chapter-detection", [{ id: "1", batchLabel: "1", loggedAt: 1 }], "chapters");
    exportRevisionBatchLog([{ segmentId: "seg", status: "revised", loggedAt: 1 }], "revisions");

    expect(click).toHaveBeenCalledTimes(2);
    expect(anchor.download).toBe("revisions.json");
  });
});
