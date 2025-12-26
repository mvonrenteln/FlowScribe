# TranscriptEditor - Audio Transcription Editor

## Overview

A professional audio transcription editor webapp that loads audio files (MP3, WAV, M4A) and Whisper/WhisperX JSON transcripts. Features waveform visualization, keyboard-driven workflow, editable speaker-tagged text with word-level timestamps, segment operations, and export capabilities.

## Project Structure

- `client/src/components/`: Feature-focused React components. UI layout (shell, theming, navigation), media controls (waveform/transport/zoom), transcript editing surfaces (segment rows, speaker sidebar, keyboard shortcuts/help), and import/export dialogs live here.
- `client/src/lib/`: Shared client utilities and application state. The central Zustand store, transcript parsing/formatting helpers, and reusable hooks belong in this layer.
- `client/src/App.tsx`: Application entrypoint that wires providers, theming, layout, and route-level features.
- `docs/`: Project design notes and usage docs aimed at contributors and product stakeholders.
- Root config (`vite.config.ts`, `tailwind.config.ts`, `tsconfig.json`, `biome.json`, `postcss.config.js`, etc.): Build/lint/format pipeline and design-system configuration.

## Supported Transcript Formats

### Whisper Format (simple array)

```json
[
  { "timestamp": [0, 3.16], "text": " Text content here" },
  { "timestamp": [3.5, 7.2], "text": " More text content" }
]
```

- Segments are assigned to SPEAKER_00
- Word timestamps are auto-generated based on segment duration

### WhisperX Format (object with segments)

```json
{
  "segments": [
    {
      "speaker": "SPEAKER_00",
      "start": 0,
      "end": 3.16,
      "text": "Text content here",
      "words": [
        { "word": "Text", "start": 0, "end": 0.5 },
        { "word": "content", "start": 0.6, "end": 1.2 }
      ]
    }
  ]
}
```

- Supports multiple speakers with speaker diarization
- Word-level timestamps preserved when available
- Speaker regions shown on waveform when multiple speakers present

## Key Features

- Waveform visualization with wavesurfer.js
- Word-level highlighting during playback
- Inline text editing (double-click to edit)
- Speaker assignment via dropdown
- Segment split at word boundaries (Shift+click word, then split)
- Segment merge with adjacent segments
- Drag-resizable timing boundaries (WhisperX only)
- Undo/Redo support (Ctrl+Z / Ctrl+Shift+Z)
- Filter view by speaker
- Export to JSON, SRT subtitles, or plain text

Detailes in [Features].

## Keyboard Shortcuts

- Space: Play/Pause
- J/L: Skip back/forward 5 seconds
- Left/Right arrows: Seek 1 second
- Up/Down arrows: Navigate segments
- M: Merge with next segment
- Delete: Delete selected segment
- 1-9: Assign speaker by number
- Ctrl+E: Export
- ?: Show shortcuts

## Technologies

- React with TypeScript
- Zustand for state management
- wavesurfer.js for audio visualization
- react-hotkeys-hook for keyboard shortcuts
- Tailwind CSS with shadcn/ui components
- Frontend-only Vite app (no backend)
- Tests with Vitest

## Design

Design in [design_guidelines]

## General Behavior

- For every code change run `npm test`.
  - If `npm test` fails, run `npm install -D vitest @vitest/ui jsdom` before.
- Before making any change, verify full branch coverage for the planned change.
- If full branch coverage is missing and unit or component tests can cover it, add those tests first and make sure they pass.
- Then implement the change and update tests so full coverage remains after the change.
- finally run `npm check` and `npm lint`
  - use `npm lint:fix` to fix obvious findings when some reported, fix the rest manually
  - after manual fixing lint errors, re-run linting and the tests
- use categories like chore/feat/bug etc for commits and comment titles
- use act in tests as proposed by vitest:

```Javascript
act(() => {
  /* fire events that update state */
});
/* assert on the output */
```

## Warning

Changes around audio loading in `client/src/components/WaveformPlayer.tsx` have previously broken audio playback. Be extra cautious and validate loading and cleanup behavior whenever touching this area.
Zoom handling in `client/src/components/WaveformPlayer.tsx` can cause repeated WaveSurfer re-initialization and flicker if it triggers the main init effect. Avoid wiring zoom state into the initialization dependency chain.
