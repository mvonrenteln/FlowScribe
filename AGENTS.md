# FlowScribe / TranscriptEditor Agent Rules (Bootloader)

This repo is a frontend-only Vite/React/TypeScript app: an audio transcription editor that loads audio plus Whisper or WhisperX JSON, renders a waveform, and lets users edit speaker-tagged transcript segments with word-level timestamps. Manual-first philosophy: every feature must work without AI; AI is only an optional enhancement.

## Runtime environment

- Node: `>=24 <25` (version pinned in `.nvmrc`)
- npm: `>=11 <12`
- `nvm` is not auto-initialized in Claude's shell. Initialize it before every `npm`/`node` Bash call:

  ```bash
  source ~/.nvm/nvm.sh && nvm use
  ```

  Example: `source ~/.nvm/nvm.sh && nvm use && npm run check`

## Commands

```bash
npm run dev          # Vite dev server (port 5173)
npm run build        # Production build
npm run check        # TypeScript check (tsgo)
npm run lint         # Biome check
npm run lint:fix     # Biome check with auto-fixes
npm test             # Vitest single run
```

## Technologies

- React 18 with TypeScript and Vite
- Zustand for state management
- Tailwind CSS with shadcn/ui components and Radix primitives
- WaveSurfer.js for audio waveform/playback
- OpenAI SDK for optional AI features
- Build: npm, Vitest, Testing Library, jsdom, biome
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

- TypeScript strict mode is required; do not loosen strict compiler settings.
- Do not use `any`, including in tests.
- Follow TDD for new behavior and bug fixes: add or update the failing test first, then implement the smallest fix.
- Use Conventional Commits: `type(scope): description`, where scope names the component, feature, or subsystem.
- Do not add AI attribution or generated-by footers to commits, such as `Co-authored-by: Claude` or `Generated with Claude Code`.
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
- Prefer narrow Zustand selectors over grabbing large state objects.
- Prefer lookup maps over repeated scans on measured hot paths.
- Use domain types such as `SegmentId`, `SpeakerId`, and `TimeMs` where they already exist.
- For deeper architectural principles/patterns: `docs/agent-rules/architecture-rules.md`

A change is not considered done unless check, lint, and tests are green!

# DOX framework

- DOX is highly performant AGENTS.md hierarchy installed here
- Agent must follow DOX instructions across any edits

## Core Contract

- AGENTS.md files are binding work contracts for their subtrees
- Work products, source materials, instructions, records, assets, and durable docs must stay understandable from the nearest applicable AGENTS.md plus every parent AGENTS.md above it

## Read Before Editing

1. Read the root AGENTS.md
2. Identify every file or folder you expect to touch
3. Walk from the repository root to each target path
4. Read every AGENTS.md found along each route
5. If a parent AGENTS.md lists a child AGENTS.md whose scope contains the path, read that child and continue from there
6. Use the nearest AGENTS.md as the local contract and parent docs for repo-wide rules
7. If docs conflict, the closer doc controls local work details, but no child doc may weaken DOX

Do not rely on memory. Re-read the applicable DOX chain in the current session before editing.

## Update After Editing

Every meaningful change requires a DOX pass before the task is done.

Update the closest owning AGENTS.md when a change affects:

- purpose, scope, ownership, or responsibilities
- durable structure, contracts, workflows, or operating rules
- required inputs, outputs, permissions, constraints, side effects, or artifacts
- user preferences about behavior, communication, process, organization, or quality
- AGENTS.md creation, deletion, move, rename, or index contents

Update parent docs when parent-level structure, ownership, workflow, or child index changes. Update child docs when parent changes alter local rules. Remove stale or contradictory text immediately. Small edits that do not change behavior or contracts may leave docs unchanged, but the DOX pass still must happen.

## Hierarchy

- Root AGENTS.md is the DOX rail: project-wide instructions, global preferences, durable workflow rules, and the top-level Child DOX Index
- Child AGENTS.md files own domain-specific instructions and their own Child DOX Index
- Each parent explains what its direct children cover and what stays owned by the parent
- The closer a doc is to the work, the more specific and practical it must be

## Child Doc Shape

- Create a child AGENTS.md when a folder becomes a durable boundary with its own purpose, rules, responsibilities, workflow, materials, or quality standards
- Work Guidance must reflect the current standards of the project or user instructions; if there are no specific standards or instructions yet, leave it empty
- Verification must reflect an existing check; if no verification framework exists yet, leave it empty and update it when one exists

Default section order:
- Purpose
- Ownership
- Local Contracts
- Work Guidance
- Verification
- Child DOX Index

## Style

- Keep docs concise, current, and operational
- Document stable contracts, not diary entries
- Put broad rules in parent docs and concrete details in child docs
- Prefer direct bullets with explicit names
- Do not duplicate rules across many files unless each scope needs a local version
- Delete stale notes instead of explaining history
- Trim obvious statements, repeated rules, misplaced detail, and warnings for risks that no longer exist

## Closeout

1. Re-check changed paths against the DOX chain
2. Update nearest owning docs and any affected parents or children
3. Refresh every affected Child DOX Index
4. Remove stale or contradictory text
5. Run existing verification when relevant
6. Report any docs intentionally left unchanged and why

## User Preferences

When the user requests a durable behavior change, record it here or in the relevant child AGENTS.md

## Child DOX Index

- `.github/AGENTS.md` owns GitHub automation and workflow configuration.
- `client/AGENTS.md` owns the Vite client package, browser assets, and client source tree.
- `demo-data/AGENTS.md` owns sample transcripts, audio-adjacent fixtures, and fixture generation scripts.
- `docs/AGENTS.md` owns repository documentation, architecture notes, issue notes, and developer guides.

Generated artifacts and dependencies are intentionally not indexed: `dist/`, `client/node_modules/`, `client/coverage/`, `.tsbuildinfo`, and OS/editor cache files.
