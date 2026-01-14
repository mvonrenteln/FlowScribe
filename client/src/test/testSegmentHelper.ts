import type { Segment } from "@/lib/store/types";

/**
 * Helper to create a test segment with default values.
 * This ensures all required fields (including tags) are present.
 */
export const createTestSegment = (overrides: Partial<Segment> & { id: string }): Segment => ({
  speaker: "SPEAKER_00",
  tags: [],
  start: 0,
  end: 1,
  text: "",
  words: [],
  ...overrides,
});
import type { Segment } from "@/lib/store/types";

/**
 * Helper to create a test segment with default values.
 * This ensures all required fields (including tags) are present.
 */
export const createTestSegment = (overrides: Partial<Segment> & { id: string }): Segment => ({
  speaker: "SPEAKER_00",
  tags: [],
  start: 0,
  end: 1,
  text: "",
  words: [],
  ...overrides,
});
