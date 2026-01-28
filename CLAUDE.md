# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

FlowScribe is a frontend-only audio transcription editor. Users load audio (MP3/WAV/M4A/FLAC) with Whisper/WhisperX JSON transcripts, edit speaker-tagged segments with word-level timestamps, and export clean transcripts. **Manual-First philosophy**: every feature works without AI; AI is optional enhancement.

## Commands

```bash
npm run dev          # Vite dev server (port 5173)
npm run build        # Production build → dist/public
npm run check        # TypeScript check (tsgo)
npm run lint         # Biome linting
npm run lint:fix     # Auto-fix lint issues
npm test             # Vitest (single run)
```

### Verification Loop (MANDATORY for all changes)

```bash
npm run check && npm run lint:fix && npm test
```

Empty/filtered test output is not a pass—ensure explicit pass/fail counts.

## Tech Stack

- **React 18 + TypeScript + Vite** (frontend-only)
- **Zustand** (state management)
- **Tailwind CSS + shadcn/ui** (Radix primitives)
- **WaveSurfer.js** (audio waveform/playback)
- **Biome** (linter/formatter, replaces ESLint+Prettier)
- **Vitest + Testing Library** (tests, jsdom environment)
- **OpenAI SDK** (optional AI features)

## Architecture

```text
client/src/
├── components/       # React components (WaveformPlayer is fragile—see below)
├── lib/
│   ├── ai/          # AI infra: core/ → providers/ → parsing/ → features/
│   ├── store/       # Zustand store + slices (time/selection/segments)
│   └── [utilities]  # Pure functions (spellcheck, search, transcript parsing)
├── hooks/           # Custom hooks (selection, scroll, navigation)
└── pages/           # Route components
```

### Key Patterns

- **types → pure utils → services**: Keep seams clean; side effects in services only
- **Narrow selectors**: Avoid grabbing large state objects from Zustand
- **Lookup maps over scans**: Use `Map` for O(1) lookups on hot paths; memoize with `useMemo`
- **Domain types**: Use `SegmentId`, `SpeakerId`, `TimeMs` instead of raw primitives

## Critical Invariants

### Player ↔ Transcript Sync (breaks often)

- All navigation/seeking MUST go through `seekToTime(...)`
- `seekToTime` MUST update both `setCurrentTime` (store) AND `requestSeek` (player)
- Never add `isPlaying` guards to selection-sync effects
- Reference: `docs/features/architecture/player-transcript-sync.md`

### Keyboard Navigation

- Arrow handlers MUST call `preventDefault()` (except in forms)
- Double-click must clear pending single-click timeout

### WaveformPlayer (historically fragile)

- Avoid wiring zoom state into initialization dependencies
- Always cleanup WaveSurfer resources on unmount
- After changes: manually test load/play/pause/seek/zoom/reload

## Test Coverage Policy

- Target: >80% branch coverage overall
- Pure functions/utilities: aim for 90%+
- New functionality MUST include tests that would fail without the change
- Never delete/weaken tests to pass CI unless proven wrong and replaced

## Documentation

- All docs/comments in English
- When adding features: update developer docs (`docs/developer/`)
- Include JSDoc for exported functions and significant internals

## Scope Routing

| Area | Read |
| ------ | ------ |
| **Agent rules (read first)** | `AGENTS.md` |
| Player/selection/seek | `docs/features/architecture/player-transcript-sync.md` |
| AI features | `docs/features/architecture/ai-features-unified.md` |
| Coding patterns | `docs/agent-rules/coding-conventions.md` |
| Architecture principles | `docs/agent-rules/architecture-rules.md` |
