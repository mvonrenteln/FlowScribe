import { StateCreator } from "zustand";
import type { AiRevisionSelection, AIRevisionSlice } from "../types";

const STORAGE_KEY = "ai-revision-selection";

function readInitialSelection(): AiRevisionSelection | undefined {
  try {
    if (typeof window === "undefined" || !window.localStorage) return undefined;
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return undefined;
    return JSON.parse(raw) as AiRevisionSelection;
  } catch {
    return undefined;
  }
}

// Plain slice that persists selection to localStorage; kept minimal so it can be
// included as a normal slice in the root store without zustand middleware wrappers.
export const createAiRevisionSelectionSlice: StateCreator<any, [], [], AIRevisionSlice> = (set) => {
  const initial = readInitialSelection();

  return {
    aiRevisionLastSelection: initial,
    setAiRevisionLastSelection: (s?: AiRevisionSelection) => {
      try {
        if (typeof window !== "undefined" && window.localStorage) {
          if (s) window.localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
          else window.localStorage.removeItem(STORAGE_KEY);
        }
      } catch {
        // ignore storage errors
      }

      set({ aiRevisionLastSelection: s });
    },
  };
};
