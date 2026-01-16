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

    useTranscriptStore.getState().seekToTime(-2, { source: "hotkey", action: "jump" });

    const { currentTime, seekRequestTime } = useTranscriptStore.getState();
    expect(currentTime).toBe(0);
    expect(seekRequestTime).toBe(0);
  });

  it("clamps to the duration when available", () => {
    useTranscriptStore.setState({
      ...createBaseState(),
      duration: 10,
    });

    useTranscriptStore.getState().seekToTime(15, { source: "hotkey", action: "jump" });

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

    useTranscriptStore.getState().seekToTime(Number.NaN, { source: "hotkey", action: "jump" });

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

    useTranscriptStore.getState().seekToTime(5 + 0.0001, { source: "hotkey", action: "jump" });

    const { currentTime, seekRequestTime } = useTranscriptStore.getState();
    expect(currentTime).toBe(5);
    expect(seekRequestTime).toBeNull();
  });

  it("avoids enqueueing waveform seeks when already at time", () => {
    useTranscriptStore.setState({
      ...createBaseState(),
      duration: 10,
      currentTime: 5,
      seekRequestTime: null,
    });

    useTranscriptStore.getState().seekToTime(5.01, { source: "waveform" });

    const { currentTime, seekRequestTime } = useTranscriptStore.getState();
    expect(currentTime).toBeCloseTo(5.01, 1);
    expect(seekRequestTime).toBeNull();
  });

  it("waveform source updates only the store time", () => {
    useTranscriptStore.setState({
      ...createBaseState(),
      duration: 100,
      currentTime: 0,
      seekRequestTime: null,
    });

    useTranscriptStore.getState().seekToTime(50, { source: "waveform" });

    const { currentTime, seekRequestTime } = useTranscriptStore.getState();
    expect(currentTime).toBe(50);
    expect(seekRequestTime).toBeNull();
  });

  it("non-waveform sources enqueue waveform seek", () => {
    useTranscriptStore.setState({
      ...createBaseState(),
      duration: 100,
      currentTime: 0,
      seekRequestTime: null,
    });

    useTranscriptStore.getState().seekToTime(50, { source: "transcript", action: "segment_click" });

    const { currentTime, seekRequestTime } = useTranscriptStore.getState();
    expect(currentTime).toBe(50);
    expect(seekRequestTime).toBe(50);
  });
});

describe("playbackSlice updatePlaybackTime", () => {
  beforeEach(() => {
    resetStore();
  });

  it("updates only currentTime", () => {
    useTranscriptStore.setState({
      ...createBaseState(),
      currentTime: 1,
      seekRequestTime: 10,
    });

    useTranscriptStore.getState().updatePlaybackTime(2);

    const { currentTime, seekRequestTime } = useTranscriptStore.getState();
    expect(currentTime).toBe(2);
    expect(seekRequestTime).toBe(10);
  });

  it("ignores non-finite times", () => {
    useTranscriptStore.setState({
      ...createBaseState(),
      currentTime: 1,
      seekRequestTime: null,
    });

    useTranscriptStore.getState().updatePlaybackTime(Number.NaN);

    const { currentTime, seekRequestTime } = useTranscriptStore.getState();
    expect(currentTime).toBe(1);
    expect(seekRequestTime).toBeNull();
  });
});
