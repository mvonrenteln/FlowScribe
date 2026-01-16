import type { StoreApi } from "zustand";
import type { PlaybackSlice, TranscriptStore } from "../types";

type StoreSetter = StoreApi<TranscriptStore>["setState"];
type StoreGetter = StoreApi<TranscriptStore>["getState"];

export const createPlaybackSlice = (set: StoreSetter, get: StoreGetter): PlaybackSlice => ({
  setCurrentTime: (time) => set({ currentTime: time }),
  setIsPlaying: (playing) => set({ isPlaying: playing }),
  setDuration: (duration) => set({ duration }),
  requestSeek: (time) => set({ seekRequestTime: time }),
  clearSeekRequest: () => set({ seekRequestTime: null }),
  seekToTime: (time, _meta) => {
    if (!Number.isFinite(time)) return;
    const duration = get().duration;
    const maxTime = Number.isFinite(duration) && duration > 0 ? duration : null;
    const clampedTime = maxTime === null ? Math.max(0, time) : Math.max(0, Math.min(maxTime, time));
    const { currentTime, seekRequestTime } = get();
    if (Math.abs(currentTime - clampedTime) <= 0.0005 && seekRequestTime === null) {
      return;
    }
    set({ currentTime: clampedTime, seekRequestTime: clampedTime });
  },
});
