import { describe, expect, it } from "vitest";
import { buildVTTExport } from "../exportUtils";
import type { Segment } from "../store/types";

/**
 * Helper to create minimal test segments with required fields.
 * Provides sensible defaults for optional fields.
 */
function makeSegment(overrides: Partial<Segment>): Segment {
  return {
    id: overrides.id ?? "s1",
    speaker: overrides.speaker ?? "Speaker",
    tags: overrides.tags ?? [],
    start: overrides.start ?? 0,
    end: overrides.end ?? 1,
    text: overrides.text ?? "Test text",
    words: overrides.words ?? [],
    confirmed: overrides.confirmed,
    bookmarked: overrides.bookmarked,
  };
}

describe("buildVTTExport", () => {
  it("produces WEBVTT header as first line", () => {
    const segments: Segment[] = [];
    const result = buildVTTExport(segments);
    expect(result.startsWith("WEBVTT")).toBe(true);
  });

  it("formats timestamps as HH:MM:SS.mmm with dot separator and 3-digit milliseconds", () => {
    const segments: Segment[] = [
      makeSegment({
        id: "s1",
        start: 1.5,
        end: 3.75,
        speaker: "Speaker One",
        text: "Hello world",
      }),
    ];
    const result = buildVTTExport(segments);
    expect(result).toContain("00:00:01.500 --> 00:00:03.750");
  });

  it("wraps text in voice tags using segment speaker name", () => {
    const segments: Segment[] = [
      makeSegment({
        id: "s1",
        start: 0,
        end: 2,
        speaker: "Alice",
        text: "Hello there",
      }),
    ];
    const result = buildVTTExport(segments);
    expect(result).toContain("<v Alice>Hello there</v>");
  });

  it("separates cues with blank lines", () => {
    const segments: Segment[] = [
      makeSegment({
        id: "s1",
        start: 0,
        end: 2,
        speaker: "Speaker One",
        text: "First segment",
      }),
      makeSegment({
        id: "s2",
        start: 2,
        end: 4,
        speaker: "Speaker Two",
        text: "Second segment",
      }),
    ];
    const result = buildVTTExport(segments);
    // Should have blank line between cues
    expect(result).toContain("</v>\n\n");
  });

  it("generates sequential numeric cue IDs starting from 1", () => {
    const segments: Segment[] = [
      makeSegment({
        id: "s1",
        start: 0,
        end: 1,
        speaker: "Speaker",
        text: "First",
      }),
      makeSegment({
        id: "s2",
        start: 1,
        end: 2,
        speaker: "Speaker",
        text: "Second",
      }),
      makeSegment({
        id: "s3",
        start: 2,
        end: 3,
        speaker: "Speaker",
        text: "Third",
      }),
    ];
    const result = buildVTTExport(segments);
    expect(result).toContain("\n1\n");
    expect(result).toContain("\n2\n");
    expect(result).toContain("\n3\n");
  });

  it("handles segments with multi-word text correctly", () => {
    const segments: Segment[] = [
      makeSegment({
        id: "s1",
        start: 0,
        end: 3,
        speaker: "Speaker",
        text: "This is a longer segment with multiple words",
      }),
    ];
    const result = buildVTTExport(segments);
    expect(result).toContain("<v Speaker>This is a longer segment with multiple words</v>");
  });

  it("handles segments with zero-start timestamp", () => {
    const segments: Segment[] = [
      makeSegment({
        id: "s1",
        start: 0,
        end: 2.5,
        speaker: "Speaker",
        text: "Starting from zero",
      }),
    ];
    const result = buildVTTExport(segments);
    expect(result).toContain("00:00:00.000 --> 00:00:02.500");
  });

  it("handles long timestamps over 1 hour correctly", () => {
    const segments: Segment[] = [
      makeSegment({
        id: "s1",
        start: 3930.5, // 1 hour, 5 minutes, 30.5 seconds
        end: 3960.75, // 1 hour, 6 minutes, 0.75 seconds
        speaker: "Speaker",
        text: "Long duration segment",
      }),
    ];
    const result = buildVTTExport(segments);
    expect(result).toContain("01:05:30.500 --> 01:06:00.750");
  });

  it("carries millisecond rollover into seconds instead of emitting 4-digit milliseconds", () => {
    const segments: Segment[] = [
      makeSegment({
        id: "s1",
        start: 1.9995,
        end: 59.9995,
        speaker: "Speaker",
        text: "Rollover edge",
      }),
    ];

    const result = buildVTTExport(segments);
    expect(result).toContain("00:00:02.000 --> 00:01:00.000");
    expect(result).not.toMatch(/\.\d{4}/);
  });

  it("carries rollover across hour boundary", () => {
    const segments: Segment[] = [
      makeSegment({
        id: "s1",
        start: 3599.9995,
        end: 3600.0004,
        speaker: "Speaker",
        text: "Hour boundary",
      }),
    ];

    const result = buildVTTExport(segments);
    expect(result).toContain("01:00:00.000 --> 01:00:00.000");
    expect(result).not.toMatch(/\.\d{4}/);
  });

  it("produces output with just header for empty segment array", () => {
    const segments: Segment[] = [];
    const result = buildVTTExport(segments);
    expect(result.trim()).toBe("WEBVTT");
  });

  it("handles special characters in speaker name (spaces and hyphens)", () => {
    const segments: Segment[] = [
      makeSegment({
        id: "s1",
        start: 0,
        end: 1,
        speaker: "John Smith-Jones",
        text: "Hello",
      }),
    ];
    const result = buildVTTExport(segments);
    expect(result).toContain("<v John Smith-Jones>Hello</v>");
  });

  it("handles special characters in text content (commas, periods, apostrophes)", () => {
    const segments: Segment[] = [
      makeSegment({
        id: "s1",
        start: 0,
        end: 2,
        speaker: "Speaker",
        text: "It's a test, with periods. And commas, too!",
      }),
    ];
    const result = buildVTTExport(segments);
    expect(result).toContain("<v Speaker>It's a test, with periods. And commas, too!</v>");
  });
});
