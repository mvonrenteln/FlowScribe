import type { StoreApi } from "zustand";
import { SPEAKER_COLORS } from "../constants";
import type { Segment, Tag, TagsSlice, TranscriptStore } from "../types";
import { getSegmentTags } from "../utils/segmentTags";
import { addToHistory } from "./historySlice";

type StoreSetter = StoreApi<TranscriptStore>["setState"];
type StoreGetter = StoreApi<TranscriptStore>["getState"];

export const createTagsSlice = (set: StoreSetter, get: StoreGetter): TagsSlice => ({
  // Tag CRUD Operations
  addTag: (name) => {
    const { tags, segments, history, historyIndex, selectedSegmentId, currentTime, speakers } =
      get();

    const newTag: Tag = {
      id: crypto.randomUUID(),
      name,
      color: SPEAKER_COLORS[tags.length % SPEAKER_COLORS.length],
    };
    const newTags = [...tags, newTag];
    const nextHistory = addToHistory(history, historyIndex, {
      segments,
      speakers,
      tags: newTags,
      selectedSegmentId,
      currentTime,
    });
    set({
      tags: newTags,
      history: nextHistory.history,
      historyIndex: nextHistory.historyIndex,
    });
  },

  removeTag: (tagId) => {
    const { segments, speakers, tags, history, historyIndex, selectedSegmentId, currentTime } =
      get();

    const newTags = tags.filter((t) => t.id !== tagId);
    const newSegments = segments.map((s) => ({
      ...s,
      tags: s.tags.filter((id) => id !== tagId),
    }));
    const nextHistory = addToHistory(history, historyIndex, {
      segments: newSegments,
      speakers,
      tags: newTags,
      selectedSegmentId,
      currentTime,
    });
    set({
      segments: newSegments,
      tags: newTags,
      history: nextHistory.history,
      historyIndex: nextHistory.historyIndex,
    });
  },

  renameTag: (tagId, newName) => {
    const { segments, speakers, tags, history, historyIndex, selectedSegmentId, currentTime } =
      get();
    const tag = tags.find((t) => t.id === tagId);
    if (!tag) return;
    if (tag.name === newName) return;

    const newTags = tags.map((t) => (t.id === tagId ? { ...t, name: newName } : t));
    const nextHistory = addToHistory(history, historyIndex, {
      segments,
      speakers,
      tags: newTags,
      selectedSegmentId,
      currentTime,
    });
    set({
      tags: newTags,
      history: nextHistory.history,
      historyIndex: nextHistory.historyIndex,
    });
  },

  updateTagColor: (tagId, color) => {
    const { segments, speakers, tags, history, historyIndex, selectedSegmentId, currentTime } =
      get();
    const tag = tags.find((t) => t.id === tagId);
    if (!tag) return;

    const newTags = tags.map((t) => (t.id === tagId ? { ...t, color } : t));
    const nextHistory = addToHistory(history, historyIndex, {
      segments,
      speakers,
      tags: newTags,
      selectedSegmentId,
      currentTime,
    });
    set({
      tags: newTags,
      history: nextHistory.history,
      historyIndex: nextHistory.historyIndex,
    });
  },

  // Tag Assignment Operations
  assignTagToSegment: (segmentId, tagId) => {
    const { segments, speakers, tags, history, historyIndex, selectedSegmentId, currentTime } =
      get();

    const newSegments = segments.map((s: Segment) =>
      s.id === segmentId && !getSegmentTags(s).includes(tagId)
        ? { ...s, tags: [...getSegmentTags(s), tagId] }
        : s,
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

  removeTagFromSegment: (segmentId, tagId) => {
    const { segments, speakers, tags, history, historyIndex, selectedSegmentId, currentTime } =
      get();

    const newSegments = segments.map((s: Segment) =>
      s.id === segmentId ? { ...s, tags: getSegmentTags(s).filter((id) => id !== tagId) } : s,
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

  toggleTagOnSegment: (segmentId, tagId) => {
    const { segments } = get();
    const segment = segments.find((s) => s.id === segmentId);
    if (!segment) return;
    const segTags = getSegmentTags(segment);
    if (segTags.includes(tagId)) {
      get().removeTagFromSegment(segmentId, tagId);
    } else {
      get().assignTagToSegment(segmentId, tagId);
    }
  },

  // Tag Selectors
  selectTagById: (tagId) => {
    const { tags } = get();
    return tags.find((t) => t.id === tagId);
  },

  selectSegmentsByTagId: (tagId) => {
    const { segments } = get();
    return segments.filter((s) => getSegmentTags(s).includes(tagId));
  },

  selectTagsForSegment: (segmentId) => {
    const { segments, tags } = get();
    const segment = segments.find((s) => s.id === segmentId);
    if (!segment) return [];
    return tags.filter((t) => getSegmentTags(segment).includes(t.id));
  },

  selectUntaggedSegments: () => {
    const { segments } = get();
    return segments.filter((s) => (s.tags ?? []).length === 0);
  },
});
