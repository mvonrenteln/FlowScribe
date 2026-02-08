import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ChapterHeader } from "@/components/ChapterHeader";
import { CHAPTER_DRAG_TYPE } from "@/lib/dragTypes";
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
    onRewriteChapter: vi.fn(),
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

  it("enters edit mode via menu", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<ChapterHeader {...defaultProps} />);

    // Open the options menu
    const menuButton = screen.getByTestId(`button-chapter-options-${mockChapter.id}`);
    await user.click(menuButton);

    await vi.advanceTimersByTimeAsync(100);

    // Click edit option
    const editMenuItem = await screen.findByTestId(`menu-edit-chapter-${mockChapter.id}`);
    await user.click(editMenuItem);

    await vi.advanceTimersByTimeAsync(100);

    // Wait for the input to appear
    await waitFor(() => {
      expect(screen.getByRole("textbox", { name: /chapter title/i })).toBeInTheDocument();
    });
  });

  it("triggers rewrite from the AI menu", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const onRewriteChapter = vi.fn();
    render(<ChapterHeader {...defaultProps} onRewriteChapter={onRewriteChapter} />);

    const aiButton = screen.getByTestId(`button-chapter-ai-${mockChapter.id}`);
    await user.click(aiButton);

    const rewriteItem = await screen.findByTestId(`menu-rewrite-chapter-${mockChapter.id}`);
    await user.click(rewriteItem);

    expect(onRewriteChapter).toHaveBeenCalledWith(mockChapter.id);
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

  it("shows options menu on hover regardless of isTranscriptEditing", async () => {
    // Note: Options menu is now always visible on hover
    render(<ChapterHeader {...defaultProps} isTranscriptEditing={false} />);

    // Menu button should be in DOM (visible on hover)
    const menuButton = screen.getByTestId(`button-chapter-options-${mockChapter.id}`);
    expect(menuButton).toBeInTheDocument();
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

  it("shows save and cancel buttons in edit mode", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<ChapterHeader {...defaultProps} />);

    // Enter edit mode via double-click
    const titleElement = screen.getByText("Test Chapter");
    await user.dblClick(titleElement);

    await vi.advanceTimersByTimeAsync(100);

    // Should show save and cancel buttons
    expect(screen.getByLabelText("Save chapter title")).toBeInTheDocument();
    expect(screen.getByLabelText("Cancel edit")).toBeInTheDocument();
  });

  it("sets document.body.dataset.transcriptEditing while editing", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<ChapterHeader {...defaultProps} />);

    // Initially no flag set
    expect(document.body.dataset.transcriptEditing).toBeUndefined();

    // Enter edit mode via double-click
    const titleElement = screen.getByText("Test Chapter");
    await user.dblClick(titleElement);

    await vi.advanceTimersByTimeAsync(100);

    // Flag should be set while editing
    expect(document.body.dataset.transcriptEditing).toBe("true");
  });

  it("saves title on Enter key", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const onUpdateChapter = vi.fn();
    render(<ChapterHeader {...defaultProps} onUpdateChapter={onUpdateChapter} />);

    // Enter edit mode via double-click
    const titleElement = screen.getByText("Test Chapter");
    await user.dblClick(titleElement);

    await vi.advanceTimersByTimeAsync(100);

    const input = await screen.findByRole("textbox", { name: /chapter title/i });
    await user.clear(input);
    await user.type(input, "Updated Chapter Title{enter}");

    expect(onUpdateChapter).toHaveBeenCalledWith("chapter-1", { title: "Updated Chapter Title" });
  });

  it("saves title via save button", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const onUpdateChapter = vi.fn();
    render(<ChapterHeader {...defaultProps} onUpdateChapter={onUpdateChapter} />);

    // Enter edit mode
    const titleElement = screen.getByText("Test Chapter");
    await user.dblClick(titleElement);

    await vi.advanceTimersByTimeAsync(100);

    const input = await screen.findByRole("textbox", { name: /chapter title/i });
    await user.clear(input);
    await user.type(input, "Updated via Button");

    // Click save button
    const saveButton = screen.getByLabelText("Save chapter title");
    await user.click(saveButton);

    expect(onUpdateChapter).toHaveBeenCalledWith("chapter-1", { title: "Updated via Button" });
  });

  it("cancels edit on Escape key", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const onUpdateChapter = vi.fn();
    render(<ChapterHeader {...defaultProps} onUpdateChapter={onUpdateChapter} />);

    // Enter edit mode
    const titleElement = screen.getByText("Test Chapter");
    await user.dblClick(titleElement);

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

  it("cancels edit via cancel button", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const onUpdateChapter = vi.fn();
    render(<ChapterHeader {...defaultProps} onUpdateChapter={onUpdateChapter} />);

    // Enter edit mode
    const titleElement = screen.getByText("Test Chapter");
    await user.dblClick(titleElement);

    await vi.advanceTimersByTimeAsync(100);

    const input = await screen.findByRole("textbox", { name: /chapter title/i });
    await user.clear(input);
    await user.type(input, "New Title");

    // Click cancel button
    const cancelButton = screen.getByLabelText("Cancel edit");
    await user.click(cancelButton);

    // Should not call update
    expect(onUpdateChapter).not.toHaveBeenCalled();
    // Original title should be shown
    expect(screen.getByText("Test Chapter")).toBeInTheDocument();
  });

  it("reverts to original title if input is empty on save", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const onUpdateChapter = vi.fn();
    render(<ChapterHeader {...defaultProps} onUpdateChapter={onUpdateChapter} />);

    // Enter edit mode
    const titleElement = screen.getByText("Test Chapter");
    await user.dblClick(titleElement);

    await vi.advanceTimersByTimeAsync(100);

    const input = await screen.findByRole("textbox", { name: /chapter title/i });
    await user.clear(input);
    await user.keyboard("{Enter}");

    // Should not call update with empty title
    expect(onUpdateChapter).not.toHaveBeenCalled();
    // Original title should be shown
    expect(screen.getByText("Test Chapter")).toBeInTheDocument();
  });

  it("calls onDeleteChapter when delete menu item is clicked", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const onDeleteChapter = vi.fn();
    render(<ChapterHeader {...defaultProps} onDeleteChapter={onDeleteChapter} />);

    // Open options menu
    const optionsButton = screen.getByTestId(`button-chapter-options-${mockChapter.id}`);
    await user.click(optionsButton);

    await vi.advanceTimersByTimeAsync(100);

    // Click delete option
    const deleteMenuItem = await screen.findByTestId(`menu-delete-chapter-${mockChapter.id}`);
    await user.click(deleteMenuItem);

    expect(onDeleteChapter).toHaveBeenCalledWith("chapter-1");
  });

  it("calls onOpen when title area is clicked", async () => {
    const onOpen = vi.fn();
    render(<ChapterHeader {...defaultProps} onOpen={onOpen} />);

    // Click on the title area container (avoid span pointer-event quirks in tests)
    const candidates = screen.getAllByRole("button", { name: /test chapter/i });
    const titleButton = candidates.find((el) => el.tagName === "DIV");
    if (!titleButton) {
      throw new Error("Title button container not found");
    }
    fireEvent.click(titleButton);

    expect(onOpen).toHaveBeenCalled();
  });

  it("builds a transcript-width drag preview when dragging the handle", () => {
    render(
      <div data-transcript-container="true">
        <ChapterHeader {...defaultProps} />
      </div>,
    );

    const container = document.querySelector("[data-transcript-container]") as HTMLElement | null;
    if (!container) {
      throw new Error("Transcript container not found");
    }
    container.getBoundingClientRect = () =>
      ({
        width: 720,
        height: 0,
        top: 0,
        left: 0,
        bottom: 0,
        right: 0,
        x: 0,
        y: 0,
        toJSON: () => {},
      }) as DOMRect;

    const setData = vi.fn();
    const setDragImage = vi.fn();
    const dataTransfer = {
      setData,
      setDragImage,
      effectAllowed: "",
    } as unknown as DataTransfer;

    const handle = screen.getByLabelText("Drag to move chapter boundary");
    fireEvent.dragStart(handle, { dataTransfer });

    expect(setData).toHaveBeenCalledWith(CHAPTER_DRAG_TYPE, "chapter-1");
    expect(setDragImage).toHaveBeenCalled();
    const preview = setDragImage.mock.calls[0]?.[0] as HTMLElement | undefined;
    expect(preview?.textContent).toContain("Test Chapter");
    expect(preview?.style.width).toBe("720px");
  });
});
