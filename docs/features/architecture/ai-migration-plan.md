# Phase 2: AI Module Migration - Complete Refactoring Plan

## 📋 Current State Analysis

### Problem 1: Scattered File Locations
```
Current Structure (MESSY):
/src/lib/
├── aiSpeakerService.ts          ❌ Root level - should be in ai/
├── services/
│   ├── aiProviderService.ts     ❌ Should be in ai/providers/
│   ├── aiProviderTypes.ts       ❌ Should be in ai/providers/
│   ├── aiRevisionService.ts     ❌ Should be in ai/features/
│   ├── ollamaProvider.ts        ❌ Should be in ai/providers/
│   └── openaiProvider.ts        ❌ Should be in ai/providers/
└── ai/
    ├── core/                    ✅ New unified types
    ├── features/                ✅ New feature configs (but disconnected!)
    ├── parsing/                 ✅ New parsing utilities
    └── prompts/                 ✅ New prompt utilities
```

### Problem 2: Duplicate/Disconnected Code
| New Module | Old Service | Status |
|------------|-------------|--------|
| `ai/features/speakerClassification.ts` | `aiSpeakerService.ts` | Configs defined, but service still has all logic |
| `ai/features/textRevision.ts` | `services/aiRevisionService.ts` | Configs defined, but service still has all logic |
| `ai/core/aiFeatureService.ts` | Both services | Not used by either service! |

### Problem 3: Cross-Cutting Concerns in Services

**In aiSpeakerService.ts (702 lines!):**
- Provider resolution (lines 257-290) → Should be in ai/providers
- callAIProvider() → Duplicate of createAIProvider().chat()
- callOllama() → Legacy, should be removed
- JSON parsing (extractJsonArray) → Partially migrated, still has regex fallback
- Error handling (AISpeakerResponseError) → Should be unified
- Batching logic → Should be in ai/core
- Progress tracking → Should be in ai/core
- Prompt building → Partially migrated

**In aiRevisionService.ts (208 lines):**
- Provider resolution (getActiveProvider) → Duplicate of aiSpeakerService
- Response parsing (parseRevisionResponse) → Should be in ai/parsing
- Error detection logic → Should be unified
- Batching logic → Should be in ai/core

### Problem 4: Provider Architecture Not Integrated
```
ai/providers/ DOES NOT EXIST!

Current providers are in services/:
- aiProviderService.ts
- aiProviderTypes.ts
- ollamaProvider.ts  
- openaiProvider.ts

These need to move to ai/providers/ and be properly exported.
```

---

## 🎯 Target Architecture

```
/src/lib/ai/
├── index.ts                        # Main public API
│
├── core/
│   ├── types.ts                    # Core types (AIFeatureConfig, etc.)
│   ├── featureRegistry.ts          # Feature registration
│   ├── featureService.ts           # Unified execution (executeFeature, executeBatch)
│   ├── providerResolver.ts         # NEW: Resolve provider from settings
│   ├── errors.ts                   # NEW: Unified error types
│   └── index.ts
│
├── providers/
│   ├── types.ts                    # MOVE: AIProviderConfig, AIProviderService, etc.
│   ├── factory.ts                  # MOVE: createAIProvider()
│   ├── ollama.ts                   # MOVE: OllamaProvider
│   ├── openai.ts                   # MOVE: OpenAIProvider
│   └── index.ts
│
├── prompts/
│   ├── types.ts                    # Prompt types
│   ├── builder.ts                  # compileTemplate
│   └── index.ts
│
├── parsing/
│   ├── types.ts                    # Parse types
│   ├── json.ts                     # extractJSON
│   ├── validator.ts                # validate
│   ├── response.ts                 # parseResponse
│   ├── text.ts                     # NEW: parseTextResponse (for revision)
│   └── index.ts
│
├── features/
│   ├── speaker/
│   │   ├── config.ts               # Feature config + prompts
│   │   ├── service.ts              # MOVE: Core logic from aiSpeakerService
│   │   ├── types.ts                # Speaker-specific types
│   │   ├── utils.ts                # normalizeSpeakerTag, resolveSuggestedSpeaker
│   │   └── index.ts
│   ├── revision/
│   │   ├── config.ts               # Feature config + prompts  
│   │   ├── service.ts              # MOVE: Core logic from aiRevisionService
│   │   ├── types.ts                # Revision-specific types
│   │   └── index.ts
│   ├── merge/                      # Placeholder
│   ├── chapters/                   # Placeholder
│   ├── transform/                  # Placeholder
│   └── index.ts
│
└── __tests__/
    ├── core/
    │   ├── featureService.test.ts
    │   ├── providerResolver.test.ts
    │   └── errors.test.ts
    ├── providers/
    │   ├── factory.test.ts
    │   ├── ollama.test.ts
    │   └── openai.test.ts
    ├── parsing/
    │   ├── json.test.ts
    │   ├── validator.test.ts
    │   └── text.test.ts
    ├── features/
    │   ├── speaker.test.ts
    │   └── revision.test.ts
    └── integration/
        ├── speaker-flow.test.ts
        └── revision-flow.test.ts
```

