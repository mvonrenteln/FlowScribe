import type { StoreApi } from "zustand";
import { buildSessionKey } from "@/lib/fileReference";
import { SPEAKER_COLORS } from "../constants";
import type { StoreContext } from "../context";
import type { Segment, SegmentsSlice, TranscriptStore } from "../types";
import { generateId } from "../utils/id";
import { addToHistory } from "./historySlice";

type StoreSetter = StoreApi<TranscriptStore>["setState"];
type StoreGetter = StoreApi<TranscriptStore>["getState"];

export const createSegmentsSlice = (
  set: StoreSetter,
  get: StoreGetter,
  context: StoreContext,
): SegmentsSlice => ({
  loadTranscript: (data) => {
    const uniqueSpeakers = Array.from(new Set(data.segments.map((s) => s.speaker)));
    const speakers =
      data.speakers ||
      uniqueSpeakers.map((name, i) => ({
        id: generateId(),
        name,
        color: SPEAKER_COLORS[i % SPEAKER_COLORS.length],
      }));

    const segments = data.segments.map((s) => ({
      ...s,
      id: s.id || generateId(),
    }));

    const selectedSegmentId = segments[0]?.id ?? null;

    const sessionKey = buildSessionKey(get().audioRef, data.reference ?? get().transcriptRef);
    const session = context.getSessionsCache()[sessionKey];
    const selectedFromSession =
      session?.selectedSegmentId &&
      session.segments.some((segment) => segment.id === session.selectedSegmentId)
        ? session.selectedSegmentId
        : (session?.segments[0]?.id ?? null);
    if (session && session.segments.length > 0) {
      set({
        segments: session.segments,
        speakers: session.speakers,
        selectedSegmentId: selectedFromSession,
        currentTime: session.currentTime ?? 0,
        isWhisperXFormat: session.isWhisperXFormat ?? false,
        history: [
          {
            segments: session.segments,
            speakers: session.speakers,
            selectedSegmentId: selectedFromSession,
          },
        ],
        historyIndex: 0,
        transcriptRef: data.reference ?? get().transcriptRef,
        sessionKey,
      });
      return;
    }
    set({
      segments,
      speakers,
      selectedSegmentId,
      isWhisperXFormat: data.isWhisperXFormat || false,
      history: [{ segments, speakers, selectedSegmentId }],
      historyIndex: 0,
      transcriptRef: data.reference ?? get().transcriptRef,
      sessionKey,
    });
  },

  setSelectedSegmentId: (id) =>
    set((state) => {
      if (state.historyIndex < 0) {
        return { selectedSegmentId: id };
      }
      const history = [...state.history];
      const current = history[state.historyIndex];
      if (!current) {
        return { selectedSegmentId: id };
      }
      history[state.historyIndex] = { ...current, selectedSegmentId: id };
      return { selectedSegmentId: id, history };
    }),

  updateSegmentText: (id, text) => {
    const { segments, speakers, history, historyIndex, selectedSegmentId } = get();
    const segment = segments.find((s) => s.id === id);
    if (!segment || segment.text === text) return;
    const normalizedText = text.trim();
    const nextWordTexts = normalizedText.split(/\s+/).filter((word) => word.length > 0);
    const prevWords = segment.words;

    const buildDefaultWords = () => {
      const segDuration = segment.end - segment.start;
      const wordDuration = nextWordTexts.length > 0 ? segDuration / nextWordTexts.length : 0;
      return nextWordTexts.map((word, index) => ({
        word,
        start: segment.start + index * wordDuration,
        end: segment.start + (index + 1) * wordDuration,
        speaker: segment.speaker,
        score: 1,
      }));
    };

    const findMatches = (prevText: string[], nextText: string[]) => {
      const rows = prevText.length + 1;
      const cols = nextText.length + 1;
      const table = Array.from({ length: rows }, () => Array(cols).fill(0));
      for (let i = prevText.length - 1; i >= 0; i -= 1) {
        for (let j = nextText.length - 1; j >= 0; j -= 1) {
          if (prevText[i] === nextText[j]) {
            table[i][j] = table[i + 1][j + 1] + 1;
          } else {
            table[i][j] = Math.max(table[i + 1][j], table[i][j + 1]);
          }
        }
      }

      const matches: Array<{ oldIndex: number; newIndex: number }> = [];
      let i = 0;
      let j = 0;
      while (i < prevText.length && j < nextText.length) {
        if (prevText[i] === nextText[j]) {
          matches.push({ oldIndex: i, newIndex: j });
          i += 1;
          j += 1;
        } else if (table[i + 1][j] >= table[i][j + 1]) {
          i += 1;
        } else {
          j += 1;
        }
      }
      return matches;
    };

    const buildWordsWithPreservedTiming = () => {
      if (prevWords.length === 0 || nextWordTexts.length === 0) {
        return buildDefaultWords();
      }

      const prevText = prevWords.map((word) => word.word);
      const matches = findMatches(prevText, nextWordTexts);
      const updated: typeof prevWords = [];

      const addRegion = (oldStart: number, oldEnd: number, newStart: number, newEnd: number) => {
        const regionWords = nextWordTexts.slice(newStart, newEnd);
        if (regionWords.length === 0) return;

        let regionStart = segment.start;
        let regionEnd = segment.end;

        if (oldEnd > oldStart) {
          regionStart = prevWords[oldStart].start;
          regionEnd = prevWords[oldEnd - 1].end;
        } else {
          const prevWord = oldStart > 0 ? prevWords[oldStart - 1] : null;
          const nextWord = oldEnd < prevWords.length ? prevWords[oldEnd] : null;
          if (prevWord && nextWord) {
            regionStart = prevWord.end;
            regionEnd = nextWord.start;
          } else if (prevWord) {
            regionStart = prevWord.end;
            regionEnd = segment.end;
          } else if (nextWord) {
            regionStart = segment.start;
            regionEnd = nextWord.start;
          }
        }

        if (regionEnd < regionStart) {
          regionEnd = regionStart;
        }

        const duration = regionEnd - regionStart;
        const step = regionWords.length > 0 ? duration / regionWords.length : 0;
        regionWords.forEach((word, index) => {
          const start = regionStart + index * step;
          const end = regionStart + (index + 1) * step;
          updated.push({
            word,
            start,
            end: end < start ? start : end,
            speaker: segment.speaker,
            score: 1,
          });
        });
      };

      let prevIndex = 0;
      let nextIndex = 0;
      matches.forEach((match) => {
        addRegion(prevIndex, match.oldIndex, nextIndex, match.newIndex);
        const matchedPrev = prevWords[match.oldIndex];
        updated.push({
          ...matchedPrev,
          word: nextWordTexts[match.newIndex],
        });
        prevIndex = match.oldIndex + 1;
        nextIndex = match.newIndex + 1;
      });
      addRegion(prevIndex, prevWords.length, nextIndex, nextWordTexts.length);

      return updated;
    };

    const words = buildWordsWithPreservedTiming();
    const newSegments = segments.map((s) =>
      s.id === id ? { ...s, text: normalizedText, words } : s,
    );
    const nextHistory = addToHistory(history, historyIndex, {
      segments: newSegments,
      speakers,
      selectedSegmentId,
    });
    set({
      segments: newSegments,
      history: nextHistory.history,
      historyIndex: nextHistory.historyIndex,
    });
  },

  updateSegmentSpeaker: (id, speaker) => {
    const { segments, speakers, history, historyIndex, selectedSegmentId } = get();
    const segment = segments.find((s) => s.id === id);
    if (!segment || segment.speaker === speaker) return;
    const newSegments = segments.map((s) => (s.id === id ? { ...s, speaker } : s));
    const nextHistory = addToHistory(history, historyIndex, {
      segments: newSegments,
      speakers,
      selectedSegmentId,
    });
    set({
      segments: newSegments,
      history: nextHistory.history,
      historyIndex: nextHistory.historyIndex,
    });
  },

  confirmSegment: (id) => {
    const { segments, speakers, history, historyIndex, selectedSegmentId } = get();
    const segment = segments.find((s) => s.id === id);
    if (!segment) return;
    const updatedWords = segment.words.map((word) => ({ ...word, score: 1 }));
    const newSegments = segments.map((s) =>
      s.id === id ? { ...s, words: updatedWords, confirmed: true } : s,
    );
    const nextHistory = addToHistory(history, historyIndex, {
      segments: newSegments,
      speakers,
      selectedSegmentId,
    });
    set({
      segments: newSegments,
      history: nextHistory.history,
      historyIndex: nextHistory.historyIndex,
    });
  },

  toggleSegmentBookmark: (id) => {
    const { segments, speakers, history, historyIndex, selectedSegmentId } = get();
    const segment = segments.find((s) => s.id === id);
    if (!segment) return;
    const newSegments = segments.map((s) =>
      s.id === id ? { ...s, bookmarked: !s.bookmarked } : s,
    );
    const nextHistory = addToHistory(history, historyIndex, {
      segments: newSegments,
      speakers,
      selectedSegmentId,
    });
    set({
      segments: newSegments,
      history: nextHistory.history,
      historyIndex: nextHistory.historyIndex,
    });
  },

  splitSegment: (id, wordIndex) => {
    const { segments, speakers, history, historyIndex } = get();
    const segmentIndex = segments.findIndex((s) => s.id === id);
    if (segmentIndex === -1) return;

    const segment = segments[segmentIndex];
    if (wordIndex <= 0 || wordIndex >= segment.words.length) return;

    const firstWords = segment.words.slice(0, wordIndex);
    const secondWords = segment.words.slice(wordIndex);

    const firstSegment: Segment = {
      id: generateId(),
      speaker: segment.speaker,
      start: segment.start,
      end: firstWords[firstWords.length - 1].end,
      text: firstWords.map((w) => w.word).join(" "),
      words: firstWords,
    };

    const secondSegment: Segment = {
      id: generateId(),
      speaker: segment.speaker,
      start: secondWords[0].start,
      end: segment.end,
      text: secondWords.map((w) => w.word).join(" "),
      words: secondWords,
    };

    const newSegments = [
      ...segments.slice(0, segmentIndex),
      firstSegment,
      secondSegment,
      ...segments.slice(segmentIndex + 1),
    ];

    const nextHistory = addToHistory(history, historyIndex, {
      segments: newSegments,
      speakers,
      selectedSegmentId: secondSegment.id,
    });
    set({
      segments: newSegments,
      selectedSegmentId: secondSegment.id,
      currentTime: secondSegment.start,
      seekRequestTime: secondSegment.start,
      history: nextHistory.history,
      historyIndex: nextHistory.historyIndex,
    });
  },

  mergeSegments: (id1, id2) => {
    const { segments, speakers, history, historyIndex } = get();
    const index1 = segments.findIndex((s) => s.id === id1);
    const index2 = segments.findIndex((s) => s.id === id2);

    if (index1 === -1 || index2 === -1) return null;
    if (Math.abs(index1 - index2) !== 1) return null;

    const [first, second] =
      index1 < index2 ? [segments[index1], segments[index2]] : [segments[index2], segments[index1]];

    const merged: Segment = {
      id: generateId(),
      speaker: first.speaker,
      start: first.start,
      end: second.end,
      text: `${first.text} ${second.text}`,
      words: [...first.words, ...second.words],
    };

    const minIndex = Math.min(index1, index2);
    const newSegments = [
      ...segments.slice(0, minIndex),
      merged,
      ...segments.slice(Math.max(index1, index2) + 1),
    ];

    const nextHistory = addToHistory(history, historyIndex, {
      segments: newSegments,
      speakers,
      selectedSegmentId: merged.id,
    });
    set({
      segments: newSegments,
      selectedSegmentId: merged.id,
      history: nextHistory.history,
      historyIndex: nextHistory.historyIndex,
    });
    return merged.id;
  },

  updateSegmentTiming: (id, start, end) => {
    const { segments, speakers, history, historyIndex, selectedSegmentId } = get();
    const segment = segments.find((s) => s.id === id);
    if (!segment || (segment.start === start && segment.end === end)) return;
    const newSegments = segments.map((s) => (s.id === id ? { ...s, start, end } : s));
    const nextHistory = addToHistory(history, historyIndex, {
      segments: newSegments,
      speakers,
      selectedSegmentId,
    });
    set({
      segments: newSegments,
      history: nextHistory.history,
      historyIndex: nextHistory.historyIndex,
    });
  },

  deleteSegment: (id) => {
    const { segments, speakers, history, historyIndex, selectedSegmentId } = get();
    const newSegments = segments.filter((s) => s.id !== id);
    if (newSegments.length === segments.length) return;
    const nextHistory = addToHistory(history, historyIndex, {
      segments: newSegments,
      speakers,
      selectedSegmentId,
    });
    set({
      segments: newSegments,
      history: nextHistory.history,
      historyIndex: nextHistory.historyIndex,
    });
  },
});
