# Store DOX

## Purpose

- Own Zustand store slices, typed editor state contracts, persistence guards, and player/transcript synchronization state.

## Ownership

- `slices/` owns state mutation domains.
- `utils/` owns store-specific helpers.
- `constants.ts`, `types.ts`, `context.ts`, and `persistenceGuard.ts` own shared store contracts.
- Store tests live in `__tests__/`.

## Local Contracts

- Seeking must go through `seekToTime(...)` and update both `currentTime` and the player seek request.
- Do not add `isPlaying` guards to selection synchronization.
- Preserve immediate selection updates for segment clicks and keyboard navigation.

## Work Guidance

- Read `docs/features/architecture/player-transcript-sync.md` before changing time, selection, seek, active segment, or scroll-follow behavior.
- Prefer narrow selectors and stable state shapes.
- Keep persistence migrations explicit and tested when persisted data changes.

## Verification

- Run the root verification loop for store edits.
- Add or update tests for selection, time, seeking, persistence, or migration changes.
- Manually sanity-check player/transcript sync when sync-critical behavior changes.

## Child DOX Index

- No child DOX files yet.
