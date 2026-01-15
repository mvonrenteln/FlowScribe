import type { StoreApi } from "zustand";
import { buildSessionKey } from "@/lib/fileReference";
import { SPEAKER_COLORS } from "../constants";
import type { StoreContext } from "../context";
import type { Segment, SegmentsSlice, TranscriptStore } from "../types";
import { generateId } from "../utils/id";
import { applyTextUpdateToSegment } from "../utils/segmentText";
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

    // If incoming segments include `tags` as names (from WhisperX import),
    // create new Tag objects with random ids for each unique name and map
    // segment.tag names -> ids. Imported tags are session-local.
    const incomingTagNames = new Set<string>();
    for (const s of data.segments) {
      const raw = s as unknown as { tags?: unknown };
      const tagsField = raw.tags;
      if (Array.isArray(tagsField)) {
        for (const name of tagsField) {
          if (typeof name === "string" && name.trim() !== "") {
            incomingTagNames.add(name.trim());
          }
        }
      }
    }

    const importedTags = Array.from(incomingTagNames).map((name, i) => ({
      id: crypto.randomUUID(),
      name: name.trim(),
      color: SPEAKER_COLORS[i % SPEAKER_COLORS.length],
    }));

    const nameToId = new Map(importedTags.map((t) => [t.name, t.id]));

    const segments: Segment[] = data.segments.map((s) => {
      const base = s as unknown as Segment;
      const id = base.id || generateId();
      const tagsField = (base as unknown as { tags?: unknown }).tags;
      const tags = Array.isArray(tagsField)
        ? (tagsField as unknown[]).map((n) => {
            const str = (n || "").toString().trim();
            return nameToId.get(str) || str;
          })
        : [];

      return {
        ...base,
        id,
        tags,
      };
    });

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
        tags: session.tags ?? [],
        selectedSegmentId: selectedFromSession,
        currentTime: session.currentTime ?? 0,
        isWhisperXFormat: session.isWhisperXFormat ?? false,
        history: [
          {
            segments: session.segments,
            speakers: session.speakers,
            tags: session.tags ?? [],
            selectedSegmentId: selectedFromSession,
            currentTime: session.currentTime ?? 0,
          },
        ],
        historyIndex: 0,
        transcriptRef: data.reference ?? get().transcriptRef,
        sessionKey,
        sessionKind: session?.kind ?? "current",
        sessionLabel: session?.label ?? null,
        baseSessionKey: session?.baseSessionKey ?? null,
      });
      return;
    }
    set({
      segments,
      speakers,
      tags: importedTags,
      selectedSegmentId,
      isWhisperXFormat: data.isWhisperXFormat || false,
      history: [{ segments, speakers, tags: importedTags, selectedSegmentId, currentTime: 0 }],
      historyIndex: 0,
      transcriptRef: data.reference ?? get().transcriptRef,
      sessionKey,
      sessionKind: "current",
      sessionLabel: data.reference?.name ?? null,
      baseSessionKey: null,
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
      history[state.historyIndex] = {
        ...current,
        selectedSegmentId: id,
        currentTime: state.currentTime,
      };
      return { selectedSegmentId: id, history };
    }),

  updateSegmentText: (id, text) => {
    const { updateSegmentsTexts } = get();
    updateSegmentsTexts([{ id, text }]);
  },

  updateSegmentsTexts: (updates) => {
    const { segments, speakers, tags, history, historyIndex, selectedSegmentId, currentTime } =
      get();
    const currentSegments = [...segments];
    let changed = false;

    for (const update of updates) {
      const segmentIndex = currentSegments.findIndex((s) => s.id === update.id);
      if (segmentIndex === -1) continue;

      const segment = currentSegments[segmentIndex];
      if (segment.text === update.text) continue;

      const updatedSegment = applyTextUpdateToSegment(segment, update.text);
      if (!updatedSegment) continue;

      currentSegments[segmentIndex] = updatedSegment;
      changed = true;
    }

    if (!changed) return;

    const nextHistory = addToHistory(history, historyIndex, {
      segments: currentSegments,
      speakers,
      tags,
      selectedSegmentId,
      currentTime,
    });
    set({
      segments: currentSegments,
      history: nextHistory.history,
      historyIndex: nextHistory.historyIndex,
    });
  },

  updateSegmentSpeaker: (id, speaker) => {
    const { segments, speakers, tags, history, historyIndex, selectedSegmentId, currentTime } =
      get();
    const segment = segments.find((s) => s.id === id);
    if (!segment || segment.speaker === speaker) return;
    const newSegments = segments.map((s) => (s.id === id ? { ...s, speaker } : s));
    const nextHistory = addToHistory(history, historyIndex, {
      segments: newSegments,
      speakers,
      tags,
      selectedSegmentId,
      currentTime,
    });
    set({
      segments: newSegments,
      history: nextHistory.history,
      historyIndex: nextHistory.historyIndex,
    });
  },

  confirmSegment: (id) => {
    const { segments, speakers, tags, history, historyIndex, selectedSegmentId, currentTime } =
      get();
    const segment = segments.find((s) => s.id === id);
    if (!segment) return;
    const updatedWords = segment.words.map((word) => ({ ...word, score: 1 }));
    const newSegments = segments.map((s) =>
      s.id === id ? { ...s, words: updatedWords, confirmed: true } : s,
    );
    const nextHistory = addToHistory(history, historyIndex, {
      segments: newSegments,
      speakers,
      tags,
      selectedSegmentId,
      currentTime,
    });
    set({
      segments: newSegments,
      history: nextHistory.history,
      historyIndex: nextHistory.historyIndex,
    });
  },

  toggleSegmentBookmark: (id) => {
    const { segments, speakers, tags, history, historyIndex, selectedSegmentId, currentTime } =
      get();
    const segment = segments.find((s) => s.id === id);
    if (!segment) return;
    const newSegments = segments.map((s) =>
      s.id === id ? { ...s, bookmarked: !s.bookmarked } : s,
    );
    const nextHistory = addToHistory(history, historyIndex, {
      segments: newSegments,
      speakers,
      tags,
      selectedSegmentId,
      currentTime,
    });
    set({
      segments: newSegments,
      history: nextHistory.history,
      historyIndex: nextHistory.historyIndex,
    });
  },

  splitSegment: (id, wordIndex) => {
    const { segments, speakers, tags, history, historyIndex } = get();
    const segmentIndex = segments.findIndex((s) => s.id === id);
    if (segmentIndex === -1) return;

    const segment = segments[segmentIndex];
    if (wordIndex <= 0 || wordIndex >= segment.words.length) return;

    const firstWords = segment.words.slice(0, wordIndex);
    const secondWords = segment.words.slice(wordIndex);

    const firstSegment: Segment = {
      id: generateId(),
      speaker: segment.speaker,
      tags: segment.tags,
      start: segment.start,
      end: firstWords[firstWords.length - 1].end,
      text: firstWords.map((w) => w.word).join(" "),
      words: firstWords,
    };

    const secondSegment: Segment = {
      id: generateId(),
      speaker: segment.speaker,
      tags: segment.tags,
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
      tags,
      selectedSegmentId: secondSegment.id,
      currentTime: secondSegment.start,
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
    const { segments, speakers, tags, history, historyIndex, currentTime } = get();
    const index1 = segments.findIndex((s) => s.id === id1);
    const index2 = segments.findIndex((s) => s.id === id2);

    if (index1 === -1 || index2 === -1) return null;
    if (Math.abs(index1 - index2) !== 1) return null;

    const [first, second] =
      index1 < index2 ? [segments[index1], segments[index2]] : [segments[index2], segments[index1]];

    const merged: Segment = {
      id: generateId(),
      speaker: first.speaker,
      tags: Array.from(new Set([...first.tags, ...second.tags])),
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
      tags,
      selectedSegmentId: merged.id,
      currentTime,
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
    const { segments, speakers, tags, history, historyIndex, selectedSegmentId, currentTime } =
      get();
    const segment = segments.find((s) => s.id === id);
    if (!segment || (segment.start === start && segment.end === end)) return;
    const newSegments = segments.map((s) => (s.id === id ? { ...s, start, end } : s));
    const nextHistory = addToHistory(history, historyIndex, {
      segments: newSegments,
      speakers,
      tags,
      selectedSegmentId,
      currentTime,
    });
    set({
      segments: newSegments,
      history: nextHistory.history,
      historyIndex: nextHistory.historyIndex,
    });
  },

  deleteSegment: (id) => {
    const { segments, speakers, tags, history, historyIndex, selectedSegmentId, currentTime } =
      get();
    const newSegments = segments.filter((s) => s.id !== id);
    if (newSegments.length === segments.length) return;
    const nextHistory = addToHistory(history, historyIndex, {
      segments: newSegments,
      speakers,
      tags,
      selectedSegmentId,
      currentTime,
    });
    set({
      segments: newSegments,
      history: nextHistory.history,
      historyIndex: nextHistory.historyIndex,
    });
  },
});
