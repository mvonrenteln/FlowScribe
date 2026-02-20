import type { StoreApi } from "zustand";
import { indexById } from "@/lib/arrayUtils";
import { buildSessionKey } from "@/lib/fileReference";
import { clearWordsIndexCache } from "@/lib/utils/wordIndexCache";
import type { Chapter } from "@/types/chapter";
import { SPEAKER_COLORS } from "../constants";
import type { StoreContext } from "../context";
import type { Segment, SegmentsSlice, TranscriptImportTag, TranscriptStore } from "../types";
import { memoizedBuildSegmentIndexMap, sortChaptersByStart } from "../utils/chapters";
import { generateId } from "../utils/id";
import { applyTextUpdateToSegment } from "../utils/segmentText";
import { addToHistory } from "./historySlice";

type StoreSetter = StoreApi<TranscriptStore>["setState"];
type StoreGetter = StoreApi<TranscriptStore>["getState"];

type ChapterReplacement =
  | string
  | {
      start?: string;
      end?: string;
    };

/**
 * Remove AI suggestions that reference deleted/merged segment ids.
 */
const pruneAISuggestionsForRemovedSegments = (
  state: Pick<
    TranscriptStore,
    | "aiSpeakerSuggestions"
    | "aiRevisionSuggestions"
    | "aiSegmentMergeSuggestions"
    | "aiChapterDetectionSuggestions"
  >,
  removedIds: Set<string>,
) => ({
  aiSpeakerSuggestions: state.aiSpeakerSuggestions.filter((s) => !removedIds.has(s.segmentId)),
  aiRevisionSuggestions: state.aiRevisionSuggestions.filter((s) => !removedIds.has(s.segmentId)),
  aiSegmentMergeSuggestions: state.aiSegmentMergeSuggestions.filter(
    (s) => !s.segmentIds.some((id) => removedIds.has(id)),
  ),
  aiChapterDetectionSuggestions: state.aiChapterDetectionSuggestions.filter(
    (s) => !removedIds.has(s.startSegmentId) && !removedIds.has(s.endSegmentId),
  ),
});

/**
 * Remap chapter segment ids after segment operations (split/merge/delete)
 * and filter out chapters that no longer reference valid segments.
 */
function remapAndFilterChapters(
  chapters: Chapter[] | undefined | null,
  replacements: Record<string, ChapterReplacement>,
  validSegments: Segment[],
): Chapter[] {
  if (!chapters || chapters.length === 0) return [];
  const validIds = new Set(validSegments.map((s) => s.id));
  return chapters
    .map((ch) => {
      if (!ch) return ch;
      let changed = false;
      const next: Chapter = { ...ch };
      for (const [oldId, rep] of Object.entries(replacements)) {
        if (next.startSegmentId === oldId) {
          if (typeof rep === "string") next.startSegmentId = rep;
          else if (rep.start) next.startSegmentId = rep.start;
          changed = true;
        }
        if (next.endSegmentId === oldId) {
          if (typeof rep === "string") next.endSegmentId = rep;
          else if (rep.end) next.endSegmentId = rep.end;
          changed = true;
        }
      }
      return changed ? next : ch;
    })
    .filter(
      (ch): ch is Chapter =>
        Boolean(ch) && validIds.has(ch.startSegmentId) && validIds.has(ch.endSegmentId),
    );
}

/**
 * Resolve the chapter id for a segment using dynamic chapter boundaries
 * (chapter start -> next chapter start - 1).
 */
const getChapterIdForSegment = (
  segmentId: string | null,
  chapters: Chapter[],
  segments: Segment[],
): string | null => {
  if (!segmentId || chapters.length === 0 || segments.length === 0) return null;

  const indexById = memoizedBuildSegmentIndexMap(segments);
  const segmentIndex = indexById.get(segmentId);
  if (segmentIndex === undefined) return null;

  const ordered = sortChaptersByStart(chapters, indexById);
  for (let i = 0; i < ordered.length; i += 1) {
    const chapter = ordered[i];
    const chapterStartIndex = indexById.get(chapter.startSegmentId);
    if (chapterStartIndex === undefined) continue;

    const nextChapter = ordered[i + 1];
    const nextStartIndex = nextChapter ? indexById.get(nextChapter.startSegmentId) : undefined;
    const chapterEndIndex =
      nextStartIndex !== undefined ? nextStartIndex - 1 : Math.max(0, segments.length - 1);

    if (segmentIndex >= chapterStartIndex && segmentIndex <= chapterEndIndex) {
      return chapter.id;
    }
  }

  return null;
};

