# AI Module Migration TODO

## Rules
- [x] Always run `npm run check` before committing - NO lint errors allowed (warnings OK)
- [x] Every new function in target structure needs 80% test coverage (for pure functions)
- [x] Use "prompt" consistently, NOT "template" for AI prompts
- [x] Feature-specific code goes into `features/<feature>/`, not feature root
- [x] Cross-cutting concerns (batching, filtering, error handling) go into `core/`

---

## Migration Status Overview

### Old Services (to be replaced)

| File | Lines | UI Bindings | Status |
|------|-------|-------------|--------|
| `lib/aiSpeakerService.ts` | 699 | 3 files | ⚠️ **ACTIVE** - used by UI |
| `lib/services/aiRevisionService.ts` | 208 | 1 file (slice) | ⚠️ **ACTIVE** - used by UI |

### New Services (target)

| File | Lines | Status |
|------|-------|--------|
| `lib/ai/features/speaker/service.ts` | 422 | ✅ Complete |
| `lib/ai/features/revision/service.ts` | 225 | ✅ Complete |

---

## Test Coverage Strategy

See `ai-features-unified.md` Section "5. Testability → Test Coverage Strategy (ADR-2026-01-03)" for full rationale.

---

## Completed Tasks

### Phase 1-3: ✓ (Duplicate removal, Template→Prompt, revision/utils.ts)

### Phase 4.1: Speaker Utils Extraction ✓

### Phase 4.2: Core Cross-Cutting Concerns ✓
- [x] Created `core/batch.ts` and `core/formatting.ts`
- [x] Consolidated `truncateText` and `previewText` into single function
- [x] Tests: 47 new tests

### Phase 4.3: Service Equivalence Verification ✓

**Speaker Service:**
| Old Function | New Function | Status |
|--------------|--------------|--------|
| `runAnalysis` | `classifySpeakersBatch` | ✅ Equivalent |
| `analyzeSegmentsBatched` | (merged into above) | ✅ |
| `parseOllamaResponse` | `parseRawResponse` | ✅ Equivalent |
| `filterSegmentsForAnalysis` | `filterSegments` (core) | ✅ |
| `summarizeIssues` | `summarizeMessages` (core) | ✅ |

**Revision Service:**
| Old Function | New Function | Status |
|--------------|--------------|--------|
| `runRevision` | `reviseSegment` | ✅ Equivalent |
| `runBatchRevision` | `reviseSegmentsBatch` | ✅ Equivalent |
| `parseRevisionResponse` | `parseTextResponse` (parsing) | ✅ |
| `buildPrompt` | `compileTemplate` (prompts) | ✅ |

**Total Tests: 712**

---

## Remaining Tasks

### Phase 5: Update UI Bindings

- [ ] `AITemplateSettings.tsx` → import from `ai/features/speaker`
- [ ] `aiSpeakerConfig.ts` → import from `ai/features/speaker`
- [ ] `aiSpeakerSlice.ts` → import from `ai/features/speaker`
- [ ] `aiRevisionSlice.ts` → import from `ai/features/revision`

### Phase 6: Test Cleanup

- [ ] Delete `lib/__tests__/aiSpeakerService.test.ts` (covered by new tests)

### Phase 7: Final Cleanup

- [ ] Delete `lib/aiSpeakerService.ts` (699 lines)
- [ ] Delete `lib/services/aiRevisionService.ts` (208 lines)

---

## Current Structure

```
client/src/lib/ai/
├── core/
│   ├── batch.ts           # Batch processing utilities
│   ├── formatting.ts      # Output formatting (truncateText, summarizeMessages)
│   ├── errors.ts
│   ├── aiFeatureService.ts
│   ├── featureRegistry.ts
│   ├── providerResolver.ts
│   ├── types.ts
│   └── index.ts
├── features/
│   ├── revision/          # ✅ Complete, equivalent to old service
│   └── speaker/           # ✅ Complete, equivalent to old service
├── parsing/
├── prompts/
└── providers/
```

---

## Progress Log

- 2026-01-03: Phase 1-3 completed
- 2026-01-03: Phase 4.1 completed - extracted speaker pure functions
- 2026-01-03: Phase 4.2 completed - consolidated cross-cutting concerns into core/
- 2026-01-03: Phase 4.3 completed - verified service equivalence
- 2026-01-03: All 712 tests passing
