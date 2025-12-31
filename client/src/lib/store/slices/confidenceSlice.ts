/**
 * Confidence Slice
 *
 * Manages confidence highlighting settings:
 * - highlightLowConfidence: Whether to highlight low confidence words
 * - manualConfidenceThreshold: User-set threshold (null = auto-calculate)
 */

import type { StoreApi } from "zustand";
import type { TranscriptStore } from "../types";

export interface ConfidenceSlice {
  setHighlightLowConfidence: (enabled: boolean) => void;
  setManualConfidenceThreshold: (threshold: number | null) => void;
  toggleHighlightLowConfidence: () => void;
}

type StoreSetter = StoreApi<TranscriptStore>["setState"];
type StoreGetter = StoreApi<TranscriptStore>["getState"];

export const createConfidenceSlice = (set: StoreSetter, _get: StoreGetter): ConfidenceSlice => ({
  setHighlightLowConfidence: (enabled) => {
    set({ highlightLowConfidence: enabled });
  },

  setManualConfidenceThreshold: (threshold) => {
    set({ manualConfidenceThreshold: threshold });
  },

  toggleHighlightLowConfidence: () => {
    set((state) => ({ highlightLowConfidence: !state.highlightLowConfidence }));
  },
});