---

## 📝 Detailed Migration TODO

### Phase 2.6.1: Provider Layer Migration
- [x] Create `ai/providers/` directory
- [x] Move `services/aiProviderTypes.ts` → `ai/providers/types.ts`
- [x] Move `services/ollamaProvider.ts` → `ai/providers/ollama.ts`
- [x] Move `services/openaiProvider.ts` → `ai/providers/openai.ts`
- [x] Move `services/aiProviderService.ts` → `ai/providers/factory.ts`
- [x] Create `ai/providers/index.ts` with clean exports
- [x] Update all imports in existing code (backward-compat wrappers)
- [x] Write tests for provider factory (21 tests)
- [ ] Delete old files from `services/` (kept as re-export wrappers)

### Phase 2.6.2: Core Infrastructure
- [x] Create `ai/core/providerResolver.ts`
  - [x] Extract provider resolution logic from aiSpeakerService
  - [x] Extract provider resolution logic from aiRevisionService
  - [x] Unify into single `resolveProvider(options)` function
  - [ ] Write tests

- [x] Create `ai/core/errors.ts`
  - [x] Define unified `AIError` base class
  - [x] Define `AIProviderError` (already exists, move here)
  - [x] Define `AIParseError`
  - [x] Define `AIValidationError`
  - [x] Define `AICancellationError`
  - [x] Write tests (24 tests)

- [ ] Update `ai/core/featureService.ts`
  - [ ] Use `providerResolver` instead of inline resolution
  - [ ] Use unified error types
  - [ ] Add proper logging hooks
  - [ ] Write integration tests

### Phase 2.6.3: Parsing Layer Enhancement
- [ ] Create `ai/parsing/text.ts`
  - [ ] Extract `parseRevisionResponse` from aiRevisionService
  - [ ] Generalize to `parseTextResponse(response, options)`
  - [ ] Add error detection logic
  - [ ] Write tests

- [ ] Update `ai/parsing/json.ts`
  - [ ] Remove `require()` call (use proper import)
  - [ ] Add speaker-specific regex fallback as option
  - [ ] Write additional tests

### Phase 2.6.4: Speaker Feature Migration
- [ ] Create `ai/features/speaker/` directory structure
- [ ] Create `ai/features/speaker/types.ts`
  - [ ] Move `AISpeakerSuggestion` interface
  - [ ] Move `AISpeakerConfig` interface
  - [ ] Move internal types (BatchSegment, BatchIssue, etc.)

- [ ] Create `ai/features/speaker/utils.ts`
  - [ ] Move `normalizeSpeakerTag()`
  - [ ] Move `resolveSuggestedSpeaker()`
  - [ ] Move `markNewSpeaker()`
  - [ ] Move `formatSegmentsForPrompt()`
  - [ ] Move `formatSpeakersForPrompt()`
  - [ ] Write tests

- [ ] Create `ai/features/speaker/service.ts`
  - [ ] Use `executeFeature` from core
  - [ ] Use `resolveProvider` from core
  - [ ] Use `extractJSON` from parsing
  - [ ] Keep speaker-specific post-processing
  - [ ] Implement `classifySpeakers()` function
  - [ ] Implement `classifySpeakersBatch()` function
  - [ ] Write tests

- [ ] Update `ai/features/speaker/config.ts` (rename from speakerClassification.ts)
  - [ ] Keep prompts and feature config
  - [ ] Add response schema

