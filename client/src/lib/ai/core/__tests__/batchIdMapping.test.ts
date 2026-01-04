import { describe, it, expect } from "vitest";
import {
  addPair,
  createBatchIdMapping,
  createBatchPairMapping,
  extractSegmentIdsGeneric,
  getPairIds,
  normalizeIds,
  parseIdReference,
  type BatchIdMapping,
  type BatchPairMapping,
  type RawAIItem,
} from "@/lib/ai/core/batchIdMapping";

const sampleItems = [
  { id: "item-1" },
  { id: "item-2" },
  { id: "item-3" },
  { id: "item-4" },
];
const getId = (item: { id: string }) => item.id;

describe("createBatchIdMapping", () => {
  it("assigns sequential simple ids starting at 1", () => {
    const mapping = createBatchIdMapping(sampleItems, getId);
    expect(mapping.simpleToReal.get(1)).toBe("item-1");
    expect(mapping.simpleToReal.get(sampleItems.length)).toBe("item-4");
    expect(mapping.realToSimple.get("item-3")).toBe(3);
  });

  it("latest duplicate id overwrites earlier mapping", () => {
    const withDuplicate = [...sampleItems, { id: "item-2" }];
    const mapping = createBatchIdMapping(withDuplicate, getId);
    expect(mapping.realToSimple.get("item-2")).toBe(withDuplicate.length);
  });
});

describe("createBatchPairMapping", () => {
  it("inherits simple mappings and stores pair links", () => {
    const pairMap = createBatchPairMapping(sampleItems, getId);
    expect(pairMap.simpleToReal.get(2)).toBe("item-2");
    expect(pairMap.realToSimple.get("item-4")).toBe(4);

    addPair(7, "item-1", "item-3", pairMap);
    expect(getPairIds(7, pairMap)).toEqual(["item-1", "item-3"]);
    expect(getPairIds(99, pairMap)).toBeUndefined();
  });
});

describe("normalizeIds", () => {
  it("maps numbers, numeric strings and direct ids, ignoring invalid entries", () => {
    const mapping = createBatchIdMapping(sampleItems, getId);
    const input = [1, "2", "item-3", "unknown", 999];
    expect(normalizeIds(input, mapping)).toEqual(["item-1", "item-2", "item-3"]);
  });
});

describe("parseIdReference", () => {
  let mapping: BatchIdMapping<string>;
  beforeEach(() => {
    mapping = createBatchIdMapping(sampleItems, getId);
  });

  it("parses numeric references regardless of type", () => {
    expect(parseIdReference(2, mapping)).toEqual(["item-2"]);
    expect(parseIdReference("3", mapping)).toEqual(["item-3"]);
  });

  it("parses range syntax and trims whitespace", () => {
    expect(parseIdReference("1-2", mapping)).toEqual(["item-1", "item-2"]);
    expect(parseIdReference(" 2 - 4 ", mapping)).toEqual(["item-2", "item-4"]);
  });

  it("returns direct ids if known and empty array otherwise", () => {
    expect(parseIdReference("item-4", mapping)).toEqual(["item-4"]);
    expect(parseIdReference("unknown", mapping)).toEqual([]);
  });
});

describe("extractSegmentIdsGeneric", () => {
  let pairMap: BatchPairMapping<string>;

  beforeEach(() => {
    pairMap = createBatchPairMapping(sampleItems, getId);
    addPair(5, "item-2", "item-3", pairMap);
    addPair(10, "item-3", "item-4", pairMap);
  });

  it("prefers pairIndex hints even when other hints exist", () => {
    const raw: RawAIItem = { pairIndex: 5, segmentIds: [1, 4] };
    expect(extractSegmentIdsGeneric(raw, pairMap)).toEqual(["item-2", "item-3"]);
  });

  it("supports mergeId referencing an existing pair index", () => {
    const raw: RawAIItem = { mergeId: 10 };
    expect(extractSegmentIdsGeneric(raw, pairMap)).toEqual(["item-3", "item-4"]);
  });

  it("supports mergeId range strings that reference simple ids", () => {
    const mappingWithoutPairs = createBatchIdMapping(sampleItems, getId);
    const raw: RawAIItem = { mergeId: "1-3" };
    expect(extractSegmentIdsGeneric(raw, mappingWithoutPairs)).toEqual(["item-1", "item-3"]);
  });

  it("maps segmentIds arrays mixing numbers and real ids", () => {
    const raw: RawAIItem = { segmentIds: ["item-1", 4] };
    expect(extractSegmentIdsGeneric(raw, pairMap)).toEqual(["item-1", "item-4"]);
  });

  it("extracts ids from segmentA/segmentB objects", () => {
    const raw: RawAIItem = { segmentA: { id: "item-2" }, segmentB: { id: "item-4" } };
    expect(extractSegmentIdsGeneric(raw, pairMap)).toEqual(["item-2", "item-4"]);
  });

  it("falls back to ids array when the other hints fail", () => {
    const raw: RawAIItem = { ids: [1, "2"] };
    expect(extractSegmentIdsGeneric(raw, pairMap)).toEqual(["item-1", "item-2"]);
  });

  it("returns null when fewer than two ids can be derived", () => {
    const rawSingle: RawAIItem = { segmentIds: [1] };
    expect(extractSegmentIdsGeneric(rawSingle, pairMap)).toBeNull();

    const rawUnknown: RawAIItem = { mergeId: "999" };
    expect(extractSegmentIdsGeneric(rawUnknown, pairMap)).toBeNull();
  });
});

