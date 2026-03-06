import { describe, expect, it } from "vitest";
import type { Segment } from "../store/types";
import { isVTTFormat, parseVTT } from "../transcriptParsing";

describe("parseVTT", () => {
  it("parses valid VTT with HH:MM:SS.mmm timestamps to correct start/end seconds", () => {
    const vtt = `WEBVTT

1
00:00:01.000 --> 00:00:03.500
<v Speaker One>Hello world</v>`;

    const result = parseVTT(vtt);

    expect(result).toHaveLength(1);
    expect(result[0]).toBeDefined();
    const segment = result[0] as Segment;
    expect(segment.start).toBe(1);
    expect(segment.end).toBe(3.5);
    expect(segment.text).toBe("Hello world");
  });

  it("parses valid VTT with MM:SS.mmm timestamps (no hours) to correct seconds", () => {
    const vtt = `WEBVTT

1
00:05.500 --> 00:10.250
<v Speaker Two>Good morning</v>`;

    const result = parseVTT(vtt);

    expect(result).toHaveLength(1);
    expect(result[0]).toBeDefined();
    const segment = result[0] as Segment;
    expect(segment.start).toBe(5.5);
    expect(segment.end).toBe(10.25);
  });

  it("extracts speaker from <v Speaker Name>text</v> voice tags", () => {
    const vtt = `WEBVTT

1
00:00:01.000 --> 00:00:03.000
<v Alice>Hello there</v>`;

    const result = parseVTT(vtt);

    expect(result).toHaveLength(1);
    expect(result[0]).toBeDefined();
    const segment = result[0] as Segment;
    expect(segment.speaker).toBe("Alice");
  });

  it("extracts speaker from <v Speaker Name>text (no closing </v> tag)", () => {
    const vtt = `WEBVTT

1
00:00:01.000 --> 00:00:03.000
<v Bob>This is text without closing tag`;

    const result = parseVTT(vtt);

    expect(result).toHaveLength(1);
    expect(result[0]).toBeDefined();
    const segment = result[0] as Segment;
    expect(segment.speaker).toBe("Bob");
    expect(segment.text).toContain("This is text without closing tag");
  });

  it("defaults to SPEAKER_00 when no voice tag present", () => {
    const vtt = `WEBVTT

1
00:00:01.000 --> 00:00:03.000
Just plain text without speaker`;

    const result = parseVTT(vtt);

    expect(result).toHaveLength(1);
    expect(result[0]).toBeDefined();
    const segment = result[0] as Segment;
    expect(segment.speaker).toBe("SPEAKER_00");
  });

  it("handles multi-line cue text by joining lines with space", () => {
    const vtt = `WEBVTT

1
00:00:01.000 --> 00:00:05.000
<v Speaker>First line
Second line
Third line</v>`;

    const result = parseVTT(vtt);

    expect(result).toHaveLength(1);
    expect(result[0]).toBeDefined();
    const segment = result[0] as Segment;
    expect(segment.text).toBe("First line Second line Third line");
  });

  it("generates word timing via buildWordsFromText with words array populated", () => {
    const vtt = `WEBVTT

1
00:00:01.000 --> 00:00:05.000
<v Speaker>Hello world test</v>`;

    const result = parseVTT(vtt);

    expect(result).toHaveLength(1);
    expect(result[0]).toBeDefined();
    const segment = result[0] as Segment;
    expect(segment.words).toHaveLength(3);
    expect(segment.words[0]?.word).toBe("Hello");
    expect(segment.words[1]?.word).toBe("world");
    expect(segment.words[2]?.word).toBe("test");
    expect(segment.words[0]?.start).toBe(1);
    expect(segment.words[0]?.end).toBeGreaterThan(1);
  });

  it("returns empty array for VTT with header only (no cues)", () => {
    const vtt = `WEBVTT

NOTE This is just a note`;

    const result = parseVTT(vtt);

    expect(result).toHaveLength(0);
  });

  it("isVTTFormat returns true for strings starting with WEBVTT", () => {
    const vttString = `WEBVTT

1
00:00:01.000 --> 00:00:03.000
Text`;

    const result = isVTTFormat(vttString);

    expect(result).toBe(true);
  });

  it("isVTTFormat returns false for non-VTT strings", () => {
    const jsonString = `{"segments": []}`;

    const result = isVTTFormat(jsonString);

    expect(result).toBe(false);
  });

  it("isVTTFormat returns false for non-string inputs (null, object, number)", () => {
    expect(isVTTFormat(null)).toBe(false);
    expect(isVTTFormat({})).toBe(false);
    expect(isVTTFormat(123)).toBe(false);
    expect(isVTTFormat(undefined)).toBe(false);
  });

  it("strips BOM (\\uFEFF) from input before parsing", () => {
    const vttWithBOM = `\uFEFFWEBVTT

1
00:00:01.000 --> 00:00:03.000
<v Speaker>Text with BOM</v>`;

    const result = parseVTT(vttWithBOM);

    expect(result).toHaveLength(1);
    expect(result[0]).toBeDefined();
    const segment = result[0] as Segment;
    expect(segment.text).toBe("Text with BOM");
  });

  it("skips NOTE blocks without crashing", () => {
    const vtt = `WEBVTT

NOTE
This is a note block
that spans multiple lines

1
00:00:01.000 --> 00:00:03.000
<v Speaker>First cue</v>

NOTE Another note

2
00:00:04.000 --> 00:00:06.000
<v Speaker>Second cue</v>`;

    const result = parseVTT(vtt);

    expect(result).toHaveLength(2);
    expect(result[0]?.text).toBe("First cue");
    expect(result[1]?.text).toBe("Second cue");
  });

  it("skips STYLE blocks without crashing", () => {
    const vtt = `WEBVTT

STYLE
::cue {
  background-image: linear-gradient(to bottom, dimgray, lightgray);
  color: papayawhip;
}

1
00:00:01.000 --> 00:00:03.000
<v Speaker>Styled text</v>`;

    const result = parseVTT(vtt);

    expect(result).toHaveLength(1);
    expect(result[0]?.text).toBe("Styled text");
  });

  it("ignores cue settings/positioning on timestamp line (e.g. align:start position:50%)", () => {
    const vtt = `WEBVTT

1
00:00:01.000 --> 00:00:03.000 align:start position:50%
<v Speaker>Positioned text</v>`;

    const result = parseVTT(vtt);

    expect(result).toHaveLength(1);
    expect(result[0]).toBeDefined();
    const segment = result[0] as Segment;
    expect(segment.text).toBe("Positioned text");
    expect(segment.start).toBe(1);
    expect(segment.end).toBe(3);
  });

  it("sets tags: [] on all imported segments", () => {
    const vtt = `WEBVTT

1
00:00:01.000 --> 00:00:03.000
<v Speaker>First</v>

2
00:00:04.000 --> 00:00:06.000
<v Speaker>Second</v>`;

    const result = parseVTT(vtt);

    expect(result).toHaveLength(2);
    expect(result[0]?.tags).toEqual([]);
    expect(result[1]?.tags).toEqual([]);
  });

  it(`assigns sequential seg-\${index} IDs (seg-0, seg-1, seg-2...)`, () => {
    const vtt = `WEBVTT

1
00:00:01.000 --> 00:00:03.000
<v Speaker>First</v>

2
00:00:04.000 --> 00:00:06.000
<v Speaker>Second</v>

3
00:00:07.000 --> 00:00:09.000
<v Speaker>Third</v>`;

    const result = parseVTT(vtt);

    expect(result).toHaveLength(3);
    expect(result[0]?.id).toBe("seg-0");
    expect(result[1]?.id).toBe("seg-1");
    expect(result[2]?.id).toBe("seg-2");
  });

  it("handles empty cues (timestamps but no text) by skipping them", () => {
    const vtt = `WEBVTT

1
00:00:01.000 --> 00:00:03.000

2
00:00:04.000 --> 00:00:06.000
<v Speaker>Valid text</v>

3
00:00:07.000 --> 00:00:09.000
`;

    const result = parseVTT(vtt);

    expect(result).toHaveLength(1);
    expect(result[0]?.text).toBe("Valid text");
    expect(result[0]?.id).toBe("seg-0");
  });
});

describe("isVTTFormat", () => {
  it("returns true for valid WEBVTT header", () => {
    expect(isVTTFormat("WEBVTT")).toBe(true);
    expect(isVTTFormat("WEBVTT\n\n1\n00:00:01.000 --> 00:00:03.000\nText")).toBe(true);
  });

  it("returns false for strings without WEBVTT header", () => {
    expect(isVTTFormat("INVALID")).toBe(false);
    expect(isVTTFormat("")).toBe(false);
    expect(isVTTFormat("webvtt")).toBe(false);
  });

  it("returns false for non-string types", () => {
    expect(isVTTFormat(null)).toBe(false);
    expect(isVTTFormat(undefined)).toBe(false);
    expect(isVTTFormat({})).toBe(false);
    expect(isVTTFormat([])).toBe(false);
    expect(isVTTFormat(42)).toBe(false);
    expect(isVTTFormat(true)).toBe(false);
  });
});
