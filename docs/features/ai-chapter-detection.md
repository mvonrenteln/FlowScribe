# AI Chapter Detection

*Last Updated: January 23, 2026*

## Overview

**AI Chapter Detection** structures your transcript into coherent chapters. The AI analyzes batches of ~50–200 segments, identifies topic boundaries, and proposes chapters with a title, optional `summary`, and optional `tags`. You can accept or reject suggestions, and you can always create/edit chapters manually.

The goal is to support navigation, per-chapter processing, and structured exports.

**Manual-first:** Chapters must work fully without AI. AI is an optional accelerator.

---

## Chapter Meta Information (Final)

This section defines the stable semantics and UX behavior of chapter meta information.

### Meta fields

Each chapter supports the following meta fields:

#### `summary` (optional)

- **Purpose:** A single concise sentence describing what happens in this chapter.
- **Semantics:** Content-focused; no instructions; no meta commentary.
- **Primary use:** Passed as continuity context to subsequent AI batch runs.
- **Constraint:** One sentence (enforced by guidance; no strict validation initially).
- **Visibility:** Hidden by default; shown only when the chapter header is expanded.

#### `notes` (optional)

- **Purpose:** Flexible editorial metadata describing how this chapter should be understood or treated.
- **Intended uses:** Narrative intent, reminders/TODOs, interpretation hints, and other open-ended editorial remarks.
- **Design principle:** Intentionally open-ended; not split into smaller typed fields.
- **Visibility:** Hidden by default; shown only when the chapter header is expanded.
- **AI usage:** Excluded from AI context by default; can be explicitly included via a configuration toggle.

#### `tags` (optional)

- Short categorical labels (e.g. `KEEP`).
- Displayed as compact badges in the collapsed chapter header.
- Kept visually low-prominence to avoid timeline clutter.

### UX: Collapsible chapter header (canonical)

**Principles:**
- The timeline shows structure, not metadata.
- Meta information is discoverable, not persistent.
- Expanded state is intentional, not accidental.

**Collapsed (default):**
- Visible: chapter title, `tags` badges.
- Hidden: `summary`, `notes`, and all extended metadata.

**Expanded:**
- Shows: `summary` first, then `notes` (if present).
- No modals or extra navigation layers.
- Works consistently on desktop and mobile.

**Implementation note:** Use Radix `Collapsible`. Expansion is explicit (click/keyboard); no hover-only affordances. Local UI state is sufficient initially (no persistence required).

### AI context configuration (default)

```ts
contextChapterCount = 2;
includeEditorNotes = false;
```

**Behavior:**
- When running an AI batch starting at segment *N*, include `summary` from the previous **2** chapters as chronological context.
- `notes` are never included unless `includeEditorNotes` is explicitly enabled.

**Non-goals (this iteration):**
- Automatic or AI-assisted summary generation
- Per-chapter context overrides
- Structured/typed notes
- Validation beyond basic guidance

---

## Part A: Manual Chapter Management

Manual chapters are structural markers that require an intentional action; the UI stays quiet until you explicitly request a change.

### Chapter creation: Start Chapter Here

1. **Open a segment’s context menu** (right click or ⋮ while in edit mode).
2. **Choose “Start Chapter Here.”** The app inserts a chapter marker right before the selected segment.
3. **“New Chapter” appears above the segment** with the placeholder title already selected.
4. **The header takes focus** so you can immediately type a title without touching a modal or extra menu.
5. ✅ The chapter exists instantly; you’re already inline editing it.

### Inline chapter editing (Edit Mode only)

- **Edit Mode gate:** Title, summary, notes, and tag changes are only enabled while `document.body.dataset.transcriptEditing === "true"`; this keeps navigation, playback, and selection stable while you type.
- **Title:** Click the title to edit it in place. Enter or blur commits (whitespace is trimmed) and Esc cancels. There is no separate edit button or popover.
- **Summary & notes:** Expand the collapsible header to view metadata. In edit mode, clicking either block turns it into a textarea that saves on blur; Esc cancels. Collapse the header to hide the extra text when you’re reading.
- **Selection:** Clicking the header still selects the chapter so you keep playback/scroll in sync.

### Chapter deletion

- A delete icon appears directly on the chapter header while you remain in edit mode.
- Clicking it removes only the chapter marker; segments remain where they are and Undo restores the boundary.
- There is no modal confirmation – deletion is a structural command, not text editing.

### Chapter tags

- Tags live on the header and are rendered as quiet chips (still visible when collapsed and expanded).
- In edit mode, a tiny `+` button sits next to the chips. It opens a local tag selector/popover that mirrors the section tag picker so the behavior stays familiar.
- While editing, each chip exposes a remove control; in reading mode the chips stay muted and don’t steal space.

