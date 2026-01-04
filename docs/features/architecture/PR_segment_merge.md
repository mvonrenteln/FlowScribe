# PR: AI Segment Merge – Implementation & Integration (feature: segment-merge)

## Overview

This PR adds a new AI feature: "Segment Merge Suggestions". The AI analyzes consecutive transcript segments and suggests which ones should be merged. Optionally, when merging, the AI can propose "text smoothing" to fix common Whisper transcription artifacts (for example, incorrect sentence breaks or capitalization).

In short: implementation, store integration, UI dialog, tests, and documentation for the Segment Merge feature.

---

## Motivation

Problem before
- Transcripts are often split into many short segments (e.g., by Whisper). Manual merging works but is tedious.
- There was no integrated, consistent AI-based solution to provide structured merge suggestions and minimal, helpful text corrections (smoothing).

Goals
- Use AI to identify likely merge candidates (same speaker, short gap, incomplete sentence, semantic continuity).
- Optionally propose smoothing edits for merged text.
- Make the UX similar to the existing AI Revision dialog (dialog-based workflow).

---

## Solution / What was implemented

Key parts:
- Feature module `segmentMerge` (prompts, types, utils, service)
  - System prompt includes smoothing instructions
  - User templates (detailed and compact variants)
  - A response JSON schema for validation
- Pure utilities (`utils.ts`) — time gap calculation, sentence heuristics, concatenation, basic smoothing
- Service (`service.ts`) — `analyzeMergeCandidates()` plus batch processing; integrates with the unified AI feature service
- Store: Zustand slice `aiSegmentMergeSlice` (actions: start/cancel/accept/reject/acceptAllHigh, etc.)
- UI: `AISegmentMergeDialog` — provider/model selection, options (maxTimeGap, minConfidence, sameSpeakerOnly, enableSmoothing), progress indicator, grouped suggestions (High/Medium/Low), per-suggestion preview (before/after + smoothing info)
- Docs: Updated user guide `docs/features/ai-segment-merge-suggestion.md` and quick reference `docs/features/architecture/AI_QUICK_REFERENCE.md`
- Tests: extensive unit tests for the pure utils; config tests reduced to structural checks; removed trivial constant tests

Design highlights
- Reuse: helper functions are pure and reusable for easy testing
- UX: dialog-based, preview before apply, grouped by confidence, batch actions available
- Privacy: only segment text, speaker tags and timestamps are sent to providers; audio stays local

---

## API / Usage (brief)

Internal API through the unified feature service:

```ts
// from service.ts (example)
const result = await analyzeMergeCandidates({
  segments: mergeAnalysisSegments,
  maxTimeGap: 2.0,
  minConfidence: "medium",
  sameSpeakerOnly: true,
  enableSmoothing: true,
});
```

UI usage:
- Press Alt+Shift+M to open the AI Merge Analysis dialog
- Configure options, run analysis, review suggestions, accept or reject

---

## Tests & Coverage

Included/updated tests:
- Comprehensive behavioral tests for `utils.ts` covering time/gap calculation, sentence heuristics, smoothing, formatting, and suggestion processing
- Structural config tests (feature id, category, batchable, response schema presence)
- Removed trivial static constant tests to focus on behavior

Goal: the behaviorally important functions are fully tested; coverage remains high because the utils are pure functions.

---

## Changed / Added Files

New files:
```
client/src/lib/ai/features/segmentMerge/
├── types.ts
├── utils.ts
├── config.ts
├── service.ts
└── index.ts

client/src/lib/store/slices/aiSegmentMergeSlice.ts
client/src/components/AISegmentMergeDialog.tsx
client/src/lib/ai/features/segmentMerge/__tests__/utils.test.ts
client/src/lib/ai/features/segmentMerge/__tests__/config.test.ts
```

Important modifications:
```
client/src/lib/ai/features/segmentMerge.ts         # re-export -> new folder API
client/src/lib/ai/features/index.ts               # feature export
client/src/lib/ai/core/featureRegistry.ts         # register feature
client/src/lib/store/types.ts                     # store types extended
client/src/lib/store.ts                           # slice integrated
client/src/components/transcript-editor/EditorDialogs.tsx
client/src/components/transcript-editor/useTranscriptEditor.ts
client/src/components/transcript-editor/useNavigationHotkeys.ts
client/src/components/KeyboardShortcuts.tsx
docs/features/ai-segment-merge-suggestion.md     # updated user guide
docs/features/architecture/AI_QUICK_REFERENCE.md  # quick reference updated
docs/features/segment-merge-progress.md           # progress & TODOs
```

---

## Migration / Breaking Changes

- No user-facing breaking changes: manual merge remains unchanged.
- Internally the `segment-merge` feature is registered with the unified AI service; code using `executeFeature` remains compatible.
- CI may require provider mocks if the CI runs provider-dependent checks; see next steps.

---

## How to test (locally)

1. TypeScript & lint checks:

```bash
npm run check    # Type checking (tsgo)
npm run lint     # linting (biome)
```

2. Unit tests (segment merge only):

```bash
# Run only segmentMerge tests with coverage
npx vitest run client/src/lib/ai/features/segmentMerge/__tests__ --coverage --reporter=summary

# Or run the full test suite with coverage
npx vitest run --coverage
```

3. Manual UI smoke test:
- Start dev server: `npm run dev`
- Load a transcript, open editor, press Alt+Shift+M, choose provider/model and analyze
- Verify suggestions, preview and accept/reject behavior

---

## Open items / Next steps

- Integration tests for the dialog UI and the store slice (requires additional mocking)
- Add translation strings for new UI labels (`en.json`, `de.json`)
- Optional: inline merge hints in the transcript view (polish phase)

---

## PR checklist

- [x] Feature implemented (service + utils + types)
- [x] Store slice and integration added
- [x] UI dialog implemented
- [x] Unit tests for pure functions added
- [x] Documentation updated (user guide + quick reference)
- [x] Local TypeScript / lint checks performed