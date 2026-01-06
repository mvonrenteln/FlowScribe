# TranscriptEditor - Audio Transcription Editor

## Overview

A professional audio transcription editor webapp that loads audio files (MP3, WAV, M4A) and Whisper/WhisperX JSON transcripts. Features waveform visualization, keyboard-driven workflow, editable speaker-tagged text with word-level timestamps, segment operations, and export capabilities.

## Project Structure

### Frontend Application

- `client/src/components/`: Feature-focused React components. UI layout (shell, theming, navigation), media controls (waveform/transport/zoom), transcript editing surfaces (segment rows, speaker sidebar, keyboard shortcuts/help), and import/export dialogs live here.
- `client/src/lib/`: Shared client utilities and application state. The central Zustand store, transcript parsing/formatting helpers, and reusable hooks belong in this layer.
  - `ai/`: Unified AI features infrastructure (see below)
  - `store/`: Application state management (Zustand)
  - Other utilities: audio handling, file reference, spellcheck, search, etc.
- `client/src/App.tsx`: Application entrypoint that wires providers, theming, layout, and route-level features.

### AI Features Infrastructure (`client/src/lib/ai/`)

- `core/`: Core AI infrastructure (types, service, feature registry, provider resolver, errors)
- `providers/`: AI provider implementations (OpenAI, Ollama, factory)
- `parsing/`: Response parsing utilities
  - `recoveryStrategies.ts`: Strategy Pattern for flexible response recovery (NEW)
  - `responseParser.ts`, `jsonParser.ts`, `textParser.ts`, `validator.ts`: Parsing components
- `logging/`: Centralized logging service with feature-specific debug control (NEW)
- `features/`: Feature-specific implementations
  - `speaker/`: Speaker classification feature (production-ready)
  - `revision/`: Text revision feature (production-ready)
  - `segmentMerge/`: Segment merge feature (NEW, refactored with separation of concerns)
    - `validation.ts`: Rule-based validation (NEW)
    - `responseProcessor.ts`: Response processing pipeline (NEW)
    - `promptBuilder.ts`: Prompt construction (NEW)
    - `service.ts`: Main orchestration (refactored, 37% smaller)
    - `utils.ts`, `config.ts`, `types.ts`: Supporting modules

### Documentation & Configuration

- `docs/`: Project design notes and usage docs aimed at contributors and product stakeholders.
  - `features/architecture/`: AI architecture and implementation guides
    - `ai-features-unified.md`: Comprehensive AI features guide (includes developer APIs and patterns)
    - `README.md`: Documentation overview
- Root config (`vite.config.ts`, `tailwind.config.ts`, `tsconfig.json`, `biome.json`, `postcss.config.js`, etc.): Build/lint/format pipeline and design-system configuration.

## Supported Transcript Formats

### Whisper Format (simple array)

```json
[
  { "timestamp": [0, 3.16], "text": " Text content here" },
  { "timestamp": [3.5, 7.2], "text": " More text content" }
]
```

- Segments are assigned to SPEAKER_00
- Word timestamps are auto-generated based on segment duration

### WhisperX Format (object with segments)

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

- Supports multiple speakers with speaker diarization
- Word-level timestamps preserved when available
- Speaker regions shown on waveform when multiple speakers present

## Key Features

- Waveform visualization with wavesurfer.js
- Word-level highlighting during playback
- Inline text editing (double-click to edit)
- Speaker assignment via dropdown
- Segment split at word boundaries (Shift+click word, then split)
- Segment merge with adjacent segments
- Drag-resizable timing boundaries (WhisperX only)
- Undo/Redo support (Ctrl+Z / Ctrl+Shift+Z)
- Filter view by speaker
- Export to JSON, SRT subtitles, or plain text

Detailes in [Features].

## Keyboard Shortcuts

- Space: Play/Pause
- J/L: Skip back/forward 5 seconds
- Left/Right arrows: Seek 1 second
- Up/Down arrows: Navigate segments
- M: Merge with next segment
- Delete: Delete selected segment
- 1-9: Assign speaker by number
- Ctrl+E: Export
- ?: Show shortcuts

