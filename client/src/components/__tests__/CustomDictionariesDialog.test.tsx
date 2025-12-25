import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { CustomDictionariesDialog } from "@/components/CustomDictionariesDialog";
import { useTranscriptStore } from "@/lib/store";

const resetStore = () => {
  useTranscriptStore.setState({
    spellcheckCustomDictionaries: [],
  });
};

describe("CustomDictionariesDialog", () => {
  beforeEach(() => {
    resetStore();
  });

  it("renders an empty state", () => {
    render(<CustomDictionariesDialog open={true} onOpenChange={() => {}} />);

    expect(screen.getByText("No custom dictionaries yet.")).toBeInTheDocument();
  });

  it("shows no language toggles", () => {
    render(<CustomDictionariesDialog open={true} onOpenChange={() => {}} />);

    expect(screen.queryByText("DE")).toBeNull();
    expect(screen.queryByText("EN")).toBeNull();
  });
});
