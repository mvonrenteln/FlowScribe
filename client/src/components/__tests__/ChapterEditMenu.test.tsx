import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ChapterEditMenu } from "@/components/ChapterEditMenu";
import type { Chapter, Tag } from "@/lib/store";

const chapter: Chapter = {
  id: "chapter-1",
  title: "Intro",
  startSegmentId: "seg-1",
  endSegmentId: "seg-1",
  segmentCount: 1,
  createdAt: 0,
  source: "manual",
};

const tags: Tag[] = [{ id: "tag-1", name: "KEEP", color: "#ef4444" }];

describe("ChapterEditMenu", () => {
  it("commits title changes on blur", async () => {
    const user = userEvent.setup();
    const onUpdateChapter = vi.fn();

    render(
      <ChapterEditMenu
        chapter={chapter}
        tags={tags}
        onUpdateChapter={onUpdateChapter}
        onDeleteChapter={vi.fn()}
        open={true}
        onOpenChange={vi.fn()}
      />,
    );

    const titleInput = screen.getByLabelText("Title");
    await user.clear(titleInput);
    await user.type(titleInput, "  New title  ");
    fireEvent.blur(titleInput);

    expect(onUpdateChapter).toHaveBeenCalledWith("chapter-1", { title: "New title" });
  });
});
