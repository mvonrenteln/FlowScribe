# Issue 0013 — Reconnect audio after backup restore without resetting transcript

## Summary

After restoring from a backup, the transcript loads correctly (from localStorage), but the
audio file is not loaded because the blob URL is never persisted. When the user tries to
reconnect the audio manually (drag-drop / file picker), `setAudioReference` detects a
changed `audioRef` and resets all transcript data — destroying the restored session.

## Root Cause

`sessionSlice.setAudioReference` always resets segments, speakers, tags, chapters, and
history whenever the audio reference changes (`shouldResetTranscript = audioChanged &&
reference !== null`). This invariant is correct for the "swap audio file" UX, but harmful
for the "reconnect audio to an existing session" case.

After a backup restore + page reload the store is in a specific state:

- `audioRef` — set (restored from localStorage, contains original file metadata)
- `audioFile` — `null` (not persisted, can't survive page reload)
- `audioUrl` — `null` (same)
- `segments` — populated (from restored session)

If the user then loads a file whose `FileReference` metadata does not exactly match the
stored `audioRef` (e.g. different `lastModified` because the file was copied or
re-downloaded), `isSameFileReference` returns `false` → `audioChanged = true` →
transcript cleared.

## Solution

Introduce a new store action `reconnectAudio(file: File)` that wires `audioFile` and
`audioUrl` to the current session **without touching transcript state**.

Auto-detect the reconnect scenario in `useTranscriptInitialization.handleAudioUpload`:

```
isReconnect = audioUrl === null && audioRef !== null
```

| State                        | Meaning                                    | Action          |
|------------------------------|--------------------------------------------|-----------------|
| `audioUrl=null, audioRef=null` | Fresh start — no session yet              | `setAudioReference` (normal) |
| `audioUrl=null, audioRef≠null` | Session exists but audio not loaded yet   | `reconnectAudio` |
| `audioUrl≠null`               | Audio already loaded — user swapping file | `setAudioReference` (normal) |

This condition also covers the normal post-reload IDB-handle restore path (existing
behaviour is preserved).

## Files Changed

| File | Change |
|------|--------|
| `client/src/lib/store/types.ts` | Add `reconnectAudio(file: File): void` to `SessionSlice` interface |
| `client/src/lib/store/slices/sessionSlice.ts` | Implement `reconnectAudio` |
| `client/src/components/transcript-editor/useTranscriptInitialization.ts` | Accept `reconnectAudio` param; detect reconnect case in `handleAudioUpload` |
| `client/src/components/transcript-editor/useTranscriptEditor.ts` | Pass `reconnectAudio` to hook |
| `client/src/components/transcript-editor/__tests__/useTranscriptInitialization.test.ts` | Update/add tests for reconnect behaviour |

## Acceptance Criteria

1. After backup restore + reload, drag-dropping the original audio file loads the waveform
   without clearing any transcript data.
2. After backup restore + reload, drag-dropping an audio file with different `lastModified`
   (e.g. copied from backup drive) also loads without clearing transcript data.
3. Loading a fresh audio file when no session exists still clears transcript (normal flow
   unchanged).
4. Swapping audio when audio is already loaded still clears transcript (normal flow
   unchanged).
5. IDB handle auto-restore on page reload continues to work correctly.
