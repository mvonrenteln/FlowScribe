import { render, screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ScopeSection } from "../ScopeSection";

describe("ScopeSection", () => {
  it("displays 'All' when not filtered", () => {
    render(
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
    render(
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
    render(
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

    render(
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
    render(
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
    render(
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
    render(
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
