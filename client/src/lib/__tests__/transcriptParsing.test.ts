import { describe, expect, it } from "vitest";
import { parseTranscriptData } from "@/lib/transcriptParsing";

describe("transcriptParsing", () => {
  it("preserves word scores when parsing WhisperX data", () => {
    const data = {
      segments: [
        {
          speaker: "SPEAKER_42",
          start: 0,
          end: 2,
          text: "hello world",
          words: [
            { word: "hello", start: 0, end: 1, score: 0.12 },
            { word: "world", start: 1, end: 2, score: 0.98 },
          ],
        },
      ],
    };

    const parsed = parseTranscriptData(data);

    expect(parsed?.isWhisperXFormat).toBe(true);
    expect(parsed?.segments).toHaveLength(1);
    const words = parsed?.segments[0]?.words ?? [];
    expect(words[0]?.score).toBe(0.12);
    expect(words[1]?.score).toBe(0.98);
  });

  it("falls back to generated words when WhisperX data has no word timing", () => {
    const data = {
      segments: [
        {
          speaker: "SPEAKER_01",
          start: 5,
          end: 7,
          text: "just text",
        },
      ],
    };

    const parsed = parseTranscriptData(data);

    expect(parsed?.segments[0]?.words).toHaveLength(2);
    expect(parsed?.segments[0]?.words[0]?.word).toBe("just");
    expect(parsed?.segments[0]?.words[0]?.score).toBeUndefined();
  });

  it("preserves segment tags when parsing WhisperX data", () => {
    const data = {
      segments: [{ speaker: "SPEAKER_01", start: 0, end: 1, text: "a", tags: ["alpha"] }],
    };

    const parsed = parseTranscriptData(data);
    expect(parsed?.segments[0].tags).toEqual(["alpha"]);
  });

  it("preserves segment ids when parsing JSON export data", () => {
    const data = {
      segments: [
        {
          id: "segment-42",
          speaker: "SPEAKER_01",
          start: 0,
          end: 1,
          text: "a",
          words: [],
        },
      ],
      tags: [{ name: "alpha", color: "#fff" }],
    };

    const parsed = parseTranscriptData(data);
    expect(parsed?.segments[0].id).toBe("segment-42");
    expect(parsed?.tags).toEqual([{ name: "alpha", color: "#fff" }]);
  });
});
