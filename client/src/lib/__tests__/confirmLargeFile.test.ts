import { afterEach, describe, expect, it, vi } from "vitest";
import { confirmIfLargeAudio, formatFileSize } from "@/lib/confirmLargeFile";

const mb = 1024 * 1024;
const gb = 1024 * 1024 * 1024;

const makeFile = (name: string, type: string, size: number) => {
  const file = new File(["x"], name, { type });
  Object.defineProperty(file, "size", { value: size });
  return file;
};

describe("confirmIfLargeAudio", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("formats megabytes and gigabytes for warnings", () => {
    expect(formatFileSize(12.5 * mb)).toBe("12.5 MB");
    expect(formatFileSize(2 * gb)).toBe("2.00 GB");
  });

  it("allows audio files below format-specific limits without prompting", () => {
    const confirm = vi.fn(() => false);
    vi.stubGlobal("confirm", confirm);

    expect(confirmIfLargeAudio(makeFile("short.flac", "audio/flac", 299 * mb))).toBe(true);
    expect(confirm).not.toHaveBeenCalled();
  });

  it("uses the user decision for oversized FLAC and WAV files", () => {
    const confirm = vi.fn(() => false);
    vi.stubGlobal("confirm", confirm);

    const oversizedFlac = makeFile("long.flac", "audio/flac", 301 * mb);
    expect(confirmIfLargeAudio(oversizedFlac)).toBe(false);
    expect(confirm).toHaveBeenCalledOnce();
  });

  it("allows loading if the browser cannot show the confirmation", () => {
    vi.stubGlobal(
      "confirm",
      vi.fn(() => {
        throw new Error("dialog blocked");
      }),
    );

    const oversizedWav = makeFile("long.wav", "audio/wav", gb + 1);
    expect(confirmIfLargeAudio(oversizedWav)).toBe(true);
  });
});
