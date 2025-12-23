# FlowScribe Features

This document outlines the core capabilities of FlowScribe and how they support an end‑to‑end transcription workflow. It is intentionally product‑focused and user‑friendly, with deeper technical details referenced where relevant.

![Full editor overview](docs/screenshots/overview-editor.png)

## Quick Overview

- Load audio + Whisper/WhisperX transcripts
- Synchronized waveform, minimap, and transcript text
- Word‑level editing and timing
- Speaker‑aware visualization and management
- Review tools (confidence, glossary, bookmarks)
- Export to JSON, SRT, and TXT

---

## Start Here

FlowScribe helps you load one audio file and its matching Whisper/WhisperX transcript, then edit and review everything in one place. You see the waveform and transcript side‑by‑side, with speaker segments highlighted so you always know who said what.

![File upload and transcript alignment](docs/screenshots/upload-waveform-transcript-alignment.png)

## Editing & Playback

FlowScribe is designed for continuous editing while listening. Playback, navigation, and text changes stay in sync.

- **Word‑level highlighting** during playback
- **Inline editing** (double‑click to edit; Enter to save, Esc to cancel)
- **Split/merge segments** at word boundaries
- **Keyboard‑first workflow** with global play/pause, seek, and navigation
- **Playback rate control** for faster review

![Inline editing with word highlight](docs/screenshots/inline-editing-word-highlight.png)

---

## Speaker & Segmentation Tools

Speaker structure remains clear as you edit and reorganize content.

- **Speaker regions** shown on the waveform
- **Rename / merge speakers** while preserving assignments
- **Speaker‑specific filters** for focused review
- **Segment boundary editing** (WhisperX only)
- **Per‑segment speaker assignment** with fast dropdown selection

![Speaker regions on waveform](docs/screenshots/speaker-regions-waveform.png)

---

## Review & Quality Assurance

Built‑in review tools help find risky or uncertain content quickly.

- **Low‑confidence filtering** with adjustable threshold
- **Glossary matching** for domain‑specific terms
- **Uncertain glossary matches** as a dedicated review filter
- **Bookmarks** for manual review later
- **Confirmations** to mark verified segments
- **Clear‑all filters** to return to the full transcript

![Review sidebar with filters](docs/screenshots/review-sidebar-filters.png)

---

## Glossary Workflow
The glossary workflow keeps terminology consistent end‑to‑end: define terms, focus the review, then resolve matches in context.

### Define Your Terms
Glossary terms help identify mistakes and keep terminology consistent.

- **Glossary terms** with common mistakes
- **Common false positives** per term (ignored during matching)
- **Exact‑match variants** (no fuzzy matching on variants)
- **Import / export** as plain text (`term | variants | false positives`)

![Glossary dialog](docs/screenshots/glossary-dialog.png)

For the step‑by‑step workflow (filters, apply/ignore), see `docs/usage.md`.

---

## Persistence & Session Recovery

FlowScribe stores lightweight session data to reduce rework.

- **Local storage persistence** for transcript state and all settings
- **Audio handle restore** (when available in browser) to reopen audio without re‑upload

![Session restore](docs/screenshots/session-restore.png)

## Segment Flow (Waveform + Text)

Move quickly between waveform and transcript. Select a block by clicking either the text or the region, then refine it with precise controls.

- **Select segments** directly from text or waveform
- **Split at word boundaries** for clean edits
- **Merge adjacent segments** when passages belong together
- **Adjust timing boundaries** by dragging region edges (WhisperX)
- **Delete segments** you no longer need
- **Undo / redo** for safe editing

![Split and merge controls](docs/screenshots/split-merge-controls.png)

---

## Keyboard Shortcuts (High‑Impact)

FlowScribe supports a keyboard‑first workflow. Common actions remain global and consistent.

- Play/pause, seek, and navigation
- Split at current word
- Merge with next / previous
- Toggle filters and review actions
- Confirm and bookmark segments

![Keyboard shortcuts modal](docs/screenshots/keyboard-shortcuts-modal.png)

Full list: `docs/shortcuts.md`.

## Workflow & Usability

FlowScribe is built to feel smooth and predictable, even in long sessions.

- **Simple, intuitive UI** that stays out of your way
- **Seamless switching** between waveform and transcript without mode changes
- **Keyboard‑first control** for all core actions
- **Speaker names are session‑local** so each project stays clean

---

## Export Formats

FlowScribe supports multiple export formats for downstream workflows.

- **JSON** (the original WhisperX Format with your changes, structured with timing and speaker data)
- **SRT** (subtitle friendly)
- **Plain text** (human‑readable)

![Export dialog](docs/screenshots/export-dialog.png)

---

## Review Controls (In‑Line)

Each transcript segment offers quick actions for review without leaving the text:

- **Confirm** to mark a segment as verified
- **Bookmark** to flag it for later follow‑up

![Segment header actions](docs/screenshots/segment-actions-confirm-bookmark.png)
