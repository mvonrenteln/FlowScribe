import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { AICommandPanel } from "@/components/AICommandPanel/AICommandPanel";

vi.mock("@/components/AICommandPanel/RevisionPanel", () => ({
  RevisionPanel: () => <div data-testid="revision-panel" />,
}));

vi.mock("@/components/AICommandPanel/SpeakerPanel", () => ({
  SpeakerPanel: () => <div data-testid="speaker-panel" />,
}));

vi.mock("@/components/AICommandPanel/MergePanel", () => ({
  MergePanel: () => <div data-testid="merge-panel" />,
}));

describe("AICommandPanel", () => {
  it("renders the revision tab by default and switches tabs", async () => {
    const user = userEvent.setup();
    render(
      <AICommandPanel
        open={true}
        onOpenChange={vi.fn()}
        filteredSegmentIds={[]}
        onOpenSettings={vi.fn()}
      />,
    );

    expect(screen.getByTestId("revision-panel")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Speaker" }));
    expect(screen.getByTestId("speaker-panel")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Merge" }));
    expect(screen.getByTestId("merge-panel")).toBeInTheDocument();
  });

  it("calls onOpenChange when closing", async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    render(
      <AICommandPanel
        open={true}
        onOpenChange={onOpenChange}
        filteredSegmentIds={[]}
        onOpenSettings={vi.fn()}
      />,
    );

    await user.click(screen.getByLabelText("Close AI command panel"));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});
