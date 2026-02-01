# AI Chapter Detection

*Last Updated: January 26, 2026*

## Overview

**AI Chapter Detection** structures your transcript into coherent chapters. The AI analyzes the transcript, identifies topic boundaries, and proposes chapters with a title, an optional `summary`, and optional `tags`. You can accept or reject suggestions, and you can always create or edit chapters manually.

This feature helps with navigation, per-chapter processing, and structured exports. AI suggestions are optional — manual chapter editing always works.

---

## What each chapter can hold

- `summary` (optional): A single concise sentence describing what this chapter covers. Hidden by default; shown when you expand the chapter header.
- `notes` (optional): Free-form editorial remarks for your own use. Hidden by default and not shared with the AI unless you explicitly enable that option.
- `tags` (optional): Short labels shown as small badges on the header to help you organize chapters.

---

## Collapsible chapter header

- By default the header is collapsed to keep the timeline clean (shows title and tags).
- Expand the header (click or keyboard) to view `summary` and `notes`.
- Expansion is always explicit — no hover behavior. The header state is local to your UI session.

---

## How AI context is handled

- The AI receives a small amount of nearby context so its chapter suggestions fit the surrounding content. Typically this includes summaries from the two preceding chapters.
- Editor `notes` are private and are not included in AI context unless you enable a setting to share them.

---

## Part A: Manual Chapter Management

- Start a chapter from a segment's context menu ("Start Chapter Here"). The new chapter appears above the chosen segment and is immediately editable inline.
- Click a title to edit it in place. Enter or blur to save; Esc cancels.
- Expand the header to edit `summary` or `notes` in place.
- Use the delete icon (visible in Edit Mode) to remove a chapter boundary — segments are not deleted and Undo restores the boundary.
- Tags are edited inline via a small `+` button in Edit Mode.

---

## Part B: AI Chapter Detection

1. Open the AI Command Panel and choose the "Chapters" tab.
2. Configure the scope and any feature settings (prompt template, min/max chapter length, etc.).
3. Click "Start Detection".
4. The AI processes the transcript and shows suggestions in the panel and inline in the transcript.
5. Review suggestions and Accept or Reject per chapter. Use "Accept All" to apply all suggestions in one undoable step.

Notes:

- Suggestions are preview-only until you accept them.
- If something looks wrong, you can reject or edit the suggested chapter before applying it.
- Accepting or rejecting a suggestion removes it from the suggestions list and the inline preview.

---

## How the detection works

- The AI analyzes the transcript in chunks and proposes chapter boundaries and titles.
- Suggestions are shown for review and require your approval to be applied.
- Nearby context is included so breaks feel natural and consistent.
- If the AI produces an unclear or invalid suggestion, the UI will prompt you to review or retry — nothing is applied automatically.

---

## Exports

- Text export: chapters are added as headings before the relevant segments (e.g. `# Chapter 1: Title`). You can choose whether to include `summary`, `notes`, and `tags`.
- JSON export: chapters can be embedded as metadata on segments or exported as a separate `chapters` array — choose in export settings.

---

## Quick keyboard tip

- Toggle the Chapter Outline Panel: macOS `Cmd+Shift+O`, Windows/Linux `Ctrl+Shift+O`.

---

## Final notes

- Summaries and notes have distinct purposes: summaries are concise content descriptions; notes are private editorial comments.
- The AI helps speed up chaptering but does not replace manual control — you always review and accept changes.