## Technologies

- React with TypeScript
- Zustand for state management
- wavesurfer.js for audio visualization
- react-hotkeys-hook for keyboard shortcuts
- Tailwind CSS with shadcn/ui components
- Frontend-only Vite app (no backend)
- Tests with Vitest

## Design

Design in [design_guidelines]

## General Behavior

- For every code change run `npm test`.
  - If `npm test` fails, run `npm install -D vitest @vitest/ui jsdom` before.
- Before making any change, verify full branch coverage for the planned change.
- If full branch coverage is missing and unit or component tests can cover it, add those tests first and make sure they pass.
- Then implement the change and update tests so full coverage remains after the change.
- finally run `npm check` and `npm lint`
  - use `npm lint:fix` to fix obvious findings when some reported, fix the rest manually
  - after manual fixing lint errors, re-run linting and the tests
- use categories like chore/feat/bug etc for commits and comment titles
- use act in tests as proposed by vitest:

```Javascript
act(() => {
  /* fire events that update state */
});
/* assert on the output */
```

## Fundamental Architecture Rules

### Code Quality Principles

1. **Separation of Concerns** - Each module should have a single, well-defined responsibility
   - Extract functions with different concerns into separate modules
   - Keep service layers focused on orchestration, utilities focused on computation
   - Example: Response parsing logic should be separate from feature-specific business logic

2. **Testability through Pure Functions**
   - Pure functions (no side effects, deterministic) should be extracted into separate utility modules
   - Service functions (with side effects like API calls) should be integration-tested with limited scope
   - Aim for 85%+ coverage on pure function utilities, 30-40% on service integration code
   - Never mix pure and impure logic in the same function

3. **Reusability and Composability**
   - Extract patterns that can be used across multiple features
   - Use established patterns (Strategy Pattern, Rule Pattern) instead of duplicating inline logic
   - Example: Recovery strategies for malformed responses, validation rules for input checking
   - Document reusable patterns for other developers to follow

4. **Maintainability through Clear Structure**
   - Changes to one concern should not affect unrelated modules
   - Keep module boundaries clean: types → utilities → services
   - Avoid deep nesting and complex interdependencies
   - Use established patterns to reduce complexity

### Architecture Patterns

1. **Strategy Pattern for Flexible Recovery**
   - Use when handling multiple fallback approaches
   - Example: Response recovery strategies (lenient-parse, partial-array, json-substring)
   - Allows adding new strategies without modifying existing code
   - Each strategy is independently testable

2. **Rule Pattern for Flexible Validation**
   - Use for validation logic that may change or extend
   - Example: Input validation rules with configurable issue levels
   - Separate rules from validation engine
   - Makes it easy to add/remove/modify rules

3. **Service Layer Separation**
   - **Pure Utilities** (in `utils.ts`): Formatting, calculations, data transformations
   - **Response Processing** (in `responseProcessor.ts`): Recovery, normalization, extraction
   - **Main Service** (in `service.ts`): Orchestration, AI execution, logging
   - Keep main service lean by delegating to specialized modules

4. **Type-Safe ID Mapping**
   - Use typed mapping structures (e.g., `BatchPairMapping`) instead of loose objects
   - Centralize ID transformation logic
   - Make ID mapping concerns explicit and separate

### Best Practices

- **Extract early**: If a function grows beyond ~30 lines or mixes concerns, extract it
- **Test utilities first**: Pure functions should be tested before being used in services
- **Log strategically**: Use structured logging (not console.log) for debugging and monitoring
- **Use established libraries**: Don't reinvent logging, validation, or parsing—use proven solutions
- **Document patterns**: When introducing new patterns, add examples to the architecture guide

### Developer Documentation

