# Components DOX

## Purpose

- Own React UI components, editor surfaces, dialogs, controls, and component-level tests.

## Ownership

- `ui/` contains shadcn/Radix primitives and local UI building blocks.
- `transcript-editor/` and `transcript-segment/` contain transcript editing surfaces.
- Feature folders such as `backup/`, `settings/`, `merge/`, `rewrite/`, and `AICommandPanel/` own their local component composition.
- `WaveformPlayer.tsx` owns waveform rendering and playback integration.

## Local Contracts

- All rendered labels, placeholders, tooltips, aria labels, dialog text, and toasts must use i18n.
- Preserve accessibility basics: semantic controls, keyboard access, focus handling, and useful aria labels.
- Waveform initialization must not be tied to zoom state, and WaveSurfer/audio resources must be cleaned up on unmount.

## Work Guidance

- Follow existing visual language and shadcn patterns unless the task explicitly asks for redesign.
- Keep handler identity stable for performance-sensitive transcript rows.
- Avoid broad component rewrites when a localized fix is enough.

## Verification

- Run the root verification loop for component edits.
- For waveform, seeking, selection, or transcript navigation changes, manually sanity-check playback, seek, segment click, and arrow navigation when feasible.

## Child DOX Index

- No child DOX files yet.
