import type { Segment } from "@/lib/store";

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
  speaker?: string;
  start: number;
  end: number;
  text: string;
  words?: WhisperXWord[];
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
      start,
      end,
      text,
      words: buildWordsFromText(text, start, end),
    };
  });
};

export const buildSegmentsFromWhisperX = (data: { segments: WhisperXSegment[] }): Segment[] => {
  return data.segments.map((segment, index) => ({
    id: `seg-${index}`,
    speaker: segment.speaker || "SPEAKER_00",
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

export const parseTranscriptData = (
  data: unknown,
): { segments: Segment[]; isWhisperXFormat: boolean } | null => {
  if (isWhisperFormat(data)) {
    return { segments: buildSegmentsFromWhisper(data), isWhisperXFormat: false };
  }

  if (isWhisperXFormat(data)) {
    return { segments: buildSegmentsFromWhisperX(data), isWhisperXFormat: true };
  }

  return null;
};
