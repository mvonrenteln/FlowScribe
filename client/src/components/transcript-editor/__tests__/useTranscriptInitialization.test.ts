import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { buildFileReference } from "@/lib/fileReference";
import { useTranscriptInitialization } from "../useTranscriptInitialization";

const audioHandleStorageMock = vi.hoisted(() => ({
  mockLoadAudioHandle: vi.fn(),
  mockQueryAudioHandlePermission: vi.fn(),
  mockClearAudioHandle: vi.fn(),
}));

const mockParseTranscriptData = vi.hoisted(() => vi.fn());
const mockConfirmIfLargeAudio = vi.hoisted(() => vi.fn());
const createObjectURLMock = vi.fn();

vi.mock("@/lib/audioHandleStorage", () => ({
  buildAudioRefKey: (audioRef: ReturnType<typeof buildFileReference>) =>
    JSON.stringify({
      name: audioRef.name,
      size: audioRef.size,
      lastModified: audioRef.lastModified,
    }),
  loadAudioHandleForAudioRef: audioHandleStorageMock.mockLoadAudioHandle,
  clearAudioHandleForAudioRef: audioHandleStorageMock.mockClearAudioHandle,
  queryAudioHandlePermission: audioHandleStorageMock.mockQueryAudioHandlePermission,
}));

const { mockLoadAudioHandle, mockQueryAudioHandlePermission, mockClearAudioHandle } =
  audioHandleStorageMock;

vi.mock("@/lib/confirmLargeFile", () => ({
  default: mockConfirmIfLargeAudio,
  confirmIfLargeAudio: mockConfirmIfLargeAudio,
}));

vi.mock("@/lib/transcriptParsing", () => ({
  parseTranscriptData: (data: unknown) => mockParseTranscriptData(data),
}));

