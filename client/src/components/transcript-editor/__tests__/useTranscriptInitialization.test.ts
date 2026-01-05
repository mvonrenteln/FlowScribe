import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useTranscriptInitialization } from "../useTranscriptInitialization";

const mockLoadAudioHandle = vi.fn();
const mockQueryAudioHandlePermission = vi.fn();
const mockParseTranscriptData = vi.fn();
const createObjectURLMock = vi.fn();

vi.mock("@/lib/audioHandleStorage", () => ({
  loadAudioHandle: () => mockLoadAudioHandle(),
  queryAudioHandlePermission: (...args: unknown[]) => mockQueryAudioHandlePermission(...args),
}));

vi.mock("@/lib/transcriptParsing", () => ({
  parseTranscriptData: (data: unknown) => mockParseTranscriptData(data),
}));

describe("useTranscriptInitialization", () => {
  const setAudioFile = vi.fn();
  const setAudioUrl = vi.fn();
  const setAudioReference = vi.fn();
  const loadTranscript = vi.fn();
  const objectUrl = "blob:mock-url";

  beforeEach(() => {
    mockLoadAudioHandle.mockReset();
    mockQueryAudioHandlePermission.mockReset();
    mockParseTranscriptData.mockReset();
    setAudioFile.mockReset();
    setAudioUrl.mockReset();
    setAudioReference.mockReset();
    loadTranscript.mockReset();
    createObjectURLMock.mockReturnValue(objectUrl);
    (URL as unknown as { createObjectURL: typeof createObjectURLMock }).createObjectURL =
      createObjectURLMock;
    mockLoadAudioHandle.mockResolvedValue(null);
    mockQueryAudioHandlePermission.mockResolvedValue(false);
  });

  it("uploads audio and stores reference", () => {
    const file = new File(["audio"], "sample.wav", { type: "audio/wav" });
    const { result } = renderHook(() =>
      useTranscriptInitialization({
        audioFile: null,
        audioUrl: null,
        setAudioFile,
        setAudioUrl,
        setAudioReference,
        loadTranscript,
      }),
    );

    act(() => {
      result.current.handleAudioUpload(file);
    });

    expect(setAudioFile).toHaveBeenCalledWith(file);
    expect(setAudioUrl).toHaveBeenCalledWith(objectUrl);
    expect(setAudioReference).toHaveBeenCalledWith(expect.objectContaining({ name: "sample.wav" }));
  });

  it("parses transcript uploads and loads transcript", () => {
    const parsed = { segments: [{ id: "a" }], isWhisperXFormat: false };
    mockParseTranscriptData.mockReturnValue(parsed);
    const reference = { name: "transcript.json" };
    const { result } = renderHook(() =>
      useTranscriptInitialization({
        audioFile: null,
        audioUrl: null,
        setAudioFile,
        setAudioUrl,
        setAudioReference,
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
      reference,
    });
  });

  it("restores previously granted audio handles", async () => {
    const restoredFile = new File(["audio"], "restored.wav", { type: "audio/wav" });
    mockLoadAudioHandle.mockResolvedValue({ getFile: vi.fn().mockResolvedValue(restoredFile) });
    mockQueryAudioHandlePermission.mockResolvedValue(true);

    renderHook(() =>
      useTranscriptInitialization({
        audioFile: null,
        audioUrl: null,
        setAudioFile,
        setAudioUrl,
        setAudioReference,
        loadTranscript,
      }),
    );

    await waitFor(() => {
      expect(setAudioFile).toHaveBeenCalledWith(restoredFile);
    });
    expect(setAudioUrl).toHaveBeenCalledWith(objectUrl);
  });
});
