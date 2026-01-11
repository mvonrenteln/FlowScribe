import type { StoreApi } from "zustand";
import type { TranscriptStore } from "../types";

type StoreSetter = StoreApi<TranscriptStore>["setState"];
type StoreGetter = StoreApi<TranscriptStore>["getState"];

const STORAGE_KEY = "ai-revision-selection";

function readInitialSelection(): { providerId?: string; model?: string } | undefined {
  try {
    if (!globalThis.window?.localStorage) return undefined;
    const raw = globalThis.window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return undefined;
    return JSON.parse(raw) as { providerId?: string; model?: string };
  } catch {
    return undefined;
  }
}

// Plain slice that persists selection to localStorage; kept minimal so it can be
// included as a normal slice in the root store without zustand middleware wrappers.
// Use TranscriptStore as the root store type so the slice creator is typed correctly.
// This slice only provides the last selection setter and value.
export const createAiRevisionSelectionSlice = (
  set: StoreSetter,
  _get: StoreGetter,
): Pick<TranscriptStore, "aiRevisionLastSelection" | "setAiRevisionLastSelection"> => {
  const initial = readInitialSelection();

  return {
    aiRevisionLastSelection: initial,
    setAiRevisionLastSelection: (s?: { providerId?: string; model?: string }) => {
      try {
        if (globalThis.window?.localStorage) {
          if (s) globalThis.window.localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
          else globalThis.window.localStorage.removeItem(STORAGE_KEY);
        }
      } catch {
        // ignore storage errors
      }

      set({ aiRevisionLastSelection: s });
    },
  };
};
