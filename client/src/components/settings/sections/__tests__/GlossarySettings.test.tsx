import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { useTranscriptStore } from "@/lib/store";
import type { LexiconEntry } from "@/lib/store/types";
import { GlossarySettings } from "../GlossarySettings";

const resetStore = (entries: LexiconEntry[] = []) => {
  useTranscriptStore.setState({
    lexiconEntries: entries,
    lexiconThreshold: 0.82,
    lexiconHighlightUnderline: false,
    lexiconHighlightBackground: false,
  });
};

describe("GlossarySettings", () => {
  beforeEach(() => {
    resetStore();
  });

  it("filters glossary entries using the search input", () => {
    resetStore([
      { term: "Apple", variants: ["Mac"], falsePositives: [] },
      { term: "Banana", variants: [], falsePositives: ["plantain"] },
    ]);

    render(<GlossarySettings />);

    expect(screen.getByText("Apple")).toBeInTheDocument();
    expect(screen.getByText("Banana")).toBeInTheDocument();

    fireEvent.change(screen.getByPlaceholderText("Search terms, variants, or false positives..."), {
      target: { value: "mac" },
    });

    expect(screen.getByText("Apple")).toBeInTheDocument();
    expect(screen.queryByText("Banana")).not.toBeInTheDocument();
  });

  it("reveals the add form only after clicking the add button", () => {
    render(<GlossarySettings />);

    expect(screen.queryByPlaceholderText("Term...")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Add term" }));
    expect(screen.getByPlaceholderText("Term...")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.queryByPlaceholderText("Term...")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Add term" })).toBeInTheDocument();
  });

  it("opens the edit form from the pencil button and hides it after save", () => {
    resetStore([{ term: "Apple", variants: ["Mac"], falsePositives: [] }]);

    render(<GlossarySettings />);

    fireEvent.click(screen.getByLabelText("Edit Apple"));
    const termInput = screen.getByPlaceholderText("Term...");
    expect(termInput).toHaveValue("Apple");

    fireEvent.change(termInput, { target: { value: "Apple Pie" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    expect(screen.queryByPlaceholderText("Term...")).not.toBeInTheDocument();
    expect(screen.getByText("Apple Pie")).toBeInTheDocument();
  });

  it("deletes glossary entries from the list", () => {
    resetStore([{ term: "Apple", variants: [], falsePositives: [] }]);

    render(<GlossarySettings />);

    fireEvent.click(screen.getByLabelText("Delete Apple"));

    expect(useTranscriptStore.getState().lexiconEntries).toHaveLength(0);
    expect(screen.queryByText("Apple")).not.toBeInTheDocument();
  });
});
