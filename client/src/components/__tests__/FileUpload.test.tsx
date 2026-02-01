import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { FileUpload } from "@/components/FileUpload";
import { buildFileReference } from "@/lib/fileReference";

const audioHandleStorageMock = vi.hoisted(() => ({
  mockLoadAudioHandle: vi.fn(),
  mockSaveAudioHandle: vi.fn(),
  mockClearAudioHandle: vi.fn(),
  mockRequestPermission: vi.fn(),
}));

const mockConfirmIfLargeAudio = vi.hoisted(() => vi.fn());

vi.mock("@/lib/audioHandleStorage", () => ({
  buildAudioRefKey: (audioRef: { name: string; size: number; lastModified: number }) =>
    JSON.stringify({
      name: audioRef.name,
      size: audioRef.size,
      lastModified: audioRef.lastModified,
    }),
  clearAudioHandleForAudioRef: audioHandleStorageMock.mockClearAudioHandle,
  loadAudioHandleForAudioRef: audioHandleStorageMock.mockLoadAudioHandle,
  requestAudioHandlePermission: audioHandleStorageMock.mockRequestPermission,
  saveAudioHandleForAudioRef: audioHandleStorageMock.mockSaveAudioHandle,
}));

vi.mock("@/lib/confirmLargeFile", () => ({
  default: mockConfirmIfLargeAudio,
  confirmIfLargeAudio: mockConfirmIfLargeAudio,
}));

const { mockLoadAudioHandle, mockSaveAudioHandle, mockClearAudioHandle, mockRequestPermission } =
  audioHandleStorageMock;

// Mock the store with a getter function
let mockAudioRef: ReturnType<typeof buildFileReference> | null = null;

vi.mock("@/lib/store", () => ({
  useTranscriptStore: vi.fn((selector?: (state: { audioRef: typeof mockAudioRef }) => unknown) => {
    const state = { audioRef: mockAudioRef };
    return selector ? selector(state) : state;
  }),
}));

describe("FileUpload", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAudioRef = null;
    mockLoadAudioHandle.mockResolvedValue(null);
    mockSaveAudioHandle.mockResolvedValue(undefined);
    mockClearAudioHandle.mockResolvedValue(undefined);
    mockConfirmIfLargeAudio.mockReturnValue(true);
  });

  it("uses the file picker when available and saves the handle", async () => {
    const file = new File(["audio"], "clip.mp3", { type: "audio/mpeg" });
    const handle = {
      getFile: vi.fn().mockResolvedValue(file),
    } as unknown as FileSystemFileHandle;
    const showOpenFilePicker = vi.fn().mockResolvedValue([handle]);
    Object.defineProperty(window, "showOpenFilePicker", {
      value: showOpenFilePicker,
      writable: true,
    });

    const onAudioUpload = vi.fn();
    render(<FileUpload onAudioUpload={onAudioUpload} onTranscriptUpload={vi.fn()} />);

    await userEvent.click(screen.getByTestId("button-upload-audio"));

    await waitFor(() => expect(onAudioUpload).toHaveBeenCalledWith(file));

    // Handle should be saved with audio reference key
    const audioRef = buildFileReference(file);
    const audioRefKey = JSON.stringify({
      name: audioRef.name,
      size: audioRef.size,
      lastModified: audioRef.lastModified,
    });
    expect(mockSaveAudioHandle).toHaveBeenCalledWith(audioRefKey, handle);

    (window as { showOpenFilePicker?: unknown }).showOpenFilePicker = undefined;
  });

  it("restores audio from a saved handle when requested", async () => {
    const file = new File(["audio"], "clip.mp3", { type: "audio/mpeg" });
    const audioRef = buildFileReference(file);

    // Set mockAudioRef BEFORE rendering
    mockAudioRef = audioRef;

    const handle = {
      getFile: vi.fn().mockResolvedValue(file),
    } as unknown as FileSystemFileHandle;
    mockLoadAudioHandle.mockResolvedValue(handle);
    mockRequestPermission.mockResolvedValue(true);

    const onAudioUpload = vi.fn();
    render(<FileUpload onAudioUpload={onAudioUpload} onTranscriptUpload={vi.fn()} />);

    const restoreButton = await screen.findByTestId("button-restore-audio");
    await userEvent.click(restoreButton);

    await waitFor(() => expect(onAudioUpload).toHaveBeenCalledWith(file));
    expect(mockRequestPermission).toHaveBeenCalledWith(handle);
  });

  it("does not restore audio when permission is denied", async () => {
    const file = new File(["audio"], "clip.mp3", { type: "audio/mpeg" });
    const audioRef = buildFileReference(file);
    mockAudioRef = audioRef;

    const handle = {
      getFile: vi.fn().mockResolvedValue(file),
    } as unknown as FileSystemFileHandle;
    mockLoadAudioHandle.mockResolvedValue(handle);
    mockRequestPermission.mockResolvedValue(false);

    const onAudioUpload = vi.fn();
    render(<FileUpload onAudioUpload={onAudioUpload} onTranscriptUpload={vi.fn()} />);

    const restoreButton = await screen.findByTestId("button-restore-audio");
    await userEvent.click(restoreButton);

    // Wait to ensure async flow completes
    await waitFor(() => expect(mockRequestPermission).toHaveBeenCalledWith(handle));
    expect(onAudioUpload).not.toHaveBeenCalled();
  });

  it("clears handle when user declines large file on restore", async () => {
    const file = new File(["audio"], "clip.mp3", { type: "audio/mpeg" });
    const audioRef = buildFileReference(file);
    mockAudioRef = audioRef;

    const handle = {
      getFile: vi.fn().mockResolvedValue(file),
    } as unknown as FileSystemFileHandle;
    mockLoadAudioHandle.mockResolvedValue(handle);
    mockRequestPermission.mockResolvedValue(true);
    mockConfirmIfLargeAudio.mockReturnValue(false);

    const onAudioUpload = vi.fn();
    render(<FileUpload onAudioUpload={onAudioUpload} onTranscriptUpload={vi.fn()} />);

    const restoreButton = await screen.findByTestId("button-restore-audio");
    await userEvent.click(restoreButton);

    await waitFor(() => expect(mockClearAudioHandle).toHaveBeenCalled());
    expect(onAudioUpload).not.toHaveBeenCalled();
  });

  it("clears old audio handle when uploading new audio via file input", async () => {
    const oldFile = new File(["old"], "old.mp3", { type: "audio/mpeg" });
    mockAudioRef = buildFileReference(oldFile);

    const onAudioUpload = vi.fn();
    render(<FileUpload onAudioUpload={onAudioUpload} onTranscriptUpload={vi.fn()} />);

    const newFile = new File(["new"], "new.mp3", { type: "audio/mpeg" });
    const fileInput = screen.getByTestId("input-audio-file");
    fireEvent.change(fileInput, { target: { files: [newFile] } });

    expect(mockClearAudioHandle).toHaveBeenCalled();
    expect(onAudioUpload).toHaveBeenCalledWith(newFile);
  });
});
