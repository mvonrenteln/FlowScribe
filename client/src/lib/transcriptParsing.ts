import type { Segment } from "@/lib/store";
import type { TranscriptImportTag } from "@/lib/store/types";
import type { Chapter } from "@/types/chapter";

export interface WhisperSegment {
  timestamp: [number, number];
  text: string;
}

export interface WhisperXWord {
  word: string;
  start: number;
  end: number;
  score?: number;
}

export interface WhisperXSegment {
  id?: string;
  speaker?: string;
  start: number;
  end: number;
  text: string;
  words?: WhisperXWord[];
  tags?: string[];
}

export const isWhisperFormat = (data: unknown): data is WhisperSegment[] => {
  return Array.isArray(data) && data.length > 0 && "timestamp" in data[0];
};

export const isWhisperXFormat = (data: unknown): data is { segments: WhisperXSegment[] } => {
  return typeof data === "object" && data !== null && "segments" in data;
};

const buildWordsFromText = (
  text: string,
  start: number,
  end: number,
): Array<{ word: string; start: number; end: number }> => {
  const wordsArray = text.split(/\s+/).filter((word) => word.length > 0);
  const segDuration = end - start;
  const wordDuration = wordsArray.length > 0 ? segDuration / wordsArray.length : segDuration;

  return wordsArray.map((word, index) => ({
    word,
    start: start + index * wordDuration,
    end: start + (index + 1) * wordDuration,
  }));
};

export const buildSegmentsFromWhisper = (data: WhisperSegment[]): Segment[] => {
  return data.map((segment, index) => {
    const start = segment.timestamp[0];
    const end = segment.timestamp[1];
    const text = segment.text.trim();

    return {
      id: `seg-${index}`,
      speaker: "SPEAKER_00",
      tags: [],
      start,
      end,
      text,
      words: buildWordsFromText(text, start, end),
    };
  });
};

export const buildSegmentsFromWhisperX = (data: { segments: WhisperXSegment[] }): Segment[] => {
  return data.segments.map((segment, index) => ({
    id: segment.id || `seg-${index}`,
    speaker: segment.speaker || "SPEAKER_00",
    tags: Array.isArray(segment.tags)
      ? segment.tags.map((t) => (typeof t === "string" ? t : String(t)))
      : [],
    start: segment.start,
    end: segment.end,
    text: segment.text.trim(),
    words:
      segment.words?.map((word) => ({
        word: word.word,
        start: word.start,
        end: word.end,
        score: typeof word.score === "number" ? word.score : undefined,
      })) || buildWordsFromText(segment.text.trim(), segment.start, segment.end),
  }));
};

/** Matches both HH:MM:SS.mmm and MM:SS.mmm VTT timestamp ranges, capturing start/end. */
const VTT_TIMESTAMP_RE =
  /(\d{1,2}:\d{2}:\d{2}\.\d{3}|\d{2}:\d{2}\.\d{3})\s+-->\s+(\d{1,2}:\d{2}:\d{2}\.\d{3}|\d{2}:\d{2}\.\d{3})/;

function parseVTTTimestamp(ts: string): number {
  const parts = ts.split(":");
  if (parts.length === 3) {
    const hours = parseInt(parts[0] ?? "0", 10);
    const minutes = parseInt(parts[1] ?? "0", 10);
    const secPart = parts[2] ?? "0.000";
    const dotIdx = secPart.indexOf(".");
    const seconds = parseInt(secPart.slice(0, dotIdx), 10);
    const ms = parseInt(secPart.slice(dotIdx + 1), 10);
    return hours * 3600 + minutes * 60 + seconds + ms / 1000;
  }
  const minutes = parseInt(parts[0] ?? "0", 10);
  const secPart = parts[1] ?? "0.000";
  const dotIdx = secPart.indexOf(".");
  const seconds = parseInt(secPart.slice(0, dotIdx), 10);
  const ms = parseInt(secPart.slice(dotIdx + 1), 10);
  return minutes * 60 + seconds + ms / 1000;
}

