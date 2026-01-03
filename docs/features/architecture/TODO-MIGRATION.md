# AI Module Migration TODO

## Rules
- [x] Always run `npm run check` before committing - NO lint errors allowed (warnings OK)
- [x] Every new function in target structure needs 80% test coverage (for pure functions)
- [x] Use "prompt" consistently, NOT "template" for AI prompts
- [x] Feature-specific code goes into `features/<feature>/`, not feature root

## Test Coverage Strategy (ADR-2026-01-03)

**Decision:** Not all code requires 80% unit test coverage.

| Category | Target | Current |
|----------|--------|---------|
| Pure Functions (`utils.ts`) | 80%+ | ✅ 90%+ |
| Prompt Building (`prompts/`) | 90%+ | ✅ 98% |
| Parsing (`parsing/`) | 80%+ | ✅ 87% |
| Integration (`core/`, `providers/`) | 30-50% | ✅ ~32% |

See `ai-features-unified.md` for full rationale.

## Current Test Coverage (as of 2026-01-03)

| Module | Coverage | Tests | Status |
|--------|----------|-------|--------|
| prompts | 98.46% | 30 | ✓ Excellent |
| parsing | 87.10% | 100+ | ✓ Good |
| revision/utils | 90%+ | 38 | ✓ NEW |
| speaker/utils | 85%+ | 29 | ✓ Good |
| core | 32.70% | 26 | Integration |
| providers | 31.78% | 21 | Integration |

**Total Tests:** 641 (up from 603)

## Completed Tasks

### Phase 1: Consolidate Duplicate Files ✓
- [x] Removed `features/speakerClassification.ts`
- [x] Removed `features/textRevision.ts`
- [x] Updated all import references

### Phase 2: Rename Template → Prompt ✓
- [x] `RevisionTemplate` → `RevisionPrompt`
- [x] `getDefaultTemplate` → `getDefaultPrompt`
- [x] `findTemplate` → `findPrompt`
- [x] Deprecated aliases kept for backward compatibility

### Phase 3: Extract Pure Functions ✓
- [x] Created `revision/utils.ts` with pure functions
- [x] Created `revisionUtils.test.ts` with 38 tests
- [x] Documented test coverage strategy in architecture docs

## Current Structure

```
client/src/lib/ai/
├── __tests__/           # 297 AI-specific tests
├── core/                # Integration code (32% coverage OK)
├── features/
│   ├── revision/        # ✓ Complete with utils.ts
│   │   ├── config.ts
│   │   ├── service.ts
│   │   ├── types.ts
│   │   ├── utils.ts     # NEW: Pure functions
│   │   └── index.ts
│   ├── speaker/         # ✓ Complete
│   │   ├── config.ts
│   │   ├── service.ts
│   │   ├── types.ts
│   │   ├── utils.ts
│   │   └── index.ts
│   ├── chapterDetection.ts    # Placeholder
│   ├── contentTransformation.ts
│   ├── segmentMerge.ts
│   └── index.ts
├── parsing/             # ✓ Well tested (87%)
├── prompts/             # ✓ Excellent coverage (98%)
└── providers/           # Integration (32% coverage OK)
```

## Remaining Tasks

### Optional: Additional Pure Function Extraction
- [ ] Extract more pure functions from `speaker/service.ts` if needed
- [ ] Extract response normalization to `speaker/utils.ts`

### Future: Organize Placeholder Features
When implementing:
- [ ] `chapterDetection.ts` → `chapterDetection/`
- [ ] `contentTransformation.ts` → `contentTransformation/`
- [ ] `segmentMerge.ts` → `segmentMerge/`

## Progress Log
- 2026-01-03: Created migration plan, identified issues
- 2026-01-03: Phase 1 completed - deleted duplicate files
- 2026-01-03: Phase 2 completed - renamed Template → Prompt
- 2026-01-03: Phase 3 completed - extracted pure functions, 38 new tests
- 2026-01-03: Documented test coverage strategy (ADR-2026-01-03)
- 2026-01-03: All 641 tests passing
