import { describe, expect, it } from "vitest";
import { buildSessionKey, isSameFileReference, serializeFileReference } from "@/lib/fileReference";

describe("fileReference helpers", () => {
  it("serializes file references consistently", () => {
    const ref = { name: "audio file.mp3", size: 10, lastModified: 20 };
    expect(serializeFileReference(ref)).toBe("audio%20file.mp3:10:20");
  });

  it("builds session keys and compares references", () => {
    const audioRef = { name: "audio.mp3", size: 10, lastModified: 1 };
    const transcriptRef = { name: "transcript.json", size: 5, lastModified: 2 };

    expect(buildSessionKey(audioRef, transcriptRef)).toContain("audio:");
    expect(buildSessionKey(null, null)).toBe("audio:none|transcript:none");
    expect(isSameFileReference(audioRef, audioRef)).toBe(true);
    expect(isSameFileReference(audioRef, null)).toBe(false);
    expect(isSameFileReference(audioRef, { ...audioRef, size: 11 })).toBe(false);
  });
});
