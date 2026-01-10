import { describe, expect, it } from "vitest";
import { formatDurationMs } from "@/lib/formatting";

describe("formatDurationMs", () => {
  it("returns dash for undefined", () => {
    expect(formatDurationMs(undefined)).toBe("—");
  });

  it("formats seconds under 60s with two decimals", () => {
    // 12.345s -> rounded to 12s
    expect(formatDurationMs(12345)).toBe("12s");
  });

  it("formats sub-second durations with one decimal", () => {
    // 150ms -> 0.2s
    expect(formatDurationMs(150)).toBe("0.2s");
    // 999ms rounds to 1s
    expect(formatDurationMs(999)).toBe("1s");
  });

  it("formats minutes for durations >= 60s", () => {
    // 197.15 seconds = 3 minutes 17.15 seconds
    // rounds to nearest second -> 197s = 3m17s
    expect(formatDurationMs(197.15 * 1000)).toBe("3m17s");
  });
});
