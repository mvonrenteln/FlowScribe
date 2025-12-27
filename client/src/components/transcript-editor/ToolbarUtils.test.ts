import {
  formatAudioName,
  formatTranscriptName,
  getFileExtension,
  getFileNameWithoutExtension,
} from "./ToolbarUtils";

describe("ToolbarUtils", () => {
  describe("getFileNameWithoutExtension", () => {
    it("should return the file name without extension", () => {
      expect(getFileNameWithoutExtension("test.mp3")).toBe("test");
    });

    it("should return the full name if no extension is present", () => {
      expect(getFileNameWithoutExtension("test")).toBe("test");
    });

    it("should handle multiple dots correctly", () => {
      expect(getFileNameWithoutExtension("test.v1.mp3")).toBe("test.v1");
    });

    it('should return an empty string if the name is just an extension', () => {
      expect(getFileNameWithoutExtension(".mp3")).toBe("");
    });

    it("should return an empty string for undefined input", () => {
      expect(getFileNameWithoutExtension(undefined)).toBe("");
    });
  });

  describe("getFileExtension", () => {
    it("should return the extension with a dot", () => {
      expect(getFileExtension("test.mp3")).toBe(".mp3");
    });

    it("should return an empty string if no extension is present", () => {
      expect(getFileExtension("test")).toBe("");
    });

    it("should handle multiple dots correctly", () => {
      expect(getFileExtension("test.v1.mp3")).toBe(".mp3");
    });

    it('should return the extension if the name is just an extension', () => {
      expect(getFileExtension(".mp3")).toBe(".mp3");
    });

    it("should return an empty string for undefined input", () => {
      expect(getFileExtension(undefined)).toBe("");
    });
  });

  describe("formatAudioName", () => {
    it("should format the audio name correctly", () => {
      expect(formatAudioName("test.mp3")).toBe("test");
    });

    it("should return 'Unknown Audio' for undefined input", () => {
      expect(formatAudioName(undefined)).toBe("Unknown Audio");
    });
  });

  describe("formatTranscriptName", () => {
    it("should format the transcript name correctly", () => {
      expect(formatTranscriptName("test.json")).toBe("test");
    });



    it("should return 'Untitled transcript' for undefined input", () => {
      expect(formatTranscriptName(undefined)).toBe("Untitled transcript");
    });
  });
});

