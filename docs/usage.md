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

## 4) Manage Speakers

- Rename speakers to match real names.
- Merge speakers if two labels represent the same person.
- Filter by speaker to focus on one voice at a time.

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

Access the centralized Settings menu via the gear icon in the toolbar. The Settings panel provides:

### AI Providers
- Configure multiple AI providers (Ollama, OpenAI, Custom)
- Test connections and manage API keys
- Select default models for each provider

### AI Templates
- Create and manage prompt templates for speaker classification
- Import/export templates for sharing
- Organize templates by category (Speaker, Grammar, Summary, Custom)

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

