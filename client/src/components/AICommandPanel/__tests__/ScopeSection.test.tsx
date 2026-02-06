import { screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ScopeSection } from "../ScopeSection";
import { renderWithI18n } from "./testUtils";

describe("ScopeSection", () => {
  it("displays 'All' when not filtered", () => {
    renderWithI18n(
      <ScopeSection
        scopedSegmentCount={150}
        isFiltered={false}
        excludeConfirmed={true}
        onExcludeConfirmedChange={vi.fn()}
        id="test"
      />,
    );

    expect(screen.getByText(/All: 150 segments/)).toBeInTheDocument();
  });

  it("displays 'Filtered' when filtered", () => {
    renderWithI18n(
      <ScopeSection
        scopedSegmentCount={50}
        isFiltered={true}
        excludeConfirmed={true}
        onExcludeConfirmedChange={vi.fn()}
        id="test"
      />,
    );

    expect(screen.getByText(/Filtered: 50 segments/)).toBeInTheDocument();
  });

  it("handles singular 'segment' for count of 1", () => {
    renderWithI18n(
      <ScopeSection
        scopedSegmentCount={1}
        isFiltered={false}
        excludeConfirmed={true}
        onExcludeConfirmedChange={vi.fn()}
        id="test"
      />,
    );

    expect(screen.getByText(/All: 1 segment$/)).toBeInTheDocument();
  });

  it("calls onExcludeConfirmedChange when checkbox toggled", async () => {
    const user = userEvent.setup();
    const handleChange = vi.fn();

    renderWithI18n(
      <ScopeSection
        scopedSegmentCount={100}
        isFiltered={false}
        excludeConfirmed={false}
        onExcludeConfirmedChange={handleChange}
        id="test"
      />,
    );

    const checkbox = screen.getByRole("checkbox", { name: /exclude confirmed/i });
    await user.click(checkbox);

    expect(handleChange).toHaveBeenCalledWith(true);
  });

  it("checkbox is checked when excludeConfirmed is true", () => {
    renderWithI18n(
      <ScopeSection
        scopedSegmentCount={100}
        isFiltered={false}
        excludeConfirmed={true}
        onExcludeConfirmedChange={vi.fn()}
        id="test"
      />,
    );

    const checkbox = screen.getByRole("checkbox", { name: /exclude confirmed/i });
    expect(checkbox).toBeChecked();
  });

  it("checkbox is unchecked when excludeConfirmed is false", () => {
    renderWithI18n(
      <ScopeSection
        scopedSegmentCount={100}
        isFiltered={false}
        excludeConfirmed={false}
        onExcludeConfirmedChange={vi.fn()}
        id="test"
      />,
    );

    const checkbox = screen.getByRole("checkbox", { name: /exclude confirmed/i });
    expect(checkbox).not.toBeChecked();
  });

  it("uses unique id for checkbox/label association", () => {
    renderWithI18n(
      <ScopeSection
        scopedSegmentCount={100}
        isFiltered={false}
        excludeConfirmed={true}
        onExcludeConfirmedChange={vi.fn()}
        id="unique-test-id"
      />,
    );

    const checkbox = screen.getByRole("checkbox", { name: /exclude confirmed/i });
    expect(checkbox).toHaveAttribute("id", "unique-test-id-exclude-confirmed");
  });
});
