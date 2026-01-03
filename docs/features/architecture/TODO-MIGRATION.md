# AI Module Migration TODO

## Rules
- [x] Always run `npm run check` before committing - NO lint errors allowed (warnings OK)
- [x] Every new function in target structure needs 80% test coverage (for pure functions)
- [x] Use "prompt" consistently, NOT "template" for AI prompts
- [x] Feature-specific code goes into `features/<feature>/`, not feature root
- [x] Cross-cutting concerns (batching, filtering, error handling) go into `core/`

---

## Migration Status: ✅ COMPLETE

### Old Services: DELETED ✓

| File | Status |
|------|--------|
| `lib/aiSpeakerService.ts` | ✅ **DELETED** (699 lines removed) |
| `lib/services/aiRevisionService.ts` | ✅ **DELETED** (208 lines removed) |
| `lib/services/aiProviderService.ts` | ✅ **DELETED** (re-export file) |
| `lib/services/aiProviderTypes.ts` | ✅ **DELETED** (re-export file) |
| `lib/services/ollamaProvider.ts` | ✅ **DELETED** (re-export file) |
| `lib/services/openaiProvider.ts` | ✅ **DELETED** (re-export file) |
| `lib/services/__tests__/` | ✅ **DELETED** (entire test directory) |
| `lib/__tests__/aiSpeakerService.test.ts` | ✅ **DELETED** (3 tests moved) |

**Total: 907+ lines of old service code removed**

### New Services: ACTIVE ✓

| File | Lines | Status |
|------|-------|--------|
| `lib/ai/features/speaker/service.ts` | 615 | ✅ Complete + Legacy adapter |
| `lib/ai/features/revision/service.ts` | 225 | ✅ Complete |

**Total Tests: 682 (all passing)**

---

## Deprecated Aliases: CLEANED ✓

### Core Module - DONE
- [x] `core/formatting.ts`: Removed `previewText` alias
- [x] `core/formatting.ts`: Removed `previewResponse` alias
- [x] `core/formatting.ts`: Removed `summarizeIssues` alias
- [x] `core/errors.ts`: Removed `summarizeAiSpeakerError` alias
- [x] `core/providerResolver.ts`: Removed `resolveProviderSync`

### Features Module - DONE
- [x] `features/speaker/utils.ts`: Removed `filterSegmentsForAnalysis` alias
- [x] `features/speaker/utils.ts`: Removed `summarizeIssues` re-export
- [x] `features/speaker/utils.ts`: Removed `previewResponse` re-export
- [x] `features/revision/config.ts`: Removed `BUILTIN_REVISION_TEMPLATES` alias
- [x] `features/revision/config.ts`: Removed `getDefaultTemplate` alias
- [x] `features/revision/config.ts`: Removed `findTemplate` alias
- [x] `features/revision/types.ts`: Removed `RevisionTemplate` alias

### Providers - DONE
- [x] `ai/providers/factory.ts`: Removed `createAIProvider` alias

---

## API Improvements

### Added `providerId` to AIFeatureOptions
- [x] Added `providerId?: string` to `AIFeatureOptions` in `core/types.ts`
- [x] Updated `executeFeature` to use `providerId` directly (no type casting)
- [x] Updated `ClassifySpeakersOptions` to inherit properly

---

## Current Structure

```
client/src/lib/ai/
├── core/
│   ├── aiFeatureService.ts  # Main feature execution
│   ├── batch.ts             # Batch processing utilities
│   ├── errors.ts            # Error types and utilities
│   ├── featureRegistry.ts   # Auto-registers features on import
│   ├── formatting.ts        # Output formatting
│   ├── providerResolver.ts  # Provider resolution
│   ├── types.ts             # Core types
│   └── index.ts
├── features/
│   ├── revision/            # ✅ Complete
│   │   ├── config.ts
│   │   ├── service.ts
│   │   ├── types.ts
│   │   ├── utils.ts
│   │   └── index.ts
│   └── speaker/             # ✅ Complete + runAnalysis legacy adapter
│       ├── config.ts
│       ├── service.ts       # Includes runAnalysis for backward compat
│       ├── types.ts
│       ├── utils.ts
│       └── index.ts
├── parsing/
├── prompts/
└── providers/
    ├── factory.ts           # Provider factory
    ├── ollama.ts            # Ollama provider
    ├── openai.ts            # OpenAI provider
    ├── types.ts             # Provider types
    └── index.ts
```

---

## Progress Log

- 2026-01-03: Phase 1-4 completed
- 2026-01-03: Phase 5 completed - UI bindings updated
- 2026-01-03: Phase 5b completed - runAnalysis migrated with legacy adapter
- 2026-01-03: Phase 6 completed - Old tests deleted
- 2026-01-03: Phase 7 completed - Old services deleted (907 lines removed)
- 2026-01-03: Fixed feature registration - changed from async to sync imports
- 2026-01-03: **MIGRATION COMPLETE** - 709 tests passing
- 2026-01-03: Added Phase 8 TODO for deprecation cleanup
- 2026-01-04: **DEPRECATION CLEANUP COMPLETE**
  - Removed all deprecated aliases from core/ and features/
  - Added `providerId` directly to `AIFeatureOptions`
  - Deleted old `lib/services/` directory completely
  - Updated component imports to use new locations
  - 682 tests passing
