import { act, fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { SearchAndReplacePanel } from "../SearchAndReplacePanel";

describe("SearchAndReplacePanel", () => {
  const defaultProps = {
    searchQuery: "",
    onSearchQueryChange: vi.fn(),
    replaceQuery: "",
    onReplaceQueryChange: vi.fn(),
    isRegexSearch: false,
    onToggleRegexSearch: vi.fn(),
    currentMatchIndex: -1,
    totalMatches: 0,
    goToNextMatch: vi.fn(),
    goToPrevMatch: vi.fn(),
    onReplaceCurrent: vi.fn(),
    onReplaceAll: vi.fn(),
  };

  it("renders search input", () => {
    render(<SearchAndReplacePanel {...defaultProps} />);
    expect(screen.getByPlaceholderText(/search transcript/i)).toBeDefined();
  });

  it("calls onSearchQueryChange with debounce", async () => {
    vi.useFakeTimers();
    render(<SearchAndReplacePanel {...defaultProps} />);
    const input = screen.getByPlaceholderText(/search transcript/i);

    fireEvent.change(input, { target: { value: "test" } });

    // Should not be called immediately
    expect(defaultProps.onSearchQueryChange).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(300);
    });

    expect(defaultProps.onSearchQueryChange).toHaveBeenCalledWith("test");
    vi.useRealTimers();
  });

  it("shows replace input when toggle button is clicked", () => {
    render(<SearchAndReplacePanel {...defaultProps} />);
    const toggleButton = screen.getByTitle(/toggle replace/i);

    fireEvent.click(toggleButton);
    expect(screen.getByPlaceholderText(/replace with/i)).toBeDefined();
  });

  it("calls navigation and replace functions", () => {
    const props = { ...defaultProps, totalMatches: 5, currentMatchIndex: 0 };
    render(<SearchAndReplacePanel {...props} />);

    // Toggle replace on
    fireEvent.click(screen.getByTitle(/toggle replace/i));

    fireEvent.click(screen.getByTitle(/next match/i));
    expect(props.goToNextMatch).toHaveBeenCalled();

    fireEvent.click(screen.getByText(/replace/i, { selector: "button" }));
    expect(props.onReplaceCurrent).toHaveBeenCalled();

    fireEvent.click(screen.getByText(/all/i));
    expect(props.onReplaceAll).toHaveBeenCalled();
  });

  it("steps through matches with arrow up/down in search input", () => {
    const goToNextMatch = vi.fn();
    const goToPrevMatch = vi.fn();
    const props = {
      ...defaultProps,
      totalMatches: 3,
      currentMatchIndex: 1,
      goToNextMatch,
      goToPrevMatch,
    };
    render(<SearchAndReplacePanel {...props} />);

    const input = screen.getByTestId("input-search-transcript");
    fireEvent.keyDown(input, { key: "ArrowDown" });
    expect(goToNextMatch).toHaveBeenCalledTimes(1);

    fireEvent.keyDown(input, { key: "ArrowUp" });
    expect(goToPrevMatch).toHaveBeenCalledTimes(1);
  });

  it("calls onReplaceQueryChange when typing", () => {
    render(<SearchAndReplacePanel {...defaultProps} />);
    fireEvent.click(screen.getByTitle(/toggle replace/i));
    const input = screen.getByPlaceholderText(/replace with/i);

    fireEvent.change(input, { target: { value: "new value" } });
    expect(defaultProps.onReplaceQueryChange).toHaveBeenCalledWith("new value");
  });
});
