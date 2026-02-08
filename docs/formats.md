# Transcript Formats

FlowScribe supports both Whisper and WhisperX JSON inputs and exports cleaned transcripts in JSON, SRT, or plain text.

## Whisper Format (Simple Array)

```json
[
  { "timestamp": [0, 3.16], "text": " Text content here" },
  { "timestamp": [3.5, 7.2], "text": " More text content" }
]
```

- Segments are assigned to `SPEAKER_00`.
- Word timestamps are auto‑generated based on segment duration.

## WhisperX Format (Segments Object)

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

- Supports multiple speakers.
- Word‑level timestamps are preserved.
- Speaker regions appear on the waveform when available.

## Export Formats

- **JSON** — WhisperX‑style structure with your edits, timestamps, speaker labels, and tag names.
- **SRT** — Subtitle‑friendly output with timing.
- **TXT** — Plain text with speaker labels.

### JSON Export Details

- `segments[].tags` contains tag names (not internal IDs).
- `tags` contains tag metadata (`name`, `color`) for restoring unused or custom tags.
- `chapters[].tags` (when present) also uses tag names for readability.
