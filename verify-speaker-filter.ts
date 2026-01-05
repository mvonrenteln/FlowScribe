/**
 * Manual test script to verify same-speaker filtering
 * Run: npx tsx verify-speaker-filter.ts
 */

import type { MergeAnalysisSegment } from "../client/src/lib/ai/features/segmentMerge/types";
import {
  collectSegmentPairsWithSimpleIds,
  createSimpleIdContext,
  isSameSpeaker,
} from "../client/src/lib/ai/features/segmentMerge/utils";

console.log("=== Testing Same-Speaker Filtering ===\n");

// Test 1: isSameSpeaker
console.log("Test 1: isSameSpeaker function");
console.log(
  "Same speaker (Alice-Alice):",
  isSameSpeaker({ speaker: "Alice" }, { speaker: "Alice" }),
);
console.log(
  "Different speakers (Alice-Bob):",
  isSameSpeaker({ speaker: "Alice" }, { speaker: "Bob" }),
);
console.log("");

// Test 2: collectSegmentPairsWithSimpleIds with sameSpeakerOnly: true
console.log("Test 2: Collect pairs with sameSpeakerOnly: true");
const segments: MergeAnalysisSegment[] = [
  { id: "1", speaker: "Alice", start: 0, end: 1, text: "Hello" },
  { id: "2", speaker: "Alice", start: 1.1, end: 2, text: "world" },
  { id: "3", speaker: "Bob", start: 2.1, end: 3, text: "Hi" },
  { id: "4", speaker: "Alice", start: 3.1, end: 4, text: "there" },
];

const idContext1 = createSimpleIdContext(segments);
const pairs1 = collectSegmentPairsWithSimpleIds(
  segments,
  1.0, // maxTimeGap
  true, // sameSpeakerOnly
  idContext1.mapping,
  idContext1.getSimpleId,
);

console.log(`Found ${pairs1.length} pairs (expected: 1 - only Alice-Alice):`);
pairs1.forEach((pair) => {
  console.log(
    `  - Pair ${pair.pairIndex}: ${pair.segmentA.speaker} (${pair.segmentA.id}) → ${pair.segmentB.speaker} (${pair.segmentB.id})`,
  );
});

if (pairs1.length !== 1) {
  console.error("❌ FAILED: Expected 1 pair, got", pairs1.length);
  process.exit(1);
}
if (pairs1[0].segmentA.speaker !== "Alice" || pairs1[0].segmentB.speaker !== "Alice") {
  console.error("❌ FAILED: Pair contains different speakers");
  process.exit(1);
}
console.log("✅ PASSED\n");

// Test 3: collectSegmentPairsWithSimpleIds with sameSpeakerOnly: false
console.log("Test 3: Collect pairs with sameSpeakerOnly: false");
const idContext2 = createSimpleIdContext(segments);
const pairs2 = collectSegmentPairsWithSimpleIds(
  segments,
  1.0, // maxTimeGap
  false, // sameSpeakerOnly
  idContext2.mapping,
  idContext2.getSimpleId,
);

console.log(`Found ${pairs2.length} pairs (expected: 3 - all adjacent pairs):`);
pairs2.forEach((pair) => {
  console.log(
    `  - Pair ${pair.pairIndex}: ${pair.segmentA.speaker} (${pair.segmentA.id}) → ${pair.segmentB.speaker} (${pair.segmentB.id})`,
  );
});

if (pairs2.length !== 3) {
  console.error("❌ FAILED: Expected 3 pairs, got", pairs2.length);
  process.exit(1);
}
console.log("✅ PASSED\n");

// Test 4: Verify no cross-speaker pairs with sameSpeakerOnly: true
console.log("Test 4: Verify no cross-speaker pairs");
const hasCrossSpeakerPair = pairs1.some((pair) => pair.segmentA.speaker !== pair.segmentB.speaker);
if (hasCrossSpeakerPair) {
  console.error("❌ FAILED: Found cross-speaker pair with sameSpeakerOnly: true");
  process.exit(1);
}
console.log("✅ PASSED - No cross-speaker pairs\n");

console.log("=== All tests passed! ✅ ===");
