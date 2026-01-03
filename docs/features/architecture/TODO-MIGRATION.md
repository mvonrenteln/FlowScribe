# AI Module Migration TODO

## Rules
- [x] Always run `npm run check` before committing - NO lint errors allowed (warnings OK)
- [ ] Every new function in target structure needs 80% test coverage
- [x] Use "prompt" consistently, NOT "template" for AI prompts
- [x] Feature-specific code goes into `features/<feature>/`, not feature root

## Current Test Coverage (as of 2026-01-03)
| Module | Coverage | Status |
|--------|----------|--------|
| prompts | 98.46% | ✓ Excellent |
| parsing | 87.10% | ✓ Good |
| core | 32.70% | ✗ Needs work (integration code) |
| providers | 31.78% | ✗ Needs work (external deps) |
| features | 0% | Re-exports only |

### Coverage Notes
- `prompts/` and `parsing/` have excellent unit test coverage
- `core/` contains integration code (`executeFeature`, `resolveProvider`) that requires mocking
- `providers/` contains HTTP clients - integration tests needed
- Feature-specific services (`speaker/service.ts`, `revision/service.ts`) need mocked tests

## Completed Tasks

### Phase 1: Consolidate Duplicate Files ✓
- [x] Removed `features/speakerClassification.ts` (use `features/speaker/config.ts`)
- [x] Removed `features/textRevision.ts` (use `features/revision/config.ts`)
- [x] Updated imports in featureRegistry.ts and aiSpeakerService.ts

### Phase 2: Rename Template → Prompt ✓
- [x] `RevisionTemplate` → `RevisionPrompt` (deprecated alias kept)
- [x] `getDefaultTemplate` → `getDefaultPrompt` (deprecated alias kept)
- [x] `findTemplate` → `findPrompt` (deprecated alias kept)
- [x] `BUILTIN_REVISION_TEMPLATES` → `BUILTIN_REVISION_PROMPTS` (deprecated alias kept)

## Current Structure
```
client/src/lib/ai/
├── __tests__/           # 253 tests total
├── core/
│   ├── aiFeatureService.ts   # executeFeature, executeBatch
│   ├── errors.ts              # AI error types
│   ├── featureRegistry.ts     # Feature registration
│   ├── providerResolver.ts    # Provider resolution
│   ├── types.ts               # Core types
│   └── index.ts
├── features/
│   ├── revision/              # ✓ Properly structured
│   │   ├── config.ts          # Prompts, feature config
│   │   ├── service.ts         # reviseSegment, reviseSegmentsBatch
│   │   ├── types.ts           # RevisionPrompt, etc.
│   │   └── index.ts
│   ├── speaker/               # ✓ Properly structured
│   │   ├── config.ts          # Prompts, feature config
│   │   ├── service.ts         # classifySpeakers, etc.
│   │   ├── types.ts           # SpeakerSuggestion, etc.
│   │   ├── utils.ts           # Formatting utilities
│   │   └── index.ts
│   ├── chapterDetection.ts    # Placeholder
│   ├── contentTransformation.ts # Placeholder
│   ├── segmentMerge.ts        # Placeholder
│   └── index.ts
├── parsing/                   # ✓ Well tested (87%)
│   ├── jsonParser.ts
│   ├── responseParser.ts
│   ├── textParser.ts
│   ├── validator.ts
│   └── index.ts
├── prompts/                   # ✓ Excellent coverage (98%)
│   ├── promptBuilder.ts
│   ├── types.ts
│   └── index.ts
├── providers/
│   ├── factory.ts
│   ├── ollama.ts
│   ├── openai.ts
│   ├── types.ts
│   └── index.ts
└── index.ts
```

## Remaining Tasks

### Phase 3: Test Coverage Improvement
- [ ] Add mocked tests for `core/aiFeatureService.ts`
- [ ] Add mocked tests for `core/providerResolver.ts`
- [ ] Add mocked tests for `features/speaker/service.ts`
- [ ] Add mocked tests for `features/revision/service.ts`

### Phase 4: Organize Placeholder Features (Future)
When implementing, move to proper structure:
- [ ] `chapterDetection.ts` → `chapterDetection/`
- [ ] `contentTransformation.ts` → `contentTransformation/`
- [ ] `segmentMerge.ts` → `segmentMerge/`

### Phase 5: Documentation
- [ ] Update architecture docs
- [ ] Document common patterns
- [ ] Update module JSDoc headers

## Remaining Lint Warnings (acceptable)
- `noExplicitAny` in test files (intentional for testing invalid inputs)
- `noNonNullAssertion` in a few places (can be addressed later)

## Progress Log
- 2026-01-03: Created migration plan, identified issues
- 2026-01-03: Phase 1 completed - deleted duplicate files
- 2026-01-03: Phase 2 completed - renamed Template → Prompt
- 2026-01-03: All checks passing, all 603 tests passing
- 2026-01-03: Coverage analyzed - prompts/parsing good, core/providers need work
