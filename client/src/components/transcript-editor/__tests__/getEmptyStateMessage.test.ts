import { describe, expect, it } from "vitest";
import type { Segment } from "@/types/transcript";
import { getEmptyStateMessage } from "../useFiltersAndLexicon";

/** Identity translation: returns the key so assertions can match on i18n keys. */
const t = (key: string) => key;

const seg = (id: string): Segment => ({
  id,
  speaker: "SPEAKER_00",
  start: 0,
  end: 1,
  text: "hello",
  words: [],
  tags: [],
});

const noSegments: Segment[] = [];
const someSegments: Segment[] = [seg("seg-1")];

describe("getEmptyStateMessage", () => {
  it("returns noTranscript keys when there are no segments at all", () => {
    const result = getEmptyStateMessage({
      segments: noSegments,
      filterSpellcheck: false,
      filterLowConfidence: false,
      t,
    });
    expect(result.title).toBe("transcript.emptyState.noTranscriptTitle");
    expect(result.description).toBe("transcript.emptyState.noTranscriptDescription");
  });

  it("returns noSpellingForSpeaker keys when filterSpellcheck is on and speaker is active", () => {
    const result = getEmptyStateMessage({
      segments: someSegments,
      filterSpellcheck: true,
      filterLowConfidence: false,
      activeSpeakerName: "Alice",
      t,
    });
    expect(result.title).toBe("transcript.emptyState.noSpellingForSpeakerTitle");
    expect(result.description).toBe("transcript.emptyState.clearFiltersDescription");
  });

  it("returns noSpelling keys when filterSpellcheck is on and no speaker is active", () => {
    const result = getEmptyStateMessage({
      segments: someSegments,
      filterSpellcheck: true,
      filterLowConfidence: false,
      t,
    });
    expect(result.title).toBe("transcript.emptyState.noSpellingTitle");
    expect(result.description).toBe("transcript.emptyState.clearFiltersDescription");
  });

  it("returns noLowScoreForSpeaker keys when filterLowConfidence is on and speaker is active", () => {
    const result = getEmptyStateMessage({
      segments: someSegments,
      filterSpellcheck: false,
      filterLowConfidence: true,
      activeSpeakerName: "Bob",
      t,
    });
    expect(result.title).toBe("transcript.emptyState.noLowScoreForSpeakerTitle");
    expect(result.description).toBe("transcript.emptyState.adjustThresholdDescription");
  });

  it("returns noLowScore keys when filterLowConfidence is on and no speaker is active", () => {
    const result = getEmptyStateMessage({
      segments: someSegments,
      filterSpellcheck: false,
      filterLowConfidence: true,
      t,
    });
    expect(result.title).toBe("transcript.emptyState.noLowScoreTitle");
    expect(result.description).toBe("transcript.emptyState.adjustThresholdDescription");
  });

  it("returns noSegmentsForSpeaker keys as fallback when filters produce empty result", () => {
    const result = getEmptyStateMessage({
      segments: someSegments,
      filterSpellcheck: false,
      filterLowConfidence: false,
      activeSpeakerName: "Charlie",
      t,
    });
    expect(result.title).toBe("transcript.emptyState.noSegmentsForSpeakerTitle");
    expect(result.description).toBe("transcript.emptyState.noSegmentsForSpeakerDescription");
  });
});
