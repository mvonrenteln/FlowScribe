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
| `lib/aiSpeakerService.ts` | 699 | 1 file (runAnalysis only) | ⚠️ Partial - only runAnalysis left |
| `lib/services/aiRevisionService.ts` | 208 | 0 files | ✅ **UNUSED** - ready to delete |

### New Services (target)

| File | Lines | Status |
|------|-------|--------|
| `lib/ai/features/speaker/service.ts` | 422 | ✅ Complete |
| `lib/ai/features/revision/service.ts` | 225 | ✅ Complete, UI migrated |

---

## Completed Tasks

### Phase 1-4: ✓ (All completed)

### Phase 5: Update UI Bindings ✓
- [x] `AITemplateSettings.tsx` → `SPEAKER_SYSTEM_PROMPT`, `SPEAKER_USER_PROMPT_TEMPLATE` from ai/features/speaker
- [x] `aiSpeakerConfig.ts` → same as above
- [x] `aiSpeakerSlice.ts`:
  - [x] `summarizeIssues` → `summarizeMessages` from core/formatting
  - [x] `summarizeAiSpeakerError` → `summarizeAIError` from core/errors
  - [x] Removed local duplicate `summarizeAiSpeakerError` function
  - [ ] `runAnalysis` - **TODO: requires adapter or slice refactor**
- [x] `aiRevisionSlice.ts`:
  - [x] `RevisionResult` → from ai/features/revision
  - [x] `runRevision` → `reviseSegment` from ai/features/revision
  - [x] `runBatchRevision` → `reviseSegmentsBatch` from ai/features/revision

**Verification:**
- ✅ No imports from `@/lib/services/aiRevisionService` anymore
- ✅ New ai/ module does not import old services (only comment reference)
- ⚠️ Only `aiSpeakerSlice.ts` still imports `runAnalysis` from old service

**Total Tests: 712 (all passing)**

---

## Remaining Tasks

### Phase 5b: Migrate runAnalysis (Optional - can be deferred)
The `runAnalysis` function has a complex interface with `onBatchInfo` callback.
Options:
1. Create adapter in ai/features/speaker that wraps classifySpeakersBatch
2. Refactor aiSpeakerSlice to use new API directly
3. Keep for now, delete old service later when ready

### Phase 6: Test Cleanup

- [ ] Delete `lib/__tests__/aiSpeakerService.test.ts` (covered by new tests)

### Phase 7: Final Cleanup

- [x] Delete `lib/services/aiRevisionService.ts` - ✅ **DELETED**
- [ ] Delete `lib/aiSpeakerService.ts` - needs runAnalysis migration first

---

## Current Import Status

**Old Service Imports:**
```
lib/aiSpeakerService.ts:
  - aiSpeakerSlice.ts: runAnalysis only (TODO)
  - aiSpeakerService.test.ts: old tests (to delete)

lib/services/aiRevisionService.ts:
  - (none) ✅ READY TO DELETE
```

**New Module Usage:**
```
ai/features/speaker:
  - AITemplateSettings.tsx ✅
  - aiSpeakerConfig.ts ✅

ai/features/revision:
  - aiRevisionSlice.ts ✅

ai/core/formatting:
  - aiSpeakerSlice.ts ✅

ai/core/errors:
  - aiSpeakerSlice.ts ✅
```

---

## Progress Log

- 2026-01-03: Phase 1-4 completed
- 2026-01-03: Phase 5 completed - UI bindings updated
- 2026-01-03: aiRevisionService fully migrated, ready to delete
- 2026-01-03: Only runAnalysis left in old service
- 2026-01-03: All 712 tests passing
- 2026-01-03: Fixed feature registration - changed from async to sync imports to avoid race condition