describe("useTranscriptInitialization", () => {
  const setAudioFile = vi.fn();
  const setAudioUrl = vi.fn();
  const setAudioReference = vi.fn();
  const reconnectAudio = vi.fn();
  const loadTranscript = vi.fn();
  const objectUrl = "blob:mock-url";

  beforeEach(() => {
    mockLoadAudioHandle.mockReset();
    mockQueryAudioHandlePermission.mockReset();
    mockClearAudioHandle.mockReset();
    mockConfirmIfLargeAudio.mockReset();
    mockParseTranscriptData.mockReset();
    setAudioFile.mockReset();
    setAudioUrl.mockReset();
    setAudioReference.mockReset();
    reconnectAudio.mockReset();
    loadTranscript.mockReset();
    createObjectURLMock.mockReturnValue(objectUrl);
    (URL as unknown as { createObjectURL: typeof createObjectURLMock }).createObjectURL =
      createObjectURLMock;
    mockLoadAudioHandle.mockResolvedValue(null);
    mockQueryAudioHandlePermission.mockResolvedValue(false);
    mockClearAudioHandle.mockResolvedValue(undefined);
    mockConfirmIfLargeAudio.mockReturnValue(true);
  });

  it("uploads audio and stores reference for fresh session (no existing audioRef)", () => {
    const file = new File(["audio"], "sample.wav", { type: "audio/wav" });
    const { result } = renderHook(() =>
      useTranscriptInitialization({
        audioFile: null,
        audioUrl: null,
        audioRef: null,
        duration: 0,
        setAudioFile,
        setAudioUrl,
        setAudioReference,
        reconnectAudio,
        loadTranscript,
      }),
    );

    act(() => {
      result.current.handleAudioUpload(file);
    });

    expect(setAudioFile).toHaveBeenCalledWith(file);
    expect(setAudioUrl).toHaveBeenCalledWith(objectUrl);
    expect(setAudioReference).toHaveBeenCalledWith(expect.objectContaining({ name: "sample.wav" }));
    expect(reconnectAudio).not.toHaveBeenCalled();
  });

  it("uses reconnectAudio when audioRef is set but audioUrl is null (restore/reload case)", () => {
    const file = new File(["audio"], "interview.mp3", { type: "audio/mpeg" });
    const audioRef = buildFileReference(file);
    const { result } = renderHook(() =>
      useTranscriptInitialization({
        audioFile: null,
        audioUrl: null,
        audioRef,
        duration: 0,
        setAudioFile,
        setAudioUrl,
        setAudioReference,
        reconnectAudio,
        loadTranscript,
      }),
    );

    act(() => {
      result.current.handleAudioUpload(file);
    });

    expect(reconnectAudio).toHaveBeenCalledWith(file);
    expect(setAudioFile).not.toHaveBeenCalled();
    expect(setAudioUrl).not.toHaveBeenCalled();
    expect(setAudioReference).not.toHaveBeenCalled();
  });

  it("uses reconnectAudio even when dropped file has different metadata than stored audioRef", () => {
    const differentFile = new File(["audio"], "interview.mp3", { type: "audio/mpeg" });
    // audioRef was from a file with different lastModified (e.g. copied from backup drive)
    const audioRef = { name: "interview.mp3", size: 99999, lastModified: 1000000 };
    const { result } = renderHook(() =>
      useTranscriptInitialization({
        audioFile: null,
        audioUrl: null,
        audioRef,
        duration: 0,
        setAudioFile,
        setAudioUrl,
        setAudioReference,
        reconnectAudio,
        loadTranscript,
      }),
    );

    act(() => {
      result.current.handleAudioUpload(differentFile);
    });

    expect(reconnectAudio).toHaveBeenCalledWith(differentFile);
    expect(setAudioReference).not.toHaveBeenCalled();
  });

  it("uses setAudioReference (not reconnectAudio) when audio is already loaded (swap case)", () => {
    const file = new File(["audio"], "new-audio.wav", { type: "audio/wav" });
    const audioRef = buildFileReference(new File(["old"], "old-audio.wav", { type: "audio/wav" }));
    const { result } = renderHook(() =>
      useTranscriptInitialization({
        audioFile: null,
        audioUrl: "blob:existing-url",
        audioRef,
        duration: 0,
        setAudioFile,
        setAudioUrl,
        setAudioReference,
        reconnectAudio,
        loadTranscript,
      }),
    );

    act(() => {
      result.current.handleAudioUpload(file);
    });

    expect(setAudioReference).toHaveBeenCalledWith(
      expect.objectContaining({ name: "new-audio.wav" }),
    );
    expect(reconnectAudio).not.toHaveBeenCalled();
  });

  it("parses transcript uploads and loads transcript", () => {
    const parsed = { segments: [{ id: "a" }], isWhisperXFormat: false };
    mockParseTranscriptData.mockReturnValue(parsed);
    const reference = { name: "transcript.json" };
    const { result } = renderHook(() =>
      useTranscriptInitialization({
        audioFile: null,
        audioUrl: null,
        audioRef: null,
        duration: 0,
        setAudioFile,
        setAudioUrl,
        setAudioReference,
        reconnectAudio,
        loadTranscript,
      }),
    );

    act(() => {
      result.current.handleTranscriptUpload({ raw: true }, reference as never);
    });

    expect(mockParseTranscriptData).toHaveBeenCalledWith({ raw: true });
    expect(loadTranscript).toHaveBeenCalledWith({
      segments: parsed.segments,
      isWhisperXFormat: parsed.isWhisperXFormat,
      tags: parsed.tags,
      chapters: parsed.chapters,
      reference,
    });
  });

  it("restores previously granted audio handles via reconnectAudio", async () => {
    const restoredFile = new File(["audio"], "restored.wav", { type: "audio/wav" });
    const audioRef = buildFileReference(restoredFile);
    mockLoadAudioHandle.mockResolvedValue({ getFile: vi.fn().mockResolvedValue(restoredFile) });
    mockQueryAudioHandlePermission.mockResolvedValue(true);

    renderHook(() =>
      useTranscriptInitialization({
        audioFile: null,
        audioUrl: null,
        audioRef,
        duration: 0,
        setAudioFile,
        setAudioUrl,
        setAudioReference,
        reconnectAudio,
        loadTranscript,
      }),
    );

    await waitFor(() => {
      expect(reconnectAudio).toHaveBeenCalledWith(restoredFile);
    });
    expect(setAudioReference).not.toHaveBeenCalled();
  });

  it("does not restore audio when permission is denied", async () => {
    const restoredFile = new File(["audio"], "restored.wav", { type: "audio/wav" });
    const audioRef = buildFileReference(restoredFile);
    const handle = { getFile: vi.fn().mockResolvedValue(restoredFile) };
    mockLoadAudioHandle.mockResolvedValue(handle);
    mockQueryAudioHandlePermission.mockResolvedValue(false);

    renderHook(() =>
      useTranscriptInitialization({
        audioFile: null,
        audioUrl: null,
        audioRef,
        duration: 0,
        setAudioFile,
        setAudioUrl,
        setAudioReference,
        reconnectAudio,
        loadTranscript,
      }),
    );

    await waitFor(() => {
      expect(mockQueryAudioHandlePermission).toHaveBeenCalledWith(handle);
    });
    expect(handle.getFile).not.toHaveBeenCalled();
    expect(setAudioFile).not.toHaveBeenCalled();
    expect(setAudioUrl).not.toHaveBeenCalled();
    expect(reconnectAudio).not.toHaveBeenCalled();
  });

  it("clears handle when user declines large audio file at reload", async () => {
    const largeFile = new File(["audio"], "large.wav", { type: "audio/wav" });
    const audioRef = buildFileReference(largeFile);
    const handle = { getFile: vi.fn().mockResolvedValue(largeFile) };
    mockLoadAudioHandle.mockResolvedValue(handle);
    mockQueryAudioHandlePermission.mockResolvedValue(true);
    mockConfirmIfLargeAudio.mockReturnValue(false);

    renderHook(() =>
      useTranscriptInitialization({
        audioFile: null,
        audioUrl: null,
        audioRef,
        duration: 0,
        setAudioFile,
        setAudioUrl,
        setAudioReference,
        reconnectAudio,
        loadTranscript,
      }),
    );

    await waitFor(() => {
      expect(mockClearAudioHandle).toHaveBeenCalled();
    });
    expect(setAudioFile).not.toHaveBeenCalled();
    expect(setAudioUrl).not.toHaveBeenCalled();
    expect(reconnectAudio).not.toHaveBeenCalled();
  });
});
