import { describe, expect, it } from "vitest";
import { truncateText } from "../utils/truncateText";

describe("truncateText", () => {
  it("returns the original text when it is short enough", () => {
    expect(truncateText("Hello", 10)).toBe("Hello");
  });

  it("truncates and appends ellipsis when text is too long", () => {
    expect(truncateText("Hello World", 5)).toBe("Hello...");
  });
});
