import { beforeEach, describe, expect, it } from "vitest";
import { createBaseState, resetStore } from "@/lib/__tests__/storeTestUtils";
import { useTranscriptStore } from "@/lib/store";

describe("playbackSlice seekToTime", () => {
  beforeEach(() => {
    resetStore();
  });

  it("clamps to zero and updates the seek request", () => {
    useTranscriptStore.setState({
      ...createBaseState(),
      duration: 10,
      currentTime: 3,
      seekRequestTime: null,
    });

    useTranscriptStore.getState().seekToTime(-2);

    const { currentTime, seekRequestTime } = useTranscriptStore.getState();
    expect(currentTime).toBe(0);
    expect(seekRequestTime).toBe(0);
  });

  it("clamps to the duration when available", () => {
    useTranscriptStore.setState({
      ...createBaseState(),
      duration: 10,
    });

    useTranscriptStore.getState().seekToTime(15);

    const { currentTime, seekRequestTime } = useTranscriptStore.getState();
    expect(currentTime).toBe(10);
    expect(seekRequestTime).toBe(10);
  });

  it("ignores non-finite times", () => {
    useTranscriptStore.setState({
      ...createBaseState(),
      duration: 10,
      currentTime: 2,
      seekRequestTime: null,
    });

    useTranscriptStore.getState().seekToTime(Number.NaN);

    const { currentTime, seekRequestTime } = useTranscriptStore.getState();
    expect(currentTime).toBe(2);
    expect(seekRequestTime).toBeNull();
  });

  it("no-ops when requesting the same time without a pending seek", () => {
    useTranscriptStore.setState({
      ...createBaseState(),
      duration: 10,
      currentTime: 5,
      seekRequestTime: null,
    });

    useTranscriptStore.getState().seekToTime(5 + 0.0001);

    const { currentTime, seekRequestTime } = useTranscriptStore.getState();
    expect(currentTime).toBe(5);
    expect(seekRequestTime).toBeNull();
  });
});
