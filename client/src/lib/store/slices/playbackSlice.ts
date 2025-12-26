import type { StoreApi } from "zustand";
import type { PlaybackSlice, TranscriptStore } from "../types";

type StoreSetter = StoreApi<TranscriptStore>["setState"];

export const createPlaybackSlice = (set: StoreSetter): PlaybackSlice => ({
  setCurrentTime: (time) => set({ currentTime: time }),
  setIsPlaying: (playing) => set({ isPlaying: playing }),
  setDuration: (duration) => set({ duration }),
  requestSeek: (time) => set({ seekRequestTime: time }),
  clearSeekRequest: () => set({ seekRequestTime: null }),
});