### Floating Chapter Outline Panel

The **Chapter Outline Panel** beside the transcript editor continues to provide orientation without edit controls:

```
┌──────────────────────┐
│  Chapters  [✕]       │
├──────────────────────┤
│ • Chapter 1         │
│    Intro to ML       │
│                      │
│ • Chapter 2         │
│    Core Concepts     │
└──────────────────────┘
```

**Features:**
- Lists all chapters
- Click a chapter → scrolls to its start segment and highlights it
- Highlights the current chapter
- Minimal surface for orientation (no task completion UI)
- Non-modal: no backdrop, no blur, no focus trap
- Stays open until toggled or Esc

**Keyboard:**
- Toggle Chapter Outline Panel (Outline / TOC):
  - macOS: `Cmd+Shift+O`
  - Windows/Linux: `Ctrl+Shift+O`

---

## Part B: AI Chapter Detection

The AI analyzes large batches (50–200 segments) and proposes a complete chapter structure.

### Workflow

1. **Open the AI Command Panel** → **New tab: “Chapters”**  
   (UX must match other batch features; see `docs/features/architecture/ai-command-panel.md`)
2. **Configure (standard panel structure):**
   - **Scope** (standard): segment count + filters
   - **AI Configuration** (standard): provider/model + batch size
   - **Feature Settings:** prompt template, min/max chapter length, tags
3. Click **“Start Detection”**
4. ⏳ The AI processes the transcript sequentially in batches
5. **Review results:**
   - **Panel:** summary (confidence groups) + navigation  
   - **Transcript:** suggestions inline with accept/reject per chapter  
   - **Accept All** applies suggestions as one atomic undo step

---

## Creation actions and shortcuts

- **“Start Chapter Here”:** segment context menu entry (no shortcut).
  - Anchors the chapter edit popover on the chosen segment.
  - Optional future access via Command Palette (later).
  - Rationale: keeps the flow inline with editing the new chapter immediately.

### How it works (behind the scenes)

- **Batch processing:** The transcript is split into batches of 50–200 segments
- **Overlap logic:** At the end of each batch, the previous chapter content is included so the model can decide whether:
  - “This chapter continues until segment X”
  - or “A new chapter starts at segment Y”
- **Response:** JSON chapters: `[{title, summary?, tags?, segmentSimpleIds[]}]` + optional `startSimpleId/endSimpleId` for a range
- **Mapping:** The AI only sees synthetic SimpleIDs (1..n) per batch; mapping to real segment IDs happens client-side via shared ai/core utilities
- **Validation:** Chapter boundaries are validated; invalid responses are handled via recovery strategies

### Configuration

**In the AI Command Panel:**
- **Provider/model:** Same selection as other AI features
- **Prompt template:** Managed like text revision (Settings → AI Prompts; persisted)
  - Variables: `maxBatchSize`, `minChapterLength`, `maxChapterLength`, `tagsAvailable`
- **Tags:** The system shows available tags; the AI may suggest `tags` (kept visually low-prominence in the timeline)

---

## Part C: Export & Beyond

### Text export

- Chapters are inserted as **headings before segment groups**
- Format: `# Chapter 1: Title` (Markdown-style)
- Options: include/exclude `summary`, `notes`, and `tags` (defaults should keep output readable)

### JSON export

- **Option 1:** Chapters as **metadata on the first segment** of each chapter
- **Option 2:** **Separate top-level structure** `"chapters": [...]`
- User selects this in export settings (“Chapter metadata structure”)

### Future features

If later features like “chapter summaries” or “book generation” are added:
- Each chapter can be summarized individually
- The AI receives: chapter title, `summary`, `tags`, and segment texts; `notes` remain excluded by default

---

## Invariants & Notes

✅ **Summary and notes are semantically distinct**  
✅ **Meta information is hidden by default** (Collapsible header)  
✅ **Timeline clarity beats metadata visibility**  
✅ **AI context inclusion is minimal and explicit** (`contextChapterCount = 2`, `includeEditorNotes = false`)  
✅ **Manual-first:** Always possible to add/edit/delete chapters manually  
✅ **No overlap:** Chapter ranges must not overlap (validated)  
✅ **Undo/redo:** All chapter changes (manual + AI acceptance) are undoable  
✅ **Accept All is atomic:** Applying AI results is a single undoable action  
⚠️ **Manual vs. AI:** If manual chapters conflict with AI suggestions, the user decides during acceptance; no silent overwrites  
⚠️ **Coexistence:** Manual chapters and AI suggestions/acceptances can exist together in the same transcript  
⚠️ **No persistence for AI suggestions:** AI suggestions and batch progress are ephemeral (in-memory only); only accepted chapters are saved
