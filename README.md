# FlowScribe

FlowScribe is a fast, focused transcription workspace that helps you turn raw audio into clean, speaker‑labeled text with confidence. Load an audio file, sync it to a Whisper/WhisperX transcript, and refine the result without breaking your editing flow.

Built for people who live inside transcripts: researchers, journalists, podcasters, and teams who need accuracy, speed, and clarity.

![Editor overview](docs/screenshots/overview-editor.png)

## Why FlowScribe

- **Stay in flow:** keyboard‑first editing, word‑level timing, and instant playback control.
- **Make it accurate:** split/merge segments, correct words, and confirm low‑confidence areas fast.
- **See who said what:** speakers are visualized on the waveform and clearly labeled in text.
- **Ship formats you need:** export clean JSON, SRT, or plain text.

## Highlights

- Waveform + minimap with speaker regions
- Word‑level highlighting during playback
- Inline editing with undo/redo
- Speaker management (rename, merge, assign)
- **AI-powered speaker classification** (Ollama, OpenAI, Custom providers)
- **🆕 AI Transcript Revision** — Fix grammar, improve clarity, or apply custom templates with one click. Process single segments or batch-revise filtered content with side-by-side diff preview.
- Split/merge segments with precision
- Low‑confidence and glossary‑match review filters
- **Centralized Settings menu** with comprehensive configuration
- **Multi-provider AI support** for flexible model selection
- Privacy first local workflow - the app stores everything locally in your browser
- Saves your changes automatically in your local browser - you can resume at any time (even when leaving the page or shutting down the app itself)
- Bookmarks and confirmations for review workflows
- Export to JSON / SRT / TXT

![Speaker regions and word highlights](docs/screenshots/speaker-regions-word-highlights.png)
![Glossary and low-confidence filters](docs/screenshots/glossary-low-confidence-filters.png)

## How It Works

1. Load audio (MP3/WAV/M4A/FLAC) and a Whisper/WhisperX transcript.
2. Play, navigate, and correct the text while the waveform keeps you anchored.
3. Review low‑confidence spots or glossary matches.
4. Export the cleaned transcript.

## Supported Transcript Formats

FlowScribe supports both Whisper and WhisperX JSON formats. See `docs/formats.md` for schemas and examples.

## Getting Started

```bash
npm install
npm run dev
```

The app runs locally as a frontend‑only Vite project.

## Usage Tips

- Use space to play/pause and arrow keys to navigate segments.
- Double‑click to edit text; press Enter to save, Esc to cancel.
- Use filters to focus on low‑confidence or glossary‑related segments.

## Documentation

- `Features.md` — product overview and feature highlights
- `docs/usage.md` — step‑by‑step workflows
- `docs/shortcuts.md` — complete keyboard shortcut list
- `docs/formats.md` — transcript input/output formats
- `docs/design.md` — UI/UX principles and visual language
- `docs/features/settings.md` — comprehensive settings guide
- `docs/features/ai-speaker-classification.md` — AI speaker classification guide
- `docs/features/ai-transcript-revision-guide.md` — AI transcript revision guide
- `docs/settings-menu-plan.md` — technical architecture and implementation plan
- `LICENSE` — project license

## Contributing

PRs and feedback are welcome. If you’re adding a new feature, please update `Features.md` and include screenshots where relevant.

![Export or review workflow](docs/screenshots/export-or-review-workflow.png)

## Testing

```bash
npm install
npm run test -- --watch=false
```
