import type { StoreApi } from "zustand";
import { mark, time as perfTime } from "@/lib/logging";
import type { PlaybackSlice, TranscriptStore } from "../types";

type StoreSetter = StoreApi<TranscriptStore>["setState"];
type StoreGetter = StoreApi<TranscriptStore>["getState"];

let _playback_last = 0;
let _playback_pending: number | null = null;
let _playback_timer: number | null = null;

export const createPlaybackSlice = (set: StoreSetter, get: StoreGetter): PlaybackSlice => ({
  updatePlaybackTime: (time) => {
    if (!Number.isFinite(time)) return;
    // Coalesce frequent playback updates to avoid store churn. Target ~10Hz (100ms).
    const now = Date.now();

    const flush = () => {
      const toSet = _playback_pending;
      if (toSet !== null && Number.isFinite(toSet)) {
        perfTime("playback-update", () => set({ currentTime: toSet }), { time: toSet });
      }
      _playback_pending = null;
      _playback_timer = null;
      _playback_last = Date.now();
    };

    const THROTTLE_MS = 100;

    // If enough time has passed since last actual write, write immediately.
    if (now - _playback_last >= THROTTLE_MS) {
      if (_playback_timer) {
        clearTimeout(_playback_timer);
        _playback_timer = null;
      }
      _playback_last = now;
      perfTime("playback-update", () => set({ currentTime: time }), { time });
      return;
    }

    // Otherwise, schedule/replace a pending write.
    _playback_pending = time;
    if (_playback_timer) {
      clearTimeout(_playback_timer);
    }
    _playback_timer = setTimeout(flush, THROTTLE_MS) as unknown as number;
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
