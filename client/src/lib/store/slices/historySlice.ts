import type { StoreApi } from "zustand";
import { MAX_HISTORY } from "../constants";
import type { HistorySlice, TranscriptStore } from "../types";
import { pushHistory } from "../utils/history";

type StoreSetter = StoreApi<TranscriptStore>["setState"];
type StoreGetter = StoreApi<TranscriptStore>["getState"];

export const createHistorySlice = (set: StoreSetter, get: StoreGetter): HistorySlice => ({
  undo: () => {
    const { history, historyIndex, selectedSegmentId } = get();
    if (historyIndex <= 0) return;
    const newIndex = historyIndex - 1;
    const state = history[newIndex];
    set({
      segments: state.segments,
      speakers: state.speakers,
      tags: state.tags,
      chapters: state.chapters,
      selectedSegmentId: state.selectedSegmentId ?? selectedSegmentId,
      selectedChapterId: state.selectedChapterId ?? get().selectedChapterId,
      currentTime: state.currentTime,
      seekRequestTime: state.currentTime,
      confidenceScoresVersion: state.confidenceScoresVersion,
      historyIndex: newIndex,
    });
  },
  redo: () => {
    const { history, historyIndex, selectedSegmentId } = get();
    if (historyIndex >= history.length - 1) return;
    const newIndex = historyIndex + 1;
    const state = history[newIndex];
    set({
      segments: state.segments,
      speakers: state.speakers,
      tags: state.tags,
      chapters: state.chapters,
      selectedSegmentId: state.selectedSegmentId ?? selectedSegmentId,
      selectedChapterId: state.selectedChapterId ?? get().selectedChapterId,
      currentTime: state.currentTime,
      seekRequestTime: state.currentTime,
      confidenceScoresVersion: state.confidenceScoresVersion,
      historyIndex: newIndex,
    });
  },
  canUndo: () => get().historyIndex > 0,
  canRedo: () => get().historyIndex < get().history.length - 1,
});

export const addToHistory = (
  history: TranscriptStore["history"],
  historyIndex: number,
  state: TranscriptStore["history"][number],
) => pushHistory(history, historyIndex, state, MAX_HISTORY);
