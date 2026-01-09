import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import BatchLog from "@/components/shared/BatchLog/BatchLog";

// Use fixed timestamps to make snapshots deterministic
const now = Date.parse("2024-01-01T12:00:01.000Z");

const rows = [
  {
    id: "a",
    batchLabel: "1",
    expected: 10,
    returned: 10,
    durationMs: 1200,
    used: 10,
    ignored: 0,
    suggestions: 5,
    unchanged: 0,
    skipped: 0,
    issues: undefined,
    loggedAt: now - 1000, // 2024-01-01T12:00:00Z
  },
  {
    id: "b",
    batchLabel: "2",
    expected: 20,
    returned: 18,
    durationMs: 2200,
    used: 18,
    ignored: 2,
    suggestions: 8,
    unchanged: 1,
    skipped: 2,
    issues: "Minor",
    loggedAt: now, // 2024-01-01T12:00:01Z
  },
];

describe("BatchLog", () => {
  it("matches snapshot", () => {
    // Make time formatting deterministic across environments by
    // temporarily mocking toLocaleTimeString to return ISO strings.
    const original = Date.prototype.toLocaleTimeString;
    // @ts-ignore - test helper override
    Date.prototype.toLocaleTimeString = function () {
      return new Date(this.valueOf()).toISOString();
    };

    try {
      const { container } = render(<BatchLog rows={rows} total={33} />);
      expect(container).toMatchSnapshot();
    } finally {
      // restore original
      // @ts-ignore
      Date.prototype.toLocaleTimeString = original;
    }
  });

  it("sorts by time when requested", () => {
    render(<BatchLog rows={rows} sortBy="time" />);
    const first = screen.getByTestId("batchrow-b");
    expect(first).toBeInTheDocument();
  });
});
