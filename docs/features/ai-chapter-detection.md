# AI Chapter Detection — Status and User Guide

*Last Updated: January 25, 2026*

## Status (important)

- Manual chapters are implemented and usable today.
- AI-driven chapter detection (automatic suggestions with review/accept UI) is shipped as of **January 25, 2026**.

## What chapters can contain (current)

FlowScribe chapters support the following metadata:

- `title` (required): the chapter heading.
- `summary` (optional): a short summary shown in the chapter header when expanded.
- `notes` (optional): private editor notes (intended to be excluded from AI context by default).
- `tags` (optional): tag IDs used for categorization.

Implementation source of truth: `client/src/types/chapter.ts`.

## Manual chapter management (current)

- Start a chapter at a segment via the segment context menu (“Start Chapter Here”).
- Edit the chapter header inline (title, summary, notes, tags).
- Delete a chapter boundary without deleting transcript segments.
- Undo/redo works for chapter create/update/delete.
- Use the Chapters outline panel to navigate between chapters.

## AI chapter detection (current)

Workflow:

1. Run an AI chapter detection command.
2. Review suggested chapter boundaries and titles.
3. Accept/reject suggestions (ideally “accept all” as a single undoable operation).

Data model alignment:

- The editor’s persisted chapter model is **segment-range based** (`startSegmentId`/`endSegmentId`).
- AI chapter detection uses SimpleIDs (1..n) inside prompts and maps `startSegmentId`/`endSegmentId` back to real segment IDs client-side.
- The parser also accepts legacy `start`/`end` fields (SimpleIDs) for backwards-compatible templates.
