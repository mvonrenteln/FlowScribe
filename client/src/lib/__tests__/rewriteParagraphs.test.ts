import { describe, expect, it } from "vitest";
import {
  getPreviousParagraphs,
  replaceParagraphAtIndex,
  splitRewrittenParagraphs,
} from "../rewriteParagraphs";

describe("rewriteParagraphs", () => {
  it("splits and replaces paragraphs", () => {
    const text = "First.\n\nSecond.\n\nThird.";
    const paragraphs = splitRewrittenParagraphs(text);
    expect(paragraphs).toEqual(["First.", "Second.", "Third."]);

    const updated = replaceParagraphAtIndex(text, 1, "Updated.");
    expect(updated).toBe("First.\n\nUpdated.\n\nThird.");
  });

  it("returns previous paragraph context", () => {
    const paragraphs = ["One", "Two", "Three", "Four"];
    const previous = getPreviousParagraphs(paragraphs, 3, 2);
    expect(previous).toEqual(["Two", "Three"]);
  });
});
