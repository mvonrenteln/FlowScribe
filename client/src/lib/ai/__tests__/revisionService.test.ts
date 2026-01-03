/**
 * Revision Service Tests
 *
 * Tests for the text revision service helper functions.
 */

import { describe, expect, it } from "vitest";
import { getDefaultPrompt } from "../features/revision/config";
import { buildRevisionPrompt, getChangePreview, hasChanges } from "../features/revision/service";

describe("Revision Service", () => {
  describe("hasChanges", () => {
    it("should return false for identical text", () => {
      expect(hasChanges("Hello world", "Hello world")).toBe(false);
    });

    it("should return false for text with only whitespace differences", () => {
      expect(hasChanges("Hello world", "  Hello world  ")).toBe(false);
    });

    it("should return true for different text", () => {
      expect(hasChanges("Hello world", "Hello there")).toBe(true);
    });

    it("should return true for added text", () => {
      expect(hasChanges("Hello", "Hello world")).toBe(true);
    });

    it("should return true for removed text", () => {
      expect(hasChanges("Hello world", "Hello")).toBe(true);
    });
  });

  describe("buildRevisionPrompt", () => {
    const template = getDefaultPrompt();

    it("should include the text to revise", () => {
      const prompt = buildRevisionPrompt(template, "Hello world");
      expect(prompt).toContain("Hello world");
    });

    it("should include previous context when provided", () => {
      const prompt = buildRevisionPrompt(template, "Hello world", {
        previousText: "Previous segment",
      });
      expect(prompt).toContain("Previous segment");
    });

    it("should include next context when provided", () => {
      const prompt = buildRevisionPrompt(template, "Hello world", {
        nextText: "Next segment",
      });
      expect(prompt).toContain("Next segment");
    });

    it("should handle empty context", () => {
      const prompt = buildRevisionPrompt(template, "Hello world", {});
      expect(prompt).toContain("Hello world");
    });
  });

  describe("getChangePreview", () => {
    it("should return 'No changes' for identical text", () => {
      expect(getChangePreview("Hello", "Hello")).toBe("No changes");
    });

    it("should return preview for changed text", () => {
      const preview = getChangePreview("Hello", "Hello world");
      expect(preview).not.toBe("No changes");
      expect(preview.length).toBeGreaterThan(0);
    });

    it("should truncate long previews", () => {
      const original = "a".repeat(50);
      const revised = "b".repeat(200);
      const preview = getChangePreview(original, revised, 50);
      expect(preview.length).toBeLessThanOrEqual(50);
    });

    it("should handle whitespace-only changes", () => {
      expect(getChangePreview("Hello", "  Hello  ")).toBe("No changes");
    });
  });

  describe("getDefaultPrompt", () => {
    it("should return a valid template", () => {
      const template = getDefaultPrompt();
      expect(template).toBeDefined();
      expect(template.id).toBeDefined();
      expect(template.systemPrompt).toBeDefined();
      expect(template.userPromptTemplate).toBeDefined();
    });

    it("should return cleanup template as default", () => {
      const template = getDefaultPrompt();
      expect(template.id).toContain("cleanup");
    });
  });
});
