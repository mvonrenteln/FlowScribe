# FlowScribe / TranscriptEditor Agent Rules (Bootloader)

This repo is a frontend-only Vite/React/TypeScript app: an audio transcription editor that loads audio plus Whisper or WhisperX JSON, renders a waveform, and lets users edit speaker-tagged transcript segments with word-level timestamps.

## Technologies

- React with TypeScript and Vite
- Zustand for state management
- Tailwind CSS with shadcn/ui components
- Build: npm, Vitest, biome
- **i18n: react-i18next — all user-facing strings must use `t()`, keys in `client/src/translations/en.json` (default) and `de.json` (see Non-negotiable #5)**

## Repo map (only the important slices)

- `client/src/components/` UI/React components (WaveformPlayer lives here; fragile init)
- `client/src/lib/store/` Zustand store + selectors (time/selection state)
- `client/src/lib/ai/` AI infra (core/providers/parsing/features) — do not bypass
- `client/src/lib` Other not UI-specific utilities
- `client/src/hooks/` editor hooks (selection/scroll/navigation)
- `docs/features/architecture/player-transcript-sync.md` = source of truth for sync invariants

## Non-negotiables (read first)

### 1) Always run the full verification loop

For any code change (even “small” refactors), you MUST run:

1. `npm run check`
2. `npm run lint:fix` (if lint changes files or you fix lint issues, check and test again)
3. `npm test`

Notes:

- If `npm test` fails due to missing deps, install once:  
  `npm install -D vitest @vitest/ui jsdom`
- Empty/filtered output is not a pass. Ensure you see explicit “passed/failed” counts.

### 2) Save-to-disk before running terminal commands

When using agents/tools, make sure file edits are saved to disk before `check/lint/test`. Terminals only see saved files.

### 3) New functionality must be covered by tests (coverage policy)

- Any new behavior or bug fix MUST be accompanied by tests that would fail without the change.
- Target: >80% overall branch coverage. For pure functions/utilities aim for 90%+ branch coverage.
- Lower coverage is acceptable for coordination code (services/orchestration) and UI when testing is disproportionately complex, but the change must still have meaningful tests (at least for critical paths).
- Prefer extracting pure logic into utilities to make high-coverage tests easy.
- Do not delete or weaken existing tests to “make CI green” unless the test is proven wrong and replaced with a better one.
- If coverage drops, add tests or refactor to isolate testable pure logic; do not accept a net drop for new features.

### 4) Documentation language and maintenance

- All repository documentation, developer-facing docs, code comments, and in-line documentation MUST be written in English.
- When you add new functionality or change behavior, update or add developer documentation explaining the intent and usage. Keep documentation close to the code (e.g., `docs/developer/`), and reference architecture docs when appropriate.
- Public API surface, exported functions, modules and significant internal functions should include concise JSDoc-style comments describing purpose, inputs, outputs, and side effects.
- Developer docs should include brief how-to steps for enabling debug modes, configuration options, and example usage when applicable.

### 5) All user-facing strings MUST use i18n — NO hardcoded text

Every string visible to the user (labels, tooltips, toasts, aria-labels, placeholders, error messages, button text) **must** go through the `react-i18next` translation system. Hardcoded string literals in JSX or component logic are a bug.

- Use `const { t } = useTranslation();` in every component that renders user-facing text.
- Add the key to **`client/src/translations/en.json`** first (English is the default/fallback).
- Add the German translation to **`client/src/translations/de.json`** as well.
- Group keys by feature namespace (e.g. `backup.indicator.tooltipSaving`).
- Include `t` in dependency arrays of `useEffect`/`useCallback` when used inside them.
- This applies equally to `toast()` calls, `aria-label` props, and dynamic strings like error messages.

**Why this is a non-negotiable:** i18n violations are invisible to TypeScript and linting — they can only be caught by code review. Every agent task that touches UI must check this explicitly before marking work as done.

### 6) Additional coding constraints

- Do not use `any`, including in tests.
- After finishing a task, respond with a commit message suggestion (semantic commit with a title and a longer body).
- Do not write comments explaining why code was deleted, and do not comment out code. Always delete it directly.


## Critical invariants (highest blast radius)

### A) Player ↔ Transcript synchronization MUST stay stable

This breaks often and is considered critical functionality.

- Navigation/seeking MUST go through `seekToTime(...)`.
- `seekToTime` MUST update BOTH:
  - the store’s `currentTime` synchronously (`setCurrentTime`), AND
  - the player seek request (`requestSeek`)
- Do NOT add `isPlaying` guards to the selection-sync effect. It must react to all time changes (playback AND navigation).
- After any change that touches selection, seeking, active segment calculation, or scroll-follow behavior:
  - add/adjust tests if possible
  - manually sanity-check: click segment → selection updates immediately, playback follows; arrow navigation works reliably

If you touch any of these areas, also read:
- `docs/features/architecture/player-transcript-sync.md`

### B) Keyboard navigation correctness

- Arrow key navigation MUST call `preventDefault()` (except in form elements) or the browser scroll will win and navigation becomes unreliable.
- Double-click vs single-click behavior: double-click must clear any pending single-click timeout before other processing to avoid unintended selection/scroll.

### C) WaveformPlayer initialization is sensitive

`client/src/components/WaveformPlayer.tsx` is historically fragile:

- Avoid wiring zoom state into the main initialization effect dependency chain.
- Always cleanup WaveSurfer/audio resources on unmount.
- After changes here, manually verify: load audio, play/pause, seek, zoom, reload transcript/audio; no flicker/re-init loops.

### D) Performance/memoization footguns

Transcript rendering is performance-sensitive on long files.

- Avoid passing unstable anonymous functions as props to heavily memoized transcript rows.
- Keep handler identity stable where expected, but never at the cost of stale adjacency or merge logic.

## Scope routing (what to read when you change certain areas)

- Player/selection/scroll/seek logic → `docs/features/architecture/player-transcript-sync.md`
- AI features (`client/src/lib/ai/**`) → `docs/features/architecture/ai-features-unified.md`
- Coding conventions (imports, naming, React patterns, etc.) → `docs/agent-rules/coding-conventions.md`
- Design in `docs/design.md`
- All developer documentation is referenced in `docs/features/architecture/README.md`.

## Architecture guardrails (short)

- Avoid broad refactors. Prefer minimal, test-backed changes.
- Do not bypass AI infrastructure layers (`core/`, `providers/`, `parsing/`).
- Keep seams clean: types → pure utils → services/orchestration.
- Pure logic goes to utilities; side effects stay in services.
- For deeper architectural principles/patterns: `docs/agent-rules/architecture-rules.md`

A change is not considered done unless check, lint, and tests are green!
