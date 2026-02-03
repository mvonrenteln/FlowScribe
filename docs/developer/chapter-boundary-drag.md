# Chapter Boundary Dragging

This project treats chapters like book sections: a chapter always ends where the next chapter begins.
Moving a chapter marker changes the boundary between the previous chapter and the current one.

## Behavior

- Drag the chapter handle (six-dot grip) to a target segment.
- The dragged chapter's start updates to that segment.
- The previous chapter expands or contracts so it ends right before the new start.
- The dragged chapter still ends at the start of the next chapter.
- Moving across another chapter's start is disallowed to prevent overlaps.

## Implementation notes

- Drag start sets a dataTransfer payload with `CHAPTER_DRAG_TYPE`.
- Segments accept drops only for that drag type.
- The store action `moveChapterStart` validates the target and recomputes chapter ranges so
  `endSegmentId` stays aligned to the next chapter's start.

## Debugging

- If drops stop working, confirm `CHAPTER_DRAG_TYPE` is used on both drag start and drop.
- Verify the target segment exists in the transcript store before moving.
