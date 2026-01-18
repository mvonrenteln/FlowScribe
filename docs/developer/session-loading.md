# Session Loading and Audio Changes

FlowScribe stores editor state per audio/transcript pair. The store uses
`buildSessionKey(audioRef, transcriptRef)` to isolate sessions and revisions.

## Audio-first loading behavior

When a new audio file is loaded via `setAudioReference(...)`, the transcript
state is reset immediately. This prevents mixing a previous transcript with a
new audio source.

What resets:
- `transcriptRef` is set to `null`
- `segments`, `speakers`, and `tags` are cleared
- `history` is cleared and `historyIndex` is set to `-1`

To associate a transcript with the new audio, load it explicitly using
`loadTranscript(...)` or `setTranscriptReference(...)` after the audio upload.
If the transcript is intentionally the same file, re-upload it to reattach it
to the new audio.

## Filter state on session changes

When the session key changes (loading a different file or switching revisions),
the transcript editor resets all active filters and search state so the next
session starts unfiltered.
