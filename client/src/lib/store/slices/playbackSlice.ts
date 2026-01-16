import type { StoreApi } from "zustand";
import { mark, time as perfTime } from "@/lib/logging";
import type { PlaybackSlice, TranscriptStore } from "../types";

type StoreSetter = StoreApi<TranscriptStore>["setState"];
type StoreGetter = StoreApi<TranscriptStore>["getState"];

export const createPlaybackSlice = (set: StoreSetter, get: StoreGetter): PlaybackSlice => ({
  updatePlaybackTime: (time) => {
    if (!Number.isFinite(time)) return;
    // Coalesce frequent playback updates to avoid store churn. Target ~10Hz (100ms).
    // Use module-scoped refs via closure to keep state between calls.
    const now = Date.now();
    // @ts-ignore - attach helpers to function object to persist across calls
    if (!(updatePlaybackTime as any)._last) {
      (updatePlaybackTime as any)._last = 0;
      (updatePlaybackTime as any)._pending = null as number | null;
      (updatePlaybackTime as any)._timer = null as number | null;
    }

    const last = (updatePlaybackTime as any)._last as number;
    const pending = (updatePlaybackTime as any)._pending as number | null;
    const timer = (updatePlaybackTime as any)._timer as number | null;

    const flush = () => {
      const toSet = (updatePlaybackTime as any)._pending as number | null;
      if (toSet !== null && Number.isFinite(toSet)) {
        perfTime("playback-update", () => set({ currentTime: toSet }), { time: toSet });
      }
      (updatePlaybackTime as any)._pending = null;
      (updatePlaybackTime as any)._timer = null;
      (updatePlaybackTime as any)._last = Date.now();
    };

    const THROTTLE_MS = 100;

    // If enough time has passed since last actual write, write immediately.
    if (now - last >= THROTTLE_MS) {
      if (timer) {
        clearTimeout(timer);
        (updatePlaybackTime as any)._timer = null;
      }
      (updatePlaybackTime as any)._last = now;
      perfTime("playback-update", () => set({ currentTime: time }), { time });
      return;
    }

    // Otherwise, schedule/replace a pending write.
    (updatePlaybackTime as any)._pending = time;
    if (timer) {
      clearTimeout(timer);
    }
    (updatePlaybackTime as any)._timer = setTimeout(flush, THROTTLE_MS) as unknown as number;
  },
  setCurrentTime: (time) => set({ currentTime: time }),
  setIsPlaying: (playing) => set({ isPlaying: playing }),
  setDuration: (duration) => set({ duration }),
  requestSeek: (time) => set({ seekRequestTime: time }),
  clearSeekRequest: () => set({ seekRequestTime: null }),
  seekToTime: (time, meta) => {
    if (!Number.isFinite(time)) return;
    mark("seek-start", { requestedTime: time, source: meta?.source });
    const { duration, currentTime, seekRequestTime } = get();
    const maxTime = Number.isFinite(duration) && duration > 0 ? duration : null;
    const clampedTime = maxTime === null ? Math.max(0, time) : Math.max(0, Math.min(maxTime, time));

    if (Math.abs(currentTime - clampedTime) <= 0.001 && seekRequestTime === null) {
      return;
    }

    if (meta.source === "waveform") {
      set({ currentTime: clampedTime });
      mark("seek-complete", { appliedTime: clampedTime, source: "waveform" });
      return;
    }

    set({ currentTime: clampedTime, seekRequestTime: clampedTime });
    mark("seek-requested", { appliedTime: clampedTime });
  },
});
