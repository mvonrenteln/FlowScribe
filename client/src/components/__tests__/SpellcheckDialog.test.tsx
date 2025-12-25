import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it } from "vitest";
import { SpellcheckDialog } from "@/components/SpellcheckDialog";
import { useTranscriptStore } from "@/lib/store";

const resetStore = () => {
  useTranscriptStore.setState({
    spellcheckIgnoreWords: [],
  });
};

describe("SpellcheckDialog", () => {
  beforeEach(() => {
    resetStore();
  });

  it("adds and removes ignored words", async () => {
    render(<SpellcheckDialog open={true} onOpenChange={() => {}} />);

    const input = screen.getByTestId("input-spellcheck-ignore");
    await userEvent.type(input, "Glymbar{enter}");

    expect(useTranscriptStore.getState().spellcheckIgnoreWords).toContain("glymbar");
    expect(screen.getByText("glymbar")).toBeInTheDocument();

    const removeButton = screen.getByRole("button", { name: "Remove glymbar" });
    await userEvent.click(removeButton);

    expect(useTranscriptStore.getState().spellcheckIgnoreWords).not.toContain("glymbar");
  });
});
