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
| `lib/__tests__/aiSpeakerService.test.ts` | ✅ **DELETED** (3 tests moved) |

**Total: 907 lines of old service code removed**

### New Services: ACTIVE ✓

| File | Lines | Status |
|------|-------|--------|
| `lib/ai/features/speaker/service.ts` | 590 | ✅ Complete + Legacy adapter |
| `lib/ai/features/revision/service.ts` | 225 | ✅ Complete |

**Total Tests: 709 (all passing)**

---

## Remaining Tasks: Deprecation Cleanup

### Phase 8: Remove Deprecated Code (Future)

**Priority: Low** - These are backward-compatibility aliases. Remove when all consumers are updated.

#### Core Module
- [ ] `core/formatting.ts`: Remove `previewText` alias (use `truncateText`)
- [ ] `core/formatting.ts`: Remove `previewResponse` alias (use `truncateText`)
- [ ] `core/formatting.ts`: Remove `summarizeIssues` alias (use `summarizeMessages`)
- [ ] `core/errors.ts`: Remove `summarizeAiSpeakerError` alias (use `summarizeAIError`)
- [ ] `core/providerResolver.ts`: Remove `resolveProviderSync` (use `resolveProvider`)

#### Features Module
- [ ] `features/speaker/utils.ts`: Remove `filterSegmentsForAnalysis` alias (use `core/batch.filterSegments`)
- [ ] `features/speaker/utils.ts`: Remove `summarizeIssues` re-export
- [ ] `features/speaker/utils.ts`: Remove `previewResponse` re-export
- [ ] `features/revision/config.ts`: Remove `BUILTIN_REVISION_TEMPLATES` alias
- [ ] `features/revision/config.ts`: Remove `getDefaultTemplate` alias
- [ ] `features/revision/config.ts`: Remove `findTemplate` alias
- [ ] `features/revision/types.ts`: Remove `RevisionTemplate` alias (use `RevisionPrompt`)

#### Old Provider Files (lib/services/)
- [ ] Delete `lib/services/aiProviderService.ts` (re-export only)
- [ ] Delete `lib/services/aiProviderTypes.ts` (re-export only)
- [ ] Delete `lib/services/ollamaProvider.ts` (re-export only)
- [ ] Delete `lib/services/openaiProvider.ts` (re-export only)

#### Store Types
- [ ] `store/types.ts`: Remove deprecated `ollamaUrl` from AISpeakerConfig
- [ ] `store/types.ts`: Remove deprecated `model` from AISpeakerConfig

#### Providers
- [ ] `ai/providers/factory.ts`: Remove `createAIProvider` alias (use `createProvider`)

---

## Current Structure

```
client/src/lib/ai/
├── core/
│   ├── batch.ts           # Batch processing utilities
│   ├── formatting.ts      # Output formatting
│   ├── errors.ts          # Error types and utilities
│   ├── aiFeatureService.ts
│   ├── featureRegistry.ts # Auto-registers features on import
│   ├── providerResolver.ts
│   ├── types.ts
│   └── index.ts
├── features/
│   ├── revision/          # ✅ Complete
│   │   ├── config.ts
│   │   ├── service.ts
│   │   ├── types.ts
│   │   ├── utils.ts
│   │   └── index.ts
│   └── speaker/           # ✅ Complete + runAnalysis legacy adapter
│       ├── config.ts
│       ├── service.ts     # Includes runAnalysis for backward compat
│       ├── types.ts
│       ├── utils.ts
│       └── index.ts
├── parsing/
├── prompts/
└── providers/
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
