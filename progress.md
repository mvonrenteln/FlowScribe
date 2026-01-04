# AI Segment Merge Feature - Progress

## Current Status: Bug Fix Applied - Ready for Testing

Last Updated: 2026-01-04

---

## Completed Tasks

### Phase 1: Core Infrastructure ✅

- [x] Created `segmentMerge` feature module under `client/src/lib/ai/features/segmentMerge/`
  - [x] `types.ts` - Type definitions for merge analysis
  - [x] `config.ts` - Feature configuration, prompts, response schema
  - [x] `utils.ts` - Pure helper functions (formatting, processing, validation)
  - [x] `service.ts` - Main analysis service with AI execution
  - [x] `index.ts` - Module exports

- [x] Feature registration in `client/src/lib/ai/core/featureRegistry.ts`

- [x] Store integration via `aiSegmentMergeSlice.ts`

- [x] UI components:
  - [x] `AISegmentMergeDialog.tsx` - Main dialog for merge suggestions
  - [x] Toolbar integration with button/shortcut

### Phase 2: Bug Fixes & Improvements ✅

- [x] **Simple ID Mapping** (Fix for small models)
  - Small models struggle with complex IDs like `seg-335`
  - Now uses simple 1-based IDs (1, 2, 3, ...) in prompts
  - ID mapping translates back to real segment IDs after AI response

- [x] **FIXED: pairMappingJson contained wrong IDs**
  - Was: `segmentIds: [simpleIdA, simpleIdB]` (simple numbers)
  - Now: `segmentIds: [segmentA.id, segmentB.id]` (real segment IDs)
  - This was causing `segmentIds: ['335', '336']` instead of `['seg-335', 'seg-336']`

- [x] **Improved aiFeatureService normalization**
  - Better handling of `pairId`, `mergeId` (including string format "131-132")
  - Uses `pairIndexMap` with real segment IDs for lookup
  - Falls back gracefully through multiple ID formats

- [x] **Core: Extracted BatchIdMapping utilities**
  - Created `client/src/lib/ai/core/batchIdMapping.ts`
  - Generic utilities for simple↔real ID conversion
  - Exported from `@/lib/ai/core`

- [x] **Debug Logging**
  - Opt-in via `globalThis.__AISegmentMergeDebug = true`
  - Persistent via `localStorage.setItem("aiSegmentMergeDebug", "1")`
  - Added detailed logging in `normalizeRawSuggestion`

### Phase 3: Batching (Pending Implementation)

- [ ] **Batch Processing for Large Transcripts**
  - Split segments into batches of ~20 for smaller models
  - Overlap by 1 segment to catch boundary merges
  - Progress callbacks during batch processing
  - Deduplicate suggestions across batches

---

## Key Files Modified

| File | Changes |
|------|---------|
| `segmentMerge/utils.ts` | Added `BatchIdMapping`, `createBatchIdMapping`, `formatSegmentsWithSimpleIds`, `collectSegmentPairsWithSimpleIds`, `formatSegmentPairsWithSimpleIds`, `normalizeRawSuggestion` |
| `segmentMerge/service.ts` | Refactored to use simple IDs, added ID mapping, added normalization step |
| `core/aiFeatureService.ts` | Enhanced lenient parsing with feature-specific normalization for `segment-merge` |
| `parsing/validator.ts` | Added type coercions (array→string, number→string, single-value→array) |

---

## Known Issues / TODOs

1. **Batching not yet active** - Currently all segments sent at once. Need to implement batch loop in `analyzeMergeCandidatesBatch`.

2. **Pair Index Confusion** - AI sees "Pair 131" because that's the 131st *valid* pair after filtering. This is correct behavior, not a bug.

3. **Test Coverage** - Need to add tests for:
   - `normalizeRawSuggestion` with various input formats
   - `createBatchIdMapping` and ID translation
   - `processSuggestions` with normalized data

---

## How to Debug

1. Open Chrome DevTools Console
2. Enable debug logging:
   ```js
   globalThis.__AISegmentMergeDebug = true
   ```
3. Trigger AI Merge analysis
4. Check console for `[AISegmentMerge][DEBUG]` messages

For persistent debugging across page reloads:
```js
localStorage.setItem("aiSegmentMergeDebug", "1")
```

To disable:
```js
localStorage.removeItem("aiSegmentMergeDebug")
```

---

## Architecture Notes

### Simple ID Flow

```
Segments: [{ id: "seg-335" }, { id: "seg-336" }, ...]
                    ↓
createBatchIdMapping()
                    ↓
idMapping.realToSimple: { "seg-335" → 1, "seg-336" → 2, ... }
idMapping.simpleToReal: { 1 → "seg-335", 2 → "seg-336", ... }
                    ↓
Prompt uses: [1], [2], [3], ...
                    ↓
AI returns: { pairIndex: 1, ... } or { segmentIds: [1, 2], ... }
                    ↓
normalizeRawSuggestion(raw, idMapping)
                    ↓
Normalized: { segmentIds: ["seg-335", "seg-336"], ... }
                    ↓
processSuggestions() → MergeSuggestion[]
```

### Response Normalization Priority

1. `pairIndex` / `pairId` / `pair` → lookup in `pairToSegmentIds`
2. `segmentIds` array → map simple IDs via `simpleToReal`
3. `segmentA.id` / `segmentB.id` → extract directly
4. `ids` array → map simple IDs via `simpleToReal`
5. `mergeId` → lookup in `pairToSegmentIds`