function extractSpeakerAndText(rawText: string): { speaker: string; text: string } {
  const voiceMatch = /<v ([^>]+)>([\s\S]*?)(?:<\/v>|$)/.exec(rawText);
  if (voiceMatch) {
    const speaker = (voiceMatch[1] ?? "").trim() || "SPEAKER_00";
    const text = (voiceMatch[2] ?? "")
      .replace(/<v [^>]*>/g, "")
      .replace(/<\/v>/g, "")
      .trim();
    return { speaker, text };
  }
  const text = rawText
    .replace(/<v [^>]*>/g, "")
    .replace(/<\/v>/g, "")
    .trim();
  return { speaker: "SPEAKER_00", text };
}

/**
 * Returns true when `data` is a string whose content (after BOM and whitespace
 * stripping) begins with the mandatory "WEBVTT" header.
 */
export function isVTTFormat(data: unknown): boolean {
  if (typeof data !== "string") return false;
  return data
    .replace(/^\uFEFF/, "")
    .trimStart()
    .startsWith("WEBVTT");
}

/**
 * Parses a WebVTT string into Segments.
 *
 * Strips BOM, validates the WEBVTT header, skips NOTE/STYLE/REGION blocks,
 * supports HH:MM:SS.mmm and MM:SS.mmm timestamps, extracts speakers from
 * `<v Name>` voice tags (defaults to "SPEAKER_00"), and assigns sequential
 * "seg-N" IDs only to non-empty cues.
 */
export function parseVTT(text: string): Segment[] {
  const normalized = text.replace(/^\uFEFF/, "").replace(/\r\n/g, "\n");

  if (!normalized.trimStart().startsWith("WEBVTT")) {
    return [];
  }

  const lines = normalized.split("\n");
  const blocks: string[][] = [];
  let currentBlock: string[] = [];

  for (const line of lines) {
    if (line.trim() === "") {
      if (currentBlock.length > 0) {
        blocks.push(currentBlock);
        currentBlock = [];
      }
    } else {
      currentBlock.push(line);
    }
  }
  if (currentBlock.length > 0) {
    blocks.push(currentBlock);
  }

  const segments: Segment[] = [];

  for (const block of blocks) {
    if (block.length === 0) continue;
    const firstLine = block[0] ?? "";

    if (firstLine.startsWith("WEBVTT")) continue;
    if (firstLine.startsWith("NOTE")) continue;
    if (firstLine.startsWith("STYLE")) continue;
    if (firstLine.startsWith("REGION")) continue;

    let timestampIdx = -1;
    for (let i = 0; i < block.length; i++) {
      if (VTT_TIMESTAMP_RE.test(block[i] ?? "")) {
        timestampIdx = i;
        break;
      }
    }

    if (timestampIdx === -1) continue;

    const timestampLine = block[timestampIdx] ?? "";
    const tsMatch = VTT_TIMESTAMP_RE.exec(timestampLine);
    if (!tsMatch) continue;

    const ts1 = tsMatch[1];
    const ts2 = tsMatch[2];
    if (!ts1 || !ts2) continue;

    const start = parseVTTTimestamp(ts1);
    const end = parseVTTTimestamp(ts2);

    const textLines = block.slice(timestampIdx + 1);
    if (textLines.length === 0) continue;

    const rawText = textLines.join(" ");
    if (rawText.trim() === "") continue;

    const { speaker, text } = extractSpeakerAndText(rawText);
    if (text === "") continue;

    segments.push({
      id: `seg-${segments.length}`,
      speaker,
      tags: [],
      start,
      end,
      text,
      words: buildWordsFromText(text, start, end),
    });
  }

  return segments;
}

export const parseTranscriptData = (
  data: unknown,
): {
  segments: Segment[];
  isWhisperXFormat: boolean;
  tags?: TranscriptImportTag[];
  chapters?: Chapter[];
} | null => {
  if (typeof data === "string" && isVTTFormat(data)) {
    return { segments: parseVTT(data), isWhisperXFormat: false };
  }

  if (isWhisperFormat(data)) {
    return { segments: buildSegmentsFromWhisper(data), isWhisperXFormat: false };
  }

  if (isWhisperXFormat(data)) {
    const parsed = data as { tags?: unknown; chapters?: unknown };
    return {
      segments: buildSegmentsFromWhisperX(data),
      isWhisperXFormat: true,
      tags: Array.isArray(parsed.tags) ? (parsed.tags as TranscriptImportTag[]) : undefined,
      chapters: Array.isArray(parsed.chapters) ? (parsed.chapters as Chapter[]) : undefined,
    };
  }

  return null;
};
