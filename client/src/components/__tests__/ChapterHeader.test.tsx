import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ChapterHeader } from "@/components/ChapterHeader";
import type { Chapter, Tag } from "@/lib/store";

const mockChapter: Chapter = {
  id: "chapter-1",
  title: "Test Chapter",
  startSegmentId: "segment-1",
  endSegmentId: "segment-3",
  segmentCount: 3,
  createdAt: Date.now(),
  source: "manual",
};

const mockTags: Tag[] = [
  { id: "tag-1", name: "Important", color: "#ff0000" },
  { id: "tag-2", name: "Review", color: "#00ff00" },
];

describe("ChapterHeader", () => {
  const defaultProps = {
    chapter: mockChapter,
    tags: mockTags,
    isSelected: false,
    onOpen: vi.fn(),
    onUpdateChapter: vi.fn(),
    onDeleteChapter: vi.fn(),
    isTranscriptEditing: true,
  };

  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    // Clean up any previous transcriptEditing flag
    delete document.body.dataset.transcriptEditing;
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();
    // Clean up transcriptEditing flag after each test
    delete document.body.dataset.transcriptEditing;
  });

  it("renders chapter title", () => {
    render(<ChapterHeader {...defaultProps} />);
    expect(screen.getByText("Test Chapter")).toBeInTheDocument();
  });

  it("enters edit mode when edit button is clicked", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<ChapterHeader {...defaultProps} />);

    const editButton = screen.getByTestId(`button-edit-chapter-title-${mockChapter.id}`);
    await user.click(editButton);

    // Wait for the input to appear
    await waitFor(() => {
      expect(screen.getByRole("textbox", { name: /chapter title/i })).toBeInTheDocument();
    });
  });

  it("enters edit mode when title is double-clicked", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<ChapterHeader {...defaultProps} />);

    const titleElement = screen.getByText("Test Chapter");
    await user.dblClick(titleElement);

    // Wait for the input to appear
    await waitFor(() => {
      expect(screen.getByRole("textbox", { name: /chapter title/i })).toBeInTheDocument();
    });
  });

  it("does not show edit button when isTranscriptEditing is false (but edit button is always visible now)", async () => {
    // Note: Edit button is now always visible on hover, regardless of isTranscriptEditing
    render(<ChapterHeader {...defaultProps} isTranscriptEditing={false} />);

    // Edit button should still be in DOM (visible on hover)
    const editButton = screen.getByTestId(`button-edit-chapter-title-${mockChapter.id}`);
    expect(editButton).toBeInTheDocument();
  });

  it("auto-focuses and selects title when autoFocus is true", async () => {
    const onAutoFocusHandled = vi.fn();
    render(
      <ChapterHeader {...defaultProps} autoFocus={true} onAutoFocusHandled={onAutoFocusHandled} />,
    );

    // Advance timers to allow requestAnimationFrame to fire
    await vi.advanceTimersByTimeAsync(100);

    // Should enter edit mode and focus input
    const input = await screen.findByRole("textbox", { name: /chapter title/i });
    expect(input).toBeInTheDocument();
    expect(input).toHaveFocus();
    expect(onAutoFocusHandled).toHaveBeenCalled();
  });

  it("auto-focuses even when isTranscriptEditing is false (new chapter creation)", async () => {
    const onAutoFocusHandled = vi.fn();
    render(
      <ChapterHeader
        {...defaultProps}
        autoFocus={true}
        onAutoFocusHandled={onAutoFocusHandled}
        isTranscriptEditing={false}
      />,
    );

    await vi.advanceTimersByTimeAsync(100);

    // Should still enter edit mode because autoFocus overrides isTranscriptEditing
    const input = await screen.findByRole("textbox", { name: /chapter title/i });
    expect(input).toBeInTheDocument();
    expect(input).toHaveFocus();
    expect(onAutoFocusHandled).toHaveBeenCalled();
  });

  it("sets document.body.dataset.transcriptEditing while editing", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<ChapterHeader {...defaultProps} />);

    // Initially no flag set
    expect(document.body.dataset.transcriptEditing).toBeUndefined();

    // Enter edit mode via edit button
    const editButton = screen.getByTestId(`button-edit-chapter-title-${mockChapter.id}`);
    await user.click(editButton);

    await vi.advanceTimersByTimeAsync(100);

    // Flag should be set while editing
    expect(document.body.dataset.transcriptEditing).toBe("true");
  });

  it("saves title on Enter key", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const onUpdateChapter = vi.fn();
    render(<ChapterHeader {...defaultProps} onUpdateChapter={onUpdateChapter} />);

    // Enter edit mode via edit button
    const editButton = screen.getByTestId(`button-edit-chapter-title-${mockChapter.id}`);
    await user.click(editButton);

    await vi.advanceTimersByTimeAsync(100);

    const input = await screen.findByRole("textbox", { name: /chapter title/i });
    await user.clear(input);
    await user.type(input, "Updated Chapter Title{enter}");

    expect(onUpdateChapter).toHaveBeenCalledWith("chapter-1", { title: "Updated Chapter Title" });
  });

  it("cancels edit on Escape key", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const onUpdateChapter = vi.fn();
    render(<ChapterHeader {...defaultProps} onUpdateChapter={onUpdateChapter} />);

    // Enter edit mode via edit button
    const editButton = screen.getByTestId(`button-edit-chapter-title-${mockChapter.id}`);
    await user.click(editButton);

    await vi.advanceTimersByTimeAsync(100);

    const input = await screen.findByRole("textbox", { name: /chapter title/i });
    await user.clear(input);
    await user.type(input, "New Title");
    await user.keyboard("{Escape}");

    // Should not call update
    expect(onUpdateChapter).not.toHaveBeenCalled();
    // Original title should be shown again
    expect(screen.getByText("Test Chapter")).toBeInTheDocument();
  });

  it("reverts to original title if input is empty on save", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const onUpdateChapter = vi.fn();
    render(<ChapterHeader {...defaultProps} onUpdateChapter={onUpdateChapter} />);

    // Enter edit mode via edit button
    const editButton = screen.getByTestId(`button-edit-chapter-title-${mockChapter.id}`);
    await user.click(editButton);

    await vi.advanceTimersByTimeAsync(100);

    const input = await screen.findByRole("textbox", { name: /chapter title/i });
    await user.clear(input);
    await user.keyboard("{Enter}");

    // Should not call update with empty title
    expect(onUpdateChapter).not.toHaveBeenCalled();
    // Original title should be shown
    expect(screen.getByText("Test Chapter")).toBeInTheDocument();
  });

  it("opens rename menu via options dropdown", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<ChapterHeader {...defaultProps} />);

    // Click the options menu
    const optionsButton = screen.getByTestId(`button-chapter-options-${mockChapter.id}`);
    await user.click(optionsButton);

    await vi.advanceTimersByTimeAsync(100);

    // Click rename option
    const renameMenuItem = await screen.findByTestId(`menu-rename-chapter-${mockChapter.id}`);
    await user.click(renameMenuItem);

    await vi.advanceTimersByTimeAsync(100);

    // Input should appear in edit mode
    const input = await screen.findByRole("textbox", { name: /chapter title/i });
    expect(input).toBeInTheDocument();
  });

  it("calls onDeleteChapter when delete button is clicked", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const onDeleteChapter = vi.fn();
    render(<ChapterHeader {...defaultProps} onDeleteChapter={onDeleteChapter} />);

    const deleteButton = screen.getByRole("button", { name: /delete chapter/i });
    await user.click(deleteButton);

    expect(onDeleteChapter).toHaveBeenCalledWith("chapter-1");
  });

  it("calls onOpen when title area is clicked", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const onOpen = vi.fn();
    render(<ChapterHeader {...defaultProps} onOpen={onOpen} />);

    // Click on the title text
    const titleElement = screen.getByText("Test Chapter");
    await user.click(titleElement);

    expect(onOpen).toHaveBeenCalled();
  });
});
