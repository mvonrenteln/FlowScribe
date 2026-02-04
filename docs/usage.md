# Using FlowScribe

This guide walks you through the core workflow: load audio, refine the transcript, review uncertain content, and export clean output.

![Full editor overview](screenshots/overview-editor.png)

## 1) Load Audio and Transcript

- Click **Load Audio** and choose an MP3/WAV/M4A/FLAC file.
- Click **Load Transcript** and select a Whisper or WhisperX JSON file.
- If your browser supports file handles, you can **Reopen Audio** without re‑uploading.

![File upload buttons](screenshots/upload-buttons.png)

## 2) Navigate and Play

- Use the waveform or minimap to jump to any point.
- Press **Space** to play/pause from the current cursor position.
- Use **J/L** to skip backward/forward and **Left/Right** to nudge by 1 second.

![Waveform and minimap](screenshots/waveform-minimap.png)

## 3) Edit the Transcript

- Click a segment to select it.
- Double‑click the text to edit; press **Enter** to save or **Esc** to cancel.
- Use **Split** at the current word to create a new segment.
- Merge adjacent segments when passages belong together.
- Undo/redo keeps edits safe during long sessions.

![Inline editing](screenshots/inline-editing.png)

## 3.1) Adjust Chapter Boundaries

- Chapters behave like book sections: a chapter ends where the next one begins.
- Hover a chapter header to reveal the grip handle (six dots).
- Drag the handle to a target segment to move the chapter boundary.
- The previous chapter expands or contracts automatically.

## 4) Manage Speakers & Tags

### Speakers
- Rename speakers to match real names.
- Merge speakers if two labels represent the same person.
- Filter by speaker to focus on one voice at a time.

### Tags
- Add color-coded tags to segments for flexible organization.
- Use keyboard shortcuts (**T + 1–10**) to tag segments quickly.
- Filter by tag (single-click to include, double-click to exclude).
- Export filtered results or the full transcript with tags intact.

For details, see [Tags](features/tags-system.md).

![Speaker sidebar](screenshots/speaker-sidebar.png)

## 5) Review Low‑Confidence Content

- Toggle **Low confidence** to focus on uncertain words.
- Adjust the threshold to control how strict the filter is.
- Confirm a segment once you trust it.

![Low confidence filter](screenshots/low-confidence-filter.png)

## 6) Glossary Workflow (Create → Filter → Resolve)

### Create the glossary

Add your preferred terms, then list common mistakes and false positives.

- **Common mistakes** are exact‑match variants.
- **False positives** are ignored during matching.
- Import/export uses plain text: `term | variants | false positives`.

![Glossary dialog](screenshots/glossary-dialog.png)

### Focus with filters

Enable **Glossary** or **Uncertain Glossary Matches** in the sidebar to review only relevant segments.

![Glossary filters enabled](screenshots/glossary-filters.png)

### Resolve matches in context

Hover a highlighted word to open the tooltip.

- **Apply** replaces the word with the correct glossary term.
- **Ignore** adds the current word as a false positive so it no longer appears.

![Glossary tooltip apply/ignore](screenshots/glossary-tooltip-apply-ignore.png)

## 7) Bookmarks and Confirmations

- **Bookmark** a segment to revisit it later.
- **Confirm** a segment when you are confident it is correct.

![Segment header actions](screenshots/segment-actions-confirm-bookmark.png)

## 8) Export

Export your cleaned transcript as JSON, SRT, or plain text.

![Export dialog](screenshots/export-dialog.png)

## 9) Settings

Access the centralized Settings menu via the gear icon in the toolbar or press **Cmd/Ctrl + ,**. The Settings panel provides:

### AI Providers
- Configure multiple AI providers (Ollama, OpenAI, Custom)
- Test connections and manage API keys
- Select default models for each provider

### AI Templates
- Create and manage prompt templates for speaker classification
- Import/export templates for sharing
- Organize templates by category (Speaker, Grammar, Summary, Custom)

### AI Transcript Revision
Use AI to intelligently revise and improve your transcript segments:
- **Single segment**: Click the ✨ AI button on any segment for quick revisions
- **Batch processing**: Filter segments and revise them all at once
- **Custom templates**: Create templates for your specific workflows (RPG sessions, interviews, etc.)
- **Side-by-side diff**: Review changes before accepting them

Press **Alt+R** to instantly apply your default revision template to the selected segment.

### Spellcheck
- Enable/disable spellchecking
- Configure languages (German, English)
- Manage ignored words and custom dictionaries
- Import .oxt/.aff/.dic dictionary files

### Glossary
- Manage glossary terms with variants and false positives
- Adjust fuzzy matching threshold
- Configure highlighting styles (underline, background)

### Confidence
- Enable/disable confidence highlighting
- Adjust threshold manually or use auto-detection
- Auto mode calculates threshold from transcript distribution

### Appearance
- Switch between Light, Dark, or System theme

**📖 For detailed information, see:**
- [Complete Settings Guide](features/settings.md)
- [AI Speaker Classification Guide](features/ai-speaker-classification.md)
- [AI Transcript Revision Guide](features/ai-transcript-revision-guide.md)


## Search & Replace (Regex)

FlowScribe supports both simple literal search/replace and regular-expression-based replacements. Toggle the regex option in the search panel to use regex mode.

Replacement templates support the following tokens (compatible with JavaScript-style replacements):

- `$$` — Inserts a literal `$`.
- `$&` — Inserts the entire matched substring.
- ``$` `` — Inserts the text before the match (left context).
- `$'` — Inserts the text after the match (right context).
- `$1`, `$2`, ... — Inserts the corresponding numbered capture group.
- `$<name>` — Inserts a named capture group by name (if present in the regex).

Examples:

- Regex search: `(\w+)-(\w+)`, replacement: `$2-$1` → swaps the two dash-separated parts. Example: `hello-world` → `world-hello`.
- Regex search: `Order-(\d{4})-([A-Z]+)`, replacement: `$2-$1` → captures parts of an order code and reorders them. Example: `Order-2025-ABC` → `ABC-2025`.
- Literal search: `flower` (regex off), replacement: `flower.` → adds a trailing period to exact matches of `flower`.

Notes:

- When using regex mode, FlowScribe matches across segment text and resolves capture groups against the full segment text so `$1`/named groups reflect the full regex result, even if the visible word is only part of that match.
- If a numeric capture like `$10` is used and there are only 1–9 captures, the replacement logic falls back to treating `$10` as `$1` followed by the literal `0` when appropriate.

For implementation details, see the `applyReplacementTemplate` logic in `client/src/components/transcript-editor/useSearchAndReplace.ts`.