- All developer documentation is referenced in `docs/features/architecture/README.md`. Consult it for an overview of available docs.
- For detailed developer documentation on AI features, see [AI Features Documentation](docs/features/architecture/ai-features-unified.md).
- Always orient on the documented architecture patterns and best practices when implementing new features.

## Warning

**File Synchronization:**
When using AI agents (like Copilot), always ensure that in-memory file changes are saved to disk BEFORE running terminal commands (like `npm run check` or `npm run test`). Otherwise, the terminal sees a stale version of the file, causing confusion where the agent thinks there's a cache issue when it's actually a sync issue. Rule: **Save first, then run commands.**

**Test Output Interpretation:**
Empty grep output does NOT mean tests passed! The grep pattern may simply not match. Always check for actual "passed" or "failed" counts in the output. If output appears empty, run the command without grep to see full results. Example: `npx vitest run 2>&1 | tail -30` to see actual test results.

Changes around audio loading in `client/src/components/WaveformPlayer.tsx` have previously broken audio playback. Be extra cautious and validate loading and cleanup behavior whenever touching this area.
Zoom handling in `client/src/components/WaveformPlayer.tsx` can cause repeated WaveSurfer re-initialization and flicker if it triggers the main init effect. Avoid wiring zoom state into the initialization dependency chain.

**Performance & Responsiveness:**

- **Handler Stability**: In `useTranscriptEditor.ts`, segment event handlers are cached in a ref (`handlerCacheRef`). **NEVER** remove `segments` from the `useMemo` dependencies of `segmentHandlers` without ensuring that the cache is properly managed, otherwise adjacency logic (merge) will stale. However, always ensure that common handlers remains stable to prevent full transcript list re-renders on every edit.
- **Scroll Logic**: The `useScrollAndSelection.ts` hook implements an interaction-aware auto-scroll. Avoid aggressive auto-scrolling that fights user input. In pause mode, follow the active segment ONLY if the user is not actively interacting with the transcript or if the selection just changed.
- **Virtualization & Memoization**: The `TranscriptList` and `TranscriptSegment` are heavily memoized. Avoid passing unstable anonymous functions as props to `TranscriptSegment`, as this breaks memoization and degrades performance on long transcripts.

**Keyboard Navigation & Event Handling:**

- **Arrow Key Navigation**: In `useNavigationHotkeys.ts`, arrow key handling (Up/Down) uses `preventDefault()` to prevent default scroll behavior and implement segment navigation instead. **CRITICAL**: Always call `preventDefault()` for arrow keys (except in form elements) to ensure they navigate between segments rather than scrolling the container. Without `preventDefault()`, users cannot reliably navigate between segments with keyboard.
- **Double-Click vs Single-Click**: In `TranscriptSegment.tsx`, single-click selection is delayed (200ms timeout) to allow double-click to take precedence. **CRITICAL**: The double-click handler MUST clear the pending single-click timeout BEFORE any other processing (especially before `preventDefault()`) to prevent unintended scrolling or selection. If the timeout is cleared after preventDefault(), the delayed `onSelect()` may still execute and trigger scrolling/centering behavior.
**Player-Transcript Synchronization (CRITICAL):**
See detailed documentation: [Player-Transcript Sync Architecture](docs/features/architecture/player-transcript-sync.md)

- **`seekToTime` MUST use both `setCurrentTime` AND `requestSeek`**: Navigation operations (arrow keys, segment clicks) must update the store's `currentTime` synchronously via `seekToTime`. If you only call `requestSeek` without `setCurrentTime`, the selection sync effect will "correct" the selection back to the old segment because `activeSegment` (derived from `currentTime`) hasn't updated yet.

- **Don't add `isPlaying` checks to the selection sync effect**: The effect in `useScrollAndSelection.ts` must run for ALL time changes, not just during playback. It doesn't conflict with navigation because `seekToTime` updates time AND selection atomically.

- **Test verification requires clean branches**: When tests fail, ALWAYS stash local changes and test on a clean branch before concluding tests are "outdated". The mistake of testing with local changes applied can lead to incorrectly deleting valid tests.
