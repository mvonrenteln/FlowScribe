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

## WebVTT (.vtt)

FlowScribe can import and export [WebVTT](https://www.w3.org/TR/webvtt1/) subtitle files.

### Import

```
WEBVTT

1
00:00:01.000 --> 00:00:03.500
<v Speaker One>Hello world</v>

2
00:00:04.000 --> 00:00:06.000
<v Speaker Two>Good morning</v>
```

**Supported:**
- `WEBVTT` header detection (with optional BOM stripping)
- Timestamps in both `HH:MM:SS.mmm` and `MM:SS.mmm` formats
- `<v Speaker Name>` voice tags for speaker extraction (with or without closing `</v>`)
- Multi-line cue text (lines are joined with a space)

**Skipped / ignored:**
- `NOTE` and `STYLE` blocks
- Cue settings and positioning on the timestamp line (e.g. `align:start position:50%`)

**Defaults:**
- Segments without a voice tag are assigned speaker `SPEAKER_00`
- Word-level timestamps are auto-generated via even distribution (VTT does not carry word timing)
- Segment IDs are assigned sequentially as `seg-0`, `seg-1`, …

### Export

FlowScribe produces valid WEBVTT output:

- Sequential numeric cue IDs (`1`, `2`, `3`, …)
- Timestamps in `HH:MM:SS.mmm` format (dot separator, hours always included)
- Speaker names wrapped in `<v Speaker>text</v>` voice tags
- Cues separated by blank lines

## Export Formats

- **JSON** — WhisperX‑style structure with your edits, timestamps, speaker labels, and tag names.
- **SRT** — Subtitle‑friendly output with timing.
- **TXT** — Plain text with speaker labels.
- **WebVTT** — Web Video Text Tracks with speaker voice tags.

### JSON Export Details

- `segments[].tags` contains tag names (not internal IDs).
- `tags` contains tag metadata (`name`, `color`) for restoring unused or custom tags.
- `chapters[].tags` (when present) also uses tag names for readability.
