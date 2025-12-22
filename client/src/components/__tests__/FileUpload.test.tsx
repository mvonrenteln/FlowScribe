import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { FileUpload } from "@/components/FileUpload";
import {
  loadAudioHandle,
  requestAudioHandlePermission,
  saveAudioHandle,
} from "@/lib/audioHandleStorage";

vi.mock("@/lib/audioHandleStorage", () => ({
  clearAudioHandle: vi.fn(),
  loadAudioHandle: vi.fn(),
  requestAudioHandlePermission: vi.fn(),
  saveAudioHandle: vi.fn(),
}));

describe("FileUpload", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(loadAudioHandle).mockResolvedValue(null);
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
    expect(vi.mocked(saveAudioHandle)).toHaveBeenCalledWith(handle);

    (window as { showOpenFilePicker?: unknown }).showOpenFilePicker = undefined;
  });

  it("restores audio from a saved handle when requested", async () => {
    const file = new File(["audio"], "clip.mp3", { type: "audio/mpeg" });
    const handle = {
      getFile: vi.fn().mockResolvedValue(file),
    } as unknown as FileSystemFileHandle;
    vi.mocked(loadAudioHandle).mockResolvedValue(handle);
    vi.mocked(requestAudioHandlePermission).mockResolvedValue(true);

    const onAudioUpload = vi.fn();
    render(<FileUpload onAudioUpload={onAudioUpload} onTranscriptUpload={vi.fn()} />);

    const restoreButton = await screen.findByTestId("button-restore-audio");
    await userEvent.click(restoreButton);

    await waitFor(() => expect(onAudioUpload).toHaveBeenCalledWith(file));
    expect(vi.mocked(requestAudioHandlePermission)).toHaveBeenCalledWith(handle);
  });
});
