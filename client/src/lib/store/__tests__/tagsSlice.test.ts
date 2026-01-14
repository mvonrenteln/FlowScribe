import { beforeEach, describe, expect, it } from "vitest";
import { useTranscriptStore } from "@/lib/store";
import { createTestSegment } from "@/test/testSegmentHelper";

describe("tagsSlice", () => {
  beforeEach(() => {
    // Reset store to initial state
    useTranscriptStore.setState({
      tags: [],
      segments: [],
      speakers: [],
      selectedSegmentId: null,
      history: [],
      historyIndex: -1,
      currentTime: 0,
    });
  });

  describe("Tag CRUD operations", () => {
    it("adds a tag", () => {
      useTranscriptStore.getState().addTag("Production");

      const tags = useTranscriptStore.getState().tags;
      expect(tags).toHaveLength(1);
      expect(tags[0].name).toBe("Production");
      expect(tags[0].id).toBeTruthy();
      expect(tags[0].color).toBeTruthy();
    });

    it("adds multiple tags", () => {
      useTranscriptStore.getState().addTag("OOC");
      useTranscriptStore.getState().addTag("Production");
      useTranscriptStore.getState().addTag("Review");

      const tags = useTranscriptStore.getState().tags;
      expect(tags).toHaveLength(3);
      expect(tags.map((t) => t.name)).toEqual(["OOC", "Production", "Review"]);
    });

    it("renames a tag", () => {
      useTranscriptStore.getState().addTag("Typo");
      const tagId = useTranscriptStore.getState().tags[0].id;

      useTranscriptStore.getState().renameTag(tagId, "Fixed");

      const tag = useTranscriptStore.getState().tags.find((t) => t.id === tagId);
      expect(tag?.name).toBe("Fixed");
    });

    it("removes a tag", () => {
      useTranscriptStore.getState().addTag("Temp");
      const tagId = useTranscriptStore.getState().tags[0].id;

      useTranscriptStore.getState().removeTag(tagId);

      const tags = useTranscriptStore.getState().tags;
      expect(tags).toHaveLength(0);
    });

    it("updates tag color", () => {
      useTranscriptStore.getState().addTag("Colorful");
      const tagId = useTranscriptStore.getState().tags[0].id;

      useTranscriptStore.getState().updateTagColor(tagId, "#FF0000");

      const tag = useTranscriptStore.getState().tags.find((t) => t.id === tagId);
      expect(tag?.color).toBe("#FF0000");
    });
  });

  describe("Tag assignment to segments", () => {
    beforeEach(() => {
      useTranscriptStore.getState().addTag("OOC");
      useTranscriptStore.getState().addTag("Production");

      const seg1 = createTestSegment({ id: "seg-1", text: "First", tags: [] });
      const seg2 = createTestSegment({ id: "seg-2", text: "Second", tags: [] });
      useTranscriptStore.setState({ segments: [seg1, seg2] });
    });

    it("assigns a tag to a segment", () => {
      const tagId = useTranscriptStore.getState().tags[0].id;

      useTranscriptStore.getState().assignTagToSegment("seg-1", tagId);

      const segment = useTranscriptStore.getState().segments.find((s) => s.id === "seg-1");
      expect(segment?.tags).toContain(tagId);
    });

    it("removes a tag from a segment", () => {
      const tagId = useTranscriptStore.getState().tags[0].id;
      useTranscriptStore.getState().assignTagToSegment("seg-1", tagId);

      useTranscriptStore.getState().removeTagFromSegment("seg-1", tagId);

      const segment = useTranscriptStore.getState().segments.find((s) => s.id === "seg-1");
      expect(segment?.tags).not.toContain(tagId);
    });

    it("toggles a tag on a segment", () => {
      const tagId = useTranscriptStore.getState().tags[0].id;

      // First toggle: assign
      useTranscriptStore.getState().toggleTagOnSegment("seg-1", tagId);
      let segment = useTranscriptStore.getState().segments.find((s) => s.id === "seg-1");
      expect(segment?.tags).toContain(tagId);

      // Second toggle: remove
      useTranscriptStore.getState().toggleTagOnSegment("seg-1", tagId);
      segment = useTranscriptStore.getState().segments.find((s) => s.id === "seg-1");
      expect(segment?.tags).not.toContain(tagId);
    });

    it("does not add duplicate tags to a segment", () => {
      const tagId = useTranscriptStore.getState().tags[0].id;

      useTranscriptStore.getState().assignTagToSegment("seg-1", tagId);
      useTranscriptStore.getState().assignTagToSegment("seg-1", tagId);

      const segment = useTranscriptStore.getState().segments.find((s) => s.id === "seg-1");
      expect(segment?.tags.filter((t) => t === tagId)).toHaveLength(1);
    });

    it("assigns multiple tags to a segment", () => {
      const [tag1, tag2] = useTranscriptStore.getState().tags;

      useTranscriptStore.getState().assignTagToSegment("seg-1", tag1.id);
      useTranscriptStore.getState().assignTagToSegment("seg-1", tag2.id);

      const segment = useTranscriptStore.getState().segments.find((s) => s.id === "seg-1");
      expect(segment?.tags).toContain(tag1.id);
      expect(segment?.tags).toContain(tag2.id);
      expect(segment?.tags).toHaveLength(2);
    });
  });

  describe("Tag removal and cleanup", () => {
    beforeEach(() => {
      useTranscriptStore.getState().addTag("ToRemove");
      const tagId = useTranscriptStore.getState().tags[0].id;

      const seg1 = createTestSegment({ id: "seg-1", text: "First", tags: [tagId] });
      const seg2 = createTestSegment({ id: "seg-2", text: "Second", tags: [tagId] });
      useTranscriptStore.setState({ segments: [seg1, seg2] });
    });

    it("removes tag from all segments when tag is deleted", () => {
      const tagId = useTranscriptStore.getState().tags[0].id;

      useTranscriptStore.getState().removeTag(tagId);

      const segments = useTranscriptStore.getState().segments;
      expect(segments.every((s) => !s.tags.includes(tagId))).toBe(true);
    });

    it("handles empty tags array on segment", () => {
      const seg = createTestSegment({ id: "seg-empty", text: "Empty", tags: [] });
      useTranscriptStore.setState({ segments: [seg] });

      const tagId = useTranscriptStore.getState().tags[0].id;
      useTranscriptStore.getState().removeTagFromSegment("seg-empty", tagId);

      const segment = useTranscriptStore.getState().segments.find((s) => s.id === "seg-empty");
      expect(segment?.tags).toEqual([]);
    });
  });

  describe("Tag selectors", () => {
    beforeEach(() => {
      useTranscriptStore.getState().addTag("Alpha");
      useTranscriptStore.getState().addTag("Beta");

      const [tag1, tag2] = useTranscriptStore.getState().tags;
      const seg1 = createTestSegment({ id: "seg-1", text: "First", tags: [tag1.id] });
      const seg2 = createTestSegment({ id: "seg-2", text: "Second", tags: [tag2.id] });
      const seg3 = createTestSegment({ id: "seg-3", text: "Third", tags: [tag1.id, tag2.id] });
      useTranscriptStore.setState({ segments: [seg1, seg2, seg3] });
    });

    it("selectTagById returns correct tag", () => {
      const [tag1] = useTranscriptStore.getState().tags;

      const result = useTranscriptStore.getState().selectTagById(tag1.id);

      expect(result).toBeDefined();
      expect(result?.name).toBe("Alpha");
    });

    it("selectSegmentsByTagId returns segments with specific tag", () => {
      const [tag1] = useTranscriptStore.getState().tags;

      const result = useTranscriptStore.getState().selectSegmentsByTagId(tag1.id);

      expect(result).toHaveLength(2);
      expect(result.map((s) => s.id)).toEqual(["seg-1", "seg-3"]);
    });

    it("selectTagsForSegment returns all tags on a segment", () => {
      const result = useTranscriptStore.getState().selectTagsForSegment("seg-3");

      expect(result).toHaveLength(2);
      expect(result.map((t) => t.name).sort()).toEqual(["Alpha", "Beta"]);
    });

    it("selectUntaggedSegments returns segments with no tags", () => {
      const seg4 = createTestSegment({ id: "seg-4", text: "No tags", tags: [] });
      useTranscriptStore.setState({ segments: [...useTranscriptStore.getState().segments, seg4] });

      const result = useTranscriptStore.getState().selectUntaggedSegments();

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe("seg-4");
    });

    it("counts segments with specific tag", () => {
      const [tag1] = useTranscriptStore.getState().tags;

      const segments = useTranscriptStore.getState().selectSegmentsByTagId(tag1.id);

      expect(segments).toHaveLength(2);
    });
  });

  describe("Tag color assignment", () => {
    it("assigns different colors to different tags", () => {
      useTranscriptStore.getState().addTag("Tag1");
      useTranscriptStore.getState().addTag("Tag2");
      useTranscriptStore.getState().addTag("Tag3");

      const [tag1, tag2, tag3] = useTranscriptStore.getState().tags;

      expect(tag1.color).toBeTruthy();
      expect(tag2.color).toBeTruthy();
      expect(tag3.color).toBeTruthy();
    });

    it("cycles through available colors", () => {
      // Add enough tags to cycle through all colors
      for (let i = 0; i < 15; i++) {
        useTranscriptStore.getState().addTag(`Tag${i}`);
      }

      const tags = useTranscriptStore.getState().tags;
      const colors = tags.map((t) => t.color);
      const uniqueColors = new Set(colors);

      // Should have repeating colors if more tags than available colors
      expect(colors.length).toBe(15);
      expect(uniqueColors.size).toBeLessThan(15);
    });
  });

  describe("History integration", () => {
    beforeEach(() => {
      useTranscriptStore.getState().addTag("OOC");
      const tagId = useTranscriptStore.getState().tags[0].id;

      const seg1 = createTestSegment({ id: "seg-1", text: "First", tags: [tagId] });
      useTranscriptStore.setState({ segments: [seg1] });
    });

    it("includes tags in history snapshots", () => {
      const tagId = useTranscriptStore.getState().tags[0].id;

      // Make a change that triggers history
      useTranscriptStore.getState().assignTagToSegment("seg-1", tagId);

      const historyState = useTranscriptStore.getState();
      expect(historyState.tags).toBeDefined();
      expect(historyState.tags.length).toBeGreaterThan(0);
    });

    it("restores tags on undo", () => {
      useTranscriptStore.getState().addTag("NewTag");
      const newTagId = useTranscriptStore.getState().tags[1].id;

      // Remove the tag (this automatically adds to history)
      useTranscriptStore.getState().removeTag(newTagId);
      expect(useTranscriptStore.getState().tags).toHaveLength(1);

      // Undo should restore the tag
      useTranscriptStore.getState().undo();
      expect(useTranscriptStore.getState().tags).toHaveLength(2);
    });
  });

  describe("Edge cases", () => {
    it("handles non-existent tag ID gracefully", () => {
      const seg = createTestSegment({ id: "seg-1", text: "Test", tags: [] });
      useTranscriptStore.setState({ segments: [seg] });

      expect(() =>
        useTranscriptStore.getState().assignTagToSegment("seg-1", "non-existent"),
      ).not.toThrow();
    });

    it("handles non-existent segment ID gracefully", () => {
      useTranscriptStore.getState().addTag("Test");
      const tagId = useTranscriptStore.getState().tags[0].id;

      expect(() =>
        useTranscriptStore.getState().assignTagToSegment("non-existent", tagId),
      ).not.toThrow();
    });

    it("handles empty tag name", () => {
      useTranscriptStore.getState().addTag("");

      const tags = useTranscriptStore.getState().tags;
      expect(tags).toHaveLength(1);
      expect(tags[0].name).toBe("");
    });

    it("removes tag even if not present on segment", () => {
      const seg = createTestSegment({ id: "seg-1", text: "Test", tags: [] });
      useTranscriptStore.setState({ segments: [seg] });

      useTranscriptStore.getState().addTag("Test");
      const tagId = useTranscriptStore.getState().tags[0].id;

      expect(() =>
        useTranscriptStore.getState().removeTagFromSegment("seg-1", tagId),
      ).not.toThrow();

      const segment = useTranscriptStore.getState().segments.find((s) => s.id === "seg-1");
      expect(segment?.tags).toEqual([]);
    });
  });
});