- [ ] Create `ai/features/speaker/index.ts`
  - [ ] Export config, service, types

- [ ] Create backward-compatible wrapper
  - [ ] `src/lib/aiSpeakerService.ts` becomes thin wrapper
  - [ ] Re-exports from `ai/features/speaker`
  - [ ] Deprecation notices on old functions

### Phase 2.6.5: Revision Feature Migration
- [ ] Create `ai/features/revision/` directory structure
- [ ] Create `ai/features/revision/types.ts`
  - [ ] Move `RevisionResult` interface
  - [ ] Move `SingleRevisionParams`, `BatchRevisionParams`

- [ ] Create `ai/features/revision/service.ts`
  - [ ] Use `executeFeature` from core
  - [ ] Use `resolveProvider` from core
  - [ ] Use `parseTextResponse` from parsing
  - [ ] Keep revision-specific post-processing (diff computation)
  - [ ] Implement `reviseSegment()` function
  - [ ] Implement `reviseSegmentsBatch()` function
  - [ ] Write tests

- [ ] Update `ai/features/revision/config.ts` (rename from textRevision.ts)
  - [ ] Keep prompts and feature config

- [ ] Create `ai/features/revision/index.ts`
  - [ ] Export config, service, types

- [ ] Create backward-compatible wrapper
  - [ ] `src/lib/services/aiRevisionService.ts` becomes thin wrapper
  - [ ] Re-exports from `ai/features/revision`
  - [ ] Deprecation notices on old functions

### Phase 2.6.6: Cleanup Legacy Code
- [ ] Remove `callOllama()` from aiSpeakerService (legacy)
- [ ] Remove duplicate error classes
- [ ] Remove duplicate provider resolution
- [ ] Remove inline JSON parsing
- [ ] Update store slices to use new imports
- [ ] Update components to use new imports
- [ ] Run full test suite

### Phase 2.6.7: Integration Tests
- [ ] Write `speaker-flow.test.ts`
  - [ ] Test full flow from segments → suggestions
  - [ ] Test batch processing
  - [ ] Test cancellation
  - [ ] Test error handling

- [ ] Write `revision-flow.test.ts`
  - [ ] Test full flow from segment → revised text
  - [ ] Test batch processing
  - [ ] Test cancellation
  - [ ] Test error handling

### Phase 2.6.8: Documentation
- [ ] Update architecture documentation
- [ ] Add migration guide for existing code
- [ ] Add API reference for ai module
- [ ] Update TODO list

---

## 📊 Progress Tracking

| Phase | Status | Tests | Notes |
|-------|--------|-------|-------|
| 2.6.1 Provider Migration | ✅ Complete | 21 | Providers in `ai/providers/` |
| 2.6.2 Core Infrastructure | 🔄 In Progress | 24 | Errors + ProviderResolver done |
| 2.6.3 Parsing Enhancement | ⬜ Not Started | 0 | |
| 2.6.4 Speaker Migration | ⬜ Not Started | 0 | |
| 2.6.5 Revision Migration | ⬜ Not Started | 0 | |
| 2.6.6 Cleanup | ⬜ Not Started | 0 | |
| 2.6.7 Integration Tests | ⬜ Not Started | 0 | |
| 2.6.8 Documentation | ⬜ Not Started | 0 | |

**Overall:** ~25% Complete

**Test Summary:**
- AI Module Tests: 161 tests (7 files)
- Total Project Tests: 505 tests (55 files)

---

## 🔑 Key Principles

### 1. Test First
Every new file gets tests before implementation.

### 2. Separation of Concerns
- **Providers**: Only handle API communication
- **Core**: Only orchestration and common logic
- **Parsing**: Only response parsing
- **Features**: Only feature-specific logic

### 3. Single Source of Truth
- Prompts defined once in feature config
- Provider resolution in one place
- Error types in one place

### 4. Backward Compatibility
Old service files become thin wrappers with deprecation notices.
No breaking changes to store slices or components initially.

### 5. Incremental Migration
Each phase can be completed and tested independently.
Run full test suite after each phase.

---

*Created: January 2, 2026*
*Status: Planning Complete, Ready for Implementation*

