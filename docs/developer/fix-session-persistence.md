# Fix: Session Loss on Browser Reload

## Overview

This document describes the bugs found in the session persistence layer and
the fixes applied. It serves as a reference for future debugging and as the
specification for the associated tests in
`client/src/lib/__tests__/store.persistence.test.ts`.

---

## Bugs Fixed

### Bug 1 (PRIMARY): Empty intermediate session captures activeSessionKey

**Root cause:** `store.ts` subscription — `setActiveSessionKey(sessionKey)` was
called unconditionally, even for empty intermediate sessions (0 segments, no
transcriptRef).

**Fix:** Guard with `if (state.segments.length > 0 || state.transcriptRef)`.

### Bug 2: Ghost sessions in localStorage

**Root cause:** Every `setAudioReference()` creates an `"audio:X|transcript:none"`
entry with `segments=[]`. These are persisted but filtered out by
`buildRecentSessions()`, so they are invisible in the UI and waste quota.

**Fix:** Clean up ghost sessions (segments=0, no transcriptRef, not active) before
persisting.

### Bug 3: QuotaExceededError silently swallowed

**Root cause:** All three write paths (`writeSessionsSync`, worker handler, sync
fallback) catch and discard errors.

**Fix:** Detect `QuotaExceededError`, dispatch a custom event
`"flowscribe:storage-quota-exceeded"`, and show an AlertDialog with export
option. Subsequent errors show a destructive toast.

### Bug 4: Audio-restore creates new audioRef object

**Root cause:** `sessionSlice.ts` `activateSession` used `buildFileReference(file)`
to create a new object instead of reusing `session.audioRef`, triggering an
unnecessary subscription fire.

**Fix:** Use `session.audioRef` directly.

### Bug 5: `aiSegmentMergeConfig` missing in persistenceSelector

**Fix:** Added to `PersistenceSelection`, `selectPersistenceState`, and
`arePersistenceSelectionsEqual`.

---

## Files Modified

| File | Change |
|------|--------|
| `client/src/lib/store.ts` | Conditional activeSessionKey; ghost cleanup |
| `client/src/lib/storage.ts` | QuotaExceeded detection in all write paths |
| `client/src/lib/store/slices/sessionSlice.ts` | Use `session.audioRef` |
| `client/src/lib/store/types.ts` | Add `quotaErrorShown` state |
| `client/src/lib/store/utils/persistenceSelector.ts` | Add `aiSegmentMergeConfig` |
| `client/src/components/StorageQuotaDialog.tsx` | New AlertDialog + toast |
| `client/src/components/transcript-editor/EditorDialogs.tsx` | Mount StorageQuotaDialog |
| `client/src/lib/__tests__/store.persistence.test.ts` | 17 new tests |
