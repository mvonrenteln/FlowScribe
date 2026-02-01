import { describe, expect, it } from "vitest";
import { createBatchIdMapping } from "@/lib/ai/core/batchIdMapping";
import { mapResponseToRealSegmentIds } from "../utils";

describe("chapterDetection utils", () => {
  it("maps batch start/end simple IDs to real segment IDs", () => {
    const mapping = createBatchIdMapping(
      [{ id: "seg-1" }, { id: "seg-2" }, { id: "seg-3" }],
      (s) => s.id,
    );

    const mapped = mapResponseToRealSegmentIds(
      {
        chapters: [
          {
            title: "Movement Rules",
            summary: "  Rules summary. ",
            notes: "  Notes here. ",
            tags: ["keep"],
            start: 1,
            end: 2,
          },
        ],
      },
      mapping,
    );

    expect(mapped).toHaveLength(1);
    expect(mapped[0]?.startSegmentId).toBe("seg-1");
    expect(mapped[0]?.endSegmentId).toBe("seg-2");
    expect(mapped[0]?.summary).toBe("Rules summary.");
    expect(mapped[0]?.notes).toBe("Notes here.");
  });

  it("falls back to global mapping when batch mapping misses", () => {
    const batchMapping = createBatchIdMapping([{ id: "seg-1" }], (s) => s.id);
    const globalMapping = createBatchIdMapping(
      [{ id: "seg-10" }, { id: "seg-11" }, { id: "seg-12" }],
      (s) => s.id,
    );

    const mapped = mapResponseToRealSegmentIds(
      {
        chapters: [
          {
            title: "Chapter A",
            start: 2,
            end: 3,
          },
        ],
      },
      batchMapping,
      globalMapping,
    );

    expect(mapped).toHaveLength(1);
    expect(mapped[0]?.startSegmentId).toBe("seg-11");
    expect(mapped[0]?.endSegmentId).toBe("seg-12");
  });
});