export const createSegmentsSlice = (
  set: StoreSetter,
  get: StoreGetter,
  context: StoreContext,
): SegmentsSlice => ({
  loadTranscript: (data) => {
    const confidenceScoresVersion = get().confidenceScoresVersion + 1;
    const uniqueSpeakers = Array.from(new Set(data.segments.map((s) => s.speaker)));
    const speakers =
      data.speakers ||
      uniqueSpeakers.map((name, i) => ({
        id: generateId(),
        name,
        color: SPEAKER_COLORS[i % SPEAKER_COLORS.length],
      }));

    // If incoming segments include `tags` as names (from WhisperX/JSON import),
    // create new Tag objects with random ids for each unique name and map
    // segment.tag names -> ids. Imported tags are session-local.
    const incomingTagNames: string[] = [];
    const incomingTagColors = new Map<string, string>();
    const seenTagNames = new Set<string>();

    const addTagName = (name: string, color?: string) => {
      const normalized = name.trim();
      if (!normalized) return;
      if (color && !incomingTagColors.has(normalized)) {
        incomingTagColors.set(normalized, color);
      }
      if (seenTagNames.has(normalized)) return;
      seenTagNames.add(normalized);
      incomingTagNames.push(normalized);
    };

    if (Array.isArray(data.tags)) {
      for (const tag of data.tags as TranscriptImportTag[]) {
        if (typeof tag === "string") {
          addTagName(tag);
          continue;
        }
        if (tag && typeof tag === "object" && typeof tag.name === "string") {
          addTagName(tag.name, typeof tag.color === "string" ? tag.color : undefined);
        }
      }
    }

    for (const s of data.segments) {
      const raw = s as unknown as { tags?: unknown };
      const tagsField = raw.tags;
      if (Array.isArray(tagsField)) {
        for (const name of tagsField) {
          if (typeof name === "string") {
            addTagName(name);
          } else if (name != null) {
            addTagName(String(name));
          }
        }
      }
    }

    if (Array.isArray(data.chapters)) {
      for (const chapter of data.chapters) {
        const tagsField = chapter?.tags;
        if (!Array.isArray(tagsField)) continue;
        for (const name of tagsField) {
          if (typeof name === "string") {
            addTagName(name);
          } else if (name != null) {
            addTagName(String(name));
          }
        }
      }
    }

    let fallbackColorIndex = 0;
    const importedTags = incomingTagNames.map((name) => ({
      id: crypto.randomUUID(),
      name,
      color:
        incomingTagColors.get(name) ?? SPEAKER_COLORS[fallbackColorIndex++ % SPEAKER_COLORS.length],
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

    const chapters: Chapter[] = Array.isArray(data.chapters)
      ? data.chapters.map((chapter) => ({
          ...chapter,
          id: chapter.id || generateId(),
          tags: Array.isArray(chapter.tags)
            ? chapter.tags.map((tag) => {
                const str = (tag || "").toString().trim();
                return nameToId.get(str) || str;
              })
            : [],
        }))
      : [];

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
        chapters: session.chapters ?? [],
        selectedSegmentId: selectedFromSession,
        selectedChapterId: session.selectedChapterId ?? null,
        currentTime: session.currentTime ?? 0,
        isWhisperXFormat: session.isWhisperXFormat ?? false,
        history: [
          {
            segments: session.segments,
            speakers: session.speakers,
            tags: session.tags ?? [],
            chapters: session.chapters ?? [],
            selectedSegmentId: selectedFromSession,
            selectedChapterId: session.selectedChapterId ?? null,
            currentTime: session.currentTime ?? 0,
            confidenceScoresVersion,
          },
        ],
        historyIndex: 0,
        confidenceScoresVersion,
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
      chapters,
      selectedSegmentId,
      selectedChapterId: null,
      isWhisperXFormat: data.isWhisperXFormat || false,
      history: [
        {
          segments,
          speakers,
          tags: importedTags,
          chapters,
          selectedSegmentId,
          selectedChapterId: null,
          currentTime: 0,
          confidenceScoresVersion,
        },
      ],
      historyIndex: 0,
      confidenceScoresVersion,
      transcriptRef: data.reference ?? get().transcriptRef,
      sessionKey,
      sessionKind: "current",
      sessionLabel: data.reference?.name ?? null,
      baseSessionKey: null,
    });
  },

  setSelectedSegmentId: (id) =>
    set((state) => {
      const selectedChapterId = getChapterIdForSegment(id, state.chapters, state.segments);
      if (state.historyIndex < 0) {
        return { selectedSegmentId: id, selectedChapterId };
      }
      const history = [...state.history];
      const current = history[state.historyIndex];
      if (!current) {
        return { selectedSegmentId: id, selectedChapterId };
      }
      history[state.historyIndex] = {
        ...current,
        selectedSegmentId: id,
        selectedChapterId,
        currentTime: state.currentTime,
      };
      return { selectedSegmentId: id, selectedChapterId, history };
    }),

  setFilteredSegmentIds: (ids, filtersActive) => {
    const nextFiltersActive = Boolean(filtersActive);
    // When filters are not active, we intentionally ignore `ids` and clear the
    // filtered set. The effective filtered IDs depend on `filtersActive`, not
    // just the `ids` array passed into this function.
    const next = nextFiltersActive ? new Set(ids) : new Set<string>();
    const current = get().filteredSegmentIds;
    const currentFiltersActive = get().filtersActive;

    // Skip update if sets are equal (shallow equality check)
    if (
      currentFiltersActive === nextFiltersActive &&
      current.size === next.size &&
      Array.from(next).every((id) => current.has(id))
    ) {
      return;
    }

    set({ filteredSegmentIds: next, filtersActive: nextFiltersActive });
  },

  updateSegmentText: (id, text) => {
    const { updateSegmentsTexts } = get();
    updateSegmentsTexts([{ id, text }]);
  },

  updateSegmentsTexts: (updates) => {
    const {
      segments,
      speakers,
      tags,
      chapters,
      history,
      historyIndex,
      selectedSegmentId,
      selectedChapterId,
      currentTime,
      confidenceScoresVersion,
    } = get();
    const currentSegments = [...segments];
    const currentIndexById = indexById(currentSegments);
    let changed = false;

    for (const update of updates) {
      const segmentIndex = currentIndexById.get(update.id) ?? -1;
      if (segmentIndex === -1) continue;

      const segment = currentSegments[segmentIndex];
      if (segment.text === update.text) continue;

      const updatedSegment = applyTextUpdateToSegment(segment, update.text);
      if (!updatedSegment) continue;

      currentSegments[segmentIndex] = updatedSegment;
      changed = true;
    }

    if (!changed) return;

    const nextConfidenceScoresVersion = confidenceScoresVersion + 1;
    const nextHistory = addToHistory(history, historyIndex, {
      segments: currentSegments,
      speakers,
      tags,
      chapters,
      selectedSegmentId,
      selectedChapterId,
      currentTime,
      confidenceScoresVersion: nextConfidenceScoresVersion,
    });
    // Invalidate word index cache because segments array changed
    clearWordsIndexCache();

    set({
      segments: currentSegments,
      confidenceScoresVersion: nextConfidenceScoresVersion,
      history: nextHistory.history,
      historyIndex: nextHistory.historyIndex,
    });
  },

  updateSegmentSpeaker: (id, speaker) => {
    const {
      segments,
      speakers,
      tags,
      chapters,
      history,
      historyIndex,
      selectedSegmentId,
      selectedChapterId,
      currentTime,
      confidenceScoresVersion,
    } = get();
    const segment = segments.find((s) => s.id === id);
    if (!segment || segment.speaker === speaker) return;
    const newSegments = segments.map((s) => (s.id === id ? { ...s, speaker } : s));
    const nextHistory = addToHistory(history, historyIndex, {
      segments: newSegments,
      speakers,
      tags,
      chapters,
      selectedSegmentId,
      selectedChapterId,
      currentTime,
      confidenceScoresVersion,
    });
    set({
      segments: newSegments,
      history: nextHistory.history,
      historyIndex: nextHistory.historyIndex,
    });
  },

  confirmSegment: (id) => {
    const {
      segments,
      speakers,
      tags,
      chapters,
      history,
      historyIndex,
      selectedSegmentId,
      selectedChapterId,
      currentTime,
      confidenceScoresVersion,
    } = get();
    const segment = segments.find((s) => s.id === id);
    if (!segment) return;
    const updatedWords = segment.words.map((word) => ({ ...word, score: 1 }));
    const newSegments = segments.map((s) =>
      s.id === id ? { ...s, words: updatedWords, confirmed: true } : s,
    );
    const nextConfidenceScoresVersion = confidenceScoresVersion + 1;
    const nextHistory = addToHistory(history, historyIndex, {
      segments: newSegments,
      speakers,
      tags,
      chapters,
      selectedSegmentId,
      selectedChapterId,
      currentTime,
      confidenceScoresVersion: nextConfidenceScoresVersion,
    });
    set({
      segments: newSegments,
      confidenceScoresVersion: nextConfidenceScoresVersion,
      history: nextHistory.history,
      historyIndex: nextHistory.historyIndex,
    });
  },

  toggleSegmentBookmark: (id) => {
    const {
      segments,
      speakers,
      tags,
      chapters,
      history,
      historyIndex,
      selectedSegmentId,
      selectedChapterId,
      currentTime,
      confidenceScoresVersion,
    } = get();
    const segment = segments.find((s) => s.id === id);
    if (!segment) return;
    const newSegments = segments.map((s) =>
      s.id === id ? { ...s, bookmarked: !s.bookmarked } : s,
    );
    const nextHistory = addToHistory(history, historyIndex, {
      segments: newSegments,
      speakers,
      tags,
      chapters,
      selectedSegmentId,
      selectedChapterId,
      currentTime,
      confidenceScoresVersion,
    });
    set({
      segments: newSegments,
      history: nextHistory.history,
      historyIndex: nextHistory.historyIndex,
    });
  },

  splitSegment: (id, wordIndex) => {
    const {
      segments,
      speakers,
      tags,
      chapters,
      history,
      historyIndex,
      selectedChapterId,
      confidenceScoresVersion,
    } = get();
    const indexMap = indexById(segments);
    const segmentIndex = indexMap.get(id) ?? -1;
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

    const updatedChapters = remapAndFilterChapters(
      chapters,
      { [id]: { start: firstSegment.id, end: secondSegment.id } },
      newSegments,
    );

    const nextHistory = addToHistory(history, historyIndex, {
      segments: newSegments,
      speakers,
      tags,
      chapters: updatedChapters,
      selectedSegmentId: secondSegment.id,
      selectedChapterId,
      currentTime: secondSegment.start,
      confidenceScoresVersion,
    });
    // Invalidate word index cache because segments array changed
    clearWordsIndexCache();

    set({
      segments: newSegments,
      chapters: updatedChapters,
      selectedSegmentId: secondSegment.id,
      currentTime: secondSegment.start,
      seekRequestTime: secondSegment.start,
      history: nextHistory.history,
      historyIndex: nextHistory.historyIndex,
    });
  },

  mergeSegments: (id1, id2) => {
    const {
      segments,
      speakers,
      tags,
      chapters,
      history,
      historyIndex,
      currentTime,
      selectedChapterId,
      confidenceScoresVersion,
      aiSpeakerSuggestions,
      aiRevisionSuggestions,
      aiSegmentMergeSuggestions,
      aiChapterDetectionSuggestions,
    } = get();
    const indexMap = indexById(segments);
    const index1 = indexMap.get(id1) ?? -1;
    const index2 = indexMap.get(id2) ?? -1;

    if (index1 === -1 || index2 === -1) return null;
    if (Math.abs(index1 - index2) !== 1) return null;

    const [first, second] =
      index1 < index2 ? [segments[index1], segments[index2]] : [segments[index2], segments[index1]];

    const merged: Segment = {
      id: generateId(),
      speaker: first.speaker,
      tags: Array.from(new Set([...(first.tags ?? []), ...(second.tags ?? [])])),
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

    const updatedChapters = remapAndFilterChapters(
      chapters,
      { [first.id]: merged.id, [second.id]: merged.id },
      newSegments,
    );

    const suggestionUpdates = pruneAISuggestionsForRemovedSegments(
      {
        aiSpeakerSuggestions,
        aiRevisionSuggestions,
        aiSegmentMergeSuggestions,
        aiChapterDetectionSuggestions,
      },
      new Set([first.id, second.id]),
    );

    const nextHistory = addToHistory(history, historyIndex, {
      segments: newSegments,
      speakers,
      tags,
      chapters: updatedChapters,
      selectedSegmentId: merged.id,
      selectedChapterId,
      currentTime,
      confidenceScoresVersion,
    });
    // Invalidate word index cache because segments array changed
    clearWordsIndexCache();

    set({
      segments: newSegments,
      selectedSegmentId: merged.id,
      chapters: updatedChapters,
      history: nextHistory.history,
      historyIndex: nextHistory.historyIndex,
      ...suggestionUpdates,
    });
    return merged.id;
  },

  updateSegmentTiming: (id, start, end) => {
    const {
      segments,
      speakers,
      tags,
      chapters,
      history,
      historyIndex,
      selectedSegmentId,
      selectedChapterId,
      currentTime,
      confidenceScoresVersion,
    } = get();
    const segment = segments.find((s) => s.id === id);
    if (!segment || (segment.start === start && segment.end === end)) return;
    const newSegments = segments.map((s) => (s.id === id ? { ...s, start, end } : s));
    const nextHistory = addToHistory(history, historyIndex, {
      segments: newSegments,
      speakers,
      tags,
      chapters,
      selectedSegmentId,
      selectedChapterId,
      currentTime,
      confidenceScoresVersion,
    });
    // timing update doesn't touch words but replace segment object; invalidate to be safe
    clearWordsIndexCache();

    set({
      segments: newSegments,
      history: nextHistory.history,
      historyIndex: nextHistory.historyIndex,
    });
  },

  deleteSegment: (id) => {
    const {
      segments,
      speakers,
      tags,
      chapters,
      history,
      historyIndex,
      selectedSegmentId,
      selectedChapterId,
      currentTime,
      confidenceScoresVersion,
      aiSpeakerSuggestions,
      aiRevisionSuggestions,
      aiSegmentMergeSuggestions,
      aiChapterDetectionSuggestions,
    } = get();
    const newSegments = segments.filter((s) => s.id !== id);
    if (newSegments.length === segments.length) return;
    const nextSelectedSegmentId =
      selectedSegmentId === id
        ? (newSegments.find((segment) => segment.start > currentTime)?.id ??
          newSegments[newSegments.length - 1]?.id ??
          null)
        : selectedSegmentId;
    const nextConfidenceScoresVersion = confidenceScoresVersion + 1;
    // Compute replacements for chapters that referenced the deleted id:
    // - startSegmentId -> next segment at the deleted index (becomes first)
    // - endSegmentId -> previous segment before the deleted index
    const indexMap = indexById(segments);
    const deletedIndex = indexMap.get(id) ?? -1;
    const startReplacement = newSegments[deletedIndex];
    const endReplacement = newSegments[deletedIndex - 1];

    // Remove chapters that only referenced the deleted segment (single-segment
    // chapters) before attempting remap, since remapping would create
    // inverted or empty ranges.
    const chaptersToRemap = (chapters || []).filter(
      (ch) => !(ch && ch.startSegmentId === id && ch.endSegmentId === id),
    );

    const updatedChapters = remapAndFilterChapters(
      chaptersToRemap,
      {
        [id]: {
          start: startReplacement?.id,
          end: endReplacement?.id,
        },
      },
      newSegments,
    );

    const suggestionUpdates = pruneAISuggestionsForRemovedSegments(
      {
        aiSpeakerSuggestions,
        aiRevisionSuggestions,
        aiSegmentMergeSuggestions,
        aiChapterDetectionSuggestions,
      },
      new Set([id]),
    );

    const nextHistory = addToHistory(history, historyIndex, {
      segments: newSegments,
      speakers,
      tags,
      chapters: updatedChapters,
      selectedSegmentId: nextSelectedSegmentId,
      selectedChapterId,
      currentTime,
      confidenceScoresVersion: nextConfidenceScoresVersion,
    });
    // Invalidate cache because segments removed
    clearWordsIndexCache();

    set({
      segments: newSegments,
      chapters: updatedChapters,
      confidenceScoresVersion: nextConfidenceScoresVersion,
      selectedSegmentId: nextSelectedSegmentId,
      history: nextHistory.history,
      historyIndex: nextHistory.historyIndex,
      ...suggestionUpdates,
    });
  },
});
