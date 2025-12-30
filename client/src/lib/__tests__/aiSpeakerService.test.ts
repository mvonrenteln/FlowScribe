import { describe, expect, it } from "vitest";
import { summarizeAiSpeakerError, summarizeIssues } from "@/lib/aiSpeakerService";

describe("AI Speaker helpers", () => {
  it("summarizeIssues returns empty string for undefined or empty", () => {
    expect(summarizeIssues(undefined)).toBe("");
    expect(summarizeIssues([])).toBe("");
  });

  it("summarizeIssues joins up to 3 messages and truncates beyond that", () => {
    const issues = [
      { level: "warn", message: "first" },
      { level: "warn", message: "second" },
      { level: "error", message: "third" },
    ];
    expect(summarizeIssues(issues)).toBe("first; second; third");

    const many = [
      { level: "warn", message: "m1" },
      { level: "warn", message: "m2" },
      { level: "warn", message: "m3" },
      { level: "error", message: "m4" },
      { level: "error", message: "m5" },
    ];
    expect(summarizeIssues(many)).toBe("m1; m2; m3 (+2 more)");
  });

  it("summarizeAiSpeakerError handles string and object issues", () => {
    const err1 = new Error("Something bad");
    (err1 as unknown as { details?: unknown }).details = { issues: ["simple issue", "another"] };
    const s1 = summarizeAiSpeakerError(err1);
    expect(s1).toContain("Something bad");
    expect(s1).toContain("simple issue");

    const err2 = new Error("Bad batch");
    (err2 as unknown as { details?: unknown }).details = {
      issues: [{ message: "obj issue" }, { msg: "alt" }],
    };
    const s2 = summarizeAiSpeakerError(err2);
    expect(s2).toContain("Bad batch");
    expect(s2).toContain("obj issue");
    expect(s2).toContain("alt");
  });
});
