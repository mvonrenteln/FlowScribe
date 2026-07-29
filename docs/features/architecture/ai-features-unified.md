# AI Features: Unified Architecture & Implementation Guide

*Last Updated: February 5, 2026*
*Status: Phase 1 Complete ✅ - Phase 2 Complete ✅ - Refactoring Complete ✅*

---

## Current Implementation Status

### Recent Refactoring (January 2026) ✨

**Segment Merge Service Refactoring:**

- ✅ Extracted Response Recovery (Strategy Pattern)
- ✅ Extracted Validation Rules (Rule Pattern)  
- ✅ Extracted Response Processing (separate module)
- ✅ Extracted Prompt Building (separate module)
- ✅ Introduced Logging Service with debug control
- ✅ Code reduction: 37% smaller service.ts (301 → 181 lines)
- ✅ 280+ lines of inline parsing/recovery code → reusable modules
- ✅ 280+ new unit tests added

### File Structure (Implemented)

```text
/src/lib/ai/
├── core/                         # Core infrastructure
│   ├── types.ts                  # Unified types
│   ├── aiFeatureService.ts       # Feature execution service
│   ├── featureRegistry.ts        # Feature registration
│   ├── providerResolver.ts       # Provider resolution
│   ├── errors.ts                 # Unified error types
│   └── index.ts                  # Public exports
│
├── providers/                    # AI Provider Layer
│   ├── types.ts                  # Provider interfaces
│   ├── factory.ts                # Provider factory
│   ├── ollama.ts                 # Ollama provider
│   ├── openai.ts                 # OpenAI provider
│   └── index.ts                  # Public exports
│
├── prompts/                      # Prompt building
│   ├── types.ts                  # Prompt types
│   ├── promptBuilder.ts          # Template compilation
│   └── index.ts
│
├── parsing/                      # Response parsing
│   ├── jsonParser.ts             # JSON extraction
│   ├── responseParser.ts         # Response validation
│   ├── recoveryStrategies.ts     # Strategy-based recovery (NEW)
│   ├── textParser.ts             # Text response parsing
│   ├── validator.ts              # Schema validation
│   ├── types.ts                  # Parsing types
│   └── index.ts

├── logging/                      # Logging service (shared)
│   ├── loggingService.ts         # General-purpose logging with debug control
│   ├── index.ts                  # Exports
│   └── __tests__/
│       └── loggingService.test.ts # 90+ tests
│
├── features/                     # Feature definitions
│   ├── speaker/                  # Speaker classification module
│   │   ├── types.ts              # Type definitions
│   │   ├── utils.ts              # Pure helper functions
│   │   ├── config.ts             # Prompts & configuration
│   │   ├── service.ts            # AI service functions
│   │   └── index.ts              # Public exports
│   ├── revision/                 # Text revision module
│   │   ├── types.ts              # Type definitions
│   │   ├── utils.ts              # Pure helper functions
│   │   ├── config.ts             # Prompts & configuration
│   │   ├── service.ts            # AI service functions
│   │   └── index.ts              # Public exports
│   ├── segmentMerge/             # Segment merge module (REFACTORED)
│   │   ├── types.ts              # Type definitions
│   │   ├── utils.ts              # Pure helper functions
│   │   ├── config.ts             # Prompts & configuration
│   │   ├── service.ts            # Main service (181 lines, -37%)
│   │   ├── validation.ts         # Validation rules (NEW)
│   │   ├── responseProcessor.ts  # Response processing (NEW)
│   │   ├── promptBuilder.ts      # Prompt building (NEW)
│   │   ├── index.ts              # Public exports
│   │   └── __tests__/
│   │       ├── validation.test.ts
│   │       ├── responseProcessor.test.ts
│   │       └── promptBuilder.test.ts
│   ├── chapterDetection.ts       # Chapter feature config (placeholder)
│   ├── contentTransformation.ts  # Transform config (placeholder)
│   └── index.ts
│
└── __tests__/                    # Test suite (750+ total tests)
    ├── errors.test.ts            # 24 tests
    ├── featureRegistry.test.ts   # 17 tests
    ├── promptBuilder.test.ts     # 30 tests
    ├── jsonParser.test.ts        # 35 tests
    ├── responseParser.test.ts    # 23 tests
    ├── textParser.test.ts        # 42 tests
    ├── aiFeatureService.test.ts  # 9 tests
    ├── providerFactory.test.ts   # 21 tests
    ├── speakerUtils.test.ts      # 29 tests
    ├── speakerService.test.ts    # 14 tests
    ├── revisionUtils.test.ts     # 38 tests
    ├── revisionService.test.ts   # 15 tests
    ├── loggingService.test.ts    # 90+ tests (NEW)
    ├── recoveryStrategies.test.ts # 40+ tests (NEW)
    ├── validation.test.ts        # 50+ tests (NEW)
    ├── responseProcessor.test.ts # 60+ tests (NEW)
    └── promptBuilder.test.ts     # 40+ tests (NEW)
```

---

## Overview

This document describes the unified architecture for all AI features in FlowScribe. While each feature has distinct functionality, they share common infrastructure, patterns, and implementation approaches. This guide ensures consistent, maintainable, and extensible AI capabilities.

### Runtime Configuration (Global Settings)

FlowScribe exposes global AI settings that apply to all providers and features. These settings are stored locally and are read by the AI feature service at request time. The most important knobs are:

- **Request timeout:** Maximum time in seconds to wait for a response before aborting the request.
- **Default temperature:** Controls response randomness for AI completions. GPT-5 models require temperature `1` and will be normalized automatically when using OpenAI-compatible providers.
- **Parallel request limits:** Controls whether batch operations run in parallel and how many requests can be in flight.

---

## 🎯 Core Design Principles

### 1. Manual-First Principle ⭐

> **"Every AI feature must have a fully functional manual alternative."**

This is the most important design principle in FlowScribe:

- **Users without AI API access must remain fully capable**
- Manual features serve as the foundation; AI adds convenience
- AI suggestions build upon existing manual workflows
- Users learn the domain through manual work, then accelerate with AI

**Implementation Pattern:**

1. Design & implement manual feature first
2. Ensure manual feature is complete and usable
3. Add AI as enhancement layer on top
4. AI uses same data structures and operations as manual

**Current Examples:**
| Domain | Manual Feature | AI Enhancement |
| ------ | -------------- | -------------- |
| Text Editing | Direct segment editing | Transcript Revision |
| Quality Check | Confidence indicators, Spellcheck, Glossary | Revision suggestions |
| Speaker Labels | Manual speaker assignment | Speaker Classification |
| Segment Merge | Manual merge (select + merge) | Merge Suggestions |
| Chapters | Manual chapter creation (planned) | Chapter Detection (planned) |
| Multi-Track | Manual track comparison (planned) | Track Merge AI (planned) |

---

### 2. Separation of Concerns

Each feature is structured as an independent module:

```
/src/features/{feature-name}/
├── components/          # UI components
├── hooks/               # React hooks
├── services/            # Business logic
├── types/               # TypeScript types
├── utils/               # Helper functions
└── index.ts             # Public API
```

**Benefits:**
- Features can be developed independently
- Easy to test in isolation
- Clear ownership and boundaries
- Potential for lazy loading

---

### 3. DRY (Don't Repeat Yourself)

Shared functionality extracted to common packages:

```
/src/lib/ai/
├── core/                # AIFeatureService, types
├── providers/           # OpenAI, Ollama, Anthropic adapters
├── prompts/             # Prompt building utilities
└── parsing/             # Response parsing utilities
```

**Rule:** If code is used by 2+ features, extract to shared lib.

---

### 4. YAGNI (You Aren't Gonna Need It)

- Implement only what's needed for current phase
- Don't build infrastructure for hypothetical features
- Start simple, refactor when complexity is justified
- Feature flags over feature bloat

---

### 5. Testability

Every component designed for testability:

- **Pure functions** for business logic (easy unit tests)
- **Dependency injection** for services (mockable)
- **Component isolation** (React Testing Library)
- **Integration tests** for workflows (E2E with Playwright)

#### Test Coverage Strategy (ADR-2026-01-03)

**Decision:** Not all code requires 80% unit test coverage. We differentiate based on code category.

**Rationale:**

- Integration code (HTTP clients, AI orchestration) is difficult to unit test meaningfully
- Mocking external dependencies often tests mocks, not real behavior
- Pure functions provide high value per test; integration code does not
- Limited resources should focus on high-value tests

**Coverage Targets by Category:**

| Category | Target | Rationale |
|----------|--------|-----------|
| **Pure Functions** (`utils.ts`, `parsing/`) | 80%+ | Easy to test, high value, no mocking needed |
| **Prompt Building** (`prompts/`) | 90%+ | Critical for AI quality, pure string transforms |
| **Feature Config** (`config.ts`) | 50%+ | Mostly static data, test structure not content |
| **Orchestration** (`aiFeatureService.ts`) | 30-50% | Integration code, test critical paths only |
| **HTTP Providers** (`providers/`) | 20-30% | External deps, prefer E2E tests |

**Implementation Pattern:**

```typescript
// BAD: Trying to unit test integration code
async function reviseSegment(params) {
  const result = await executeFeature(...);  // Hard to mock meaningfully
  const changes = computeChanges(...);       // Mixed concerns
  return { ... };
}

// GOOD: Extract pure functions for testing
// In utils.ts (easily testable):
export function buildPromptVariables(segment, context) { ... }
export function hasTextChanges(original, revised) { ... }
export function validatePrompt(prompt) { ... }

// In service.ts (integration, minimal testing):
async function reviseSegment(params) {
  const vars = buildPromptVariables(params.segment, context);  // Tested separately
  const result = await executeFeature(...);                      // Integration only
  return processResult(result);                                   // Tested separately
}
```

**Current Coverage (as of 2026-01-04):**

| Module | Coverage | Status |
|--------|----------|--------|
| `prompts/` | 98.46% | ✅ Excellent |
| `parsing/` | 87.10% | ✅ Good |
| `logging/` | 95%+ | ✅ Excellent (NEW) |
| `parsing/recoveryStrategies` | 90%+ | ✅ Good (NEW) |
| `features/segmentMerge/validation` | 90%+ | ✅ Good (NEW) |
| `features/segmentMerge/responseProcessor` | 85%+ | ✅ Good (NEW) |
| `features/segmentMerge/promptBuilder` | 90%+ | ✅ Good (NEW) |
| `features/speaker/utils.ts` | 85%+ | ✅ Good |
| `features/revision/utils.ts` | 90%+ | ✅ Good |
| `core/` | 32.70% | ⚠️ Integration code |
| `providers/` | 31.78% | ⚠️ HTTP clients |

**Test File Organization:**

```
/src/lib/ai/__tests__/
├── promptBuilder.test.ts     # Pure function tests (prompts/)
├── jsonParser.test.ts        # Pure function tests (parsing/)
├── responseParser.test.ts    # Pure function tests (parsing/)
├── textParser.test.ts        # Pure function tests (parsing/)
├── speakerUtils.test.ts      # Pure function tests (features/speaker/)
├── revisionUtils.test.ts     # Pure function tests (features/revision/)
├── featureRegistry.test.ts   # Registry operations (core/)
├── errors.test.ts            # Error handling (core/)
├── providerFactory.test.ts   # Factory tests (providers/)
├── aiFeatureService.test.ts  # Integration tests (core/) - limited scope
├── speakerService.test.ts    # Integration tests - limited scope
└── revisionService.test.ts   # Integration tests - limited scope
```

---

## Feature Matrix

### Current & Planned Features

| Feature | Manual Version | AI Enhancement | Status |
|---------|---------------|----------------|--------|
| **Text Editing** | ✅ Segment editor | ✅ Transcript Revision | Complete |
| **Speaker Labels** | ✅ Manual assignment | ✅ Speaker Classification | Complete |
| **Segment Merge** | ✅ Manual merge | 📋 Merge Suggestions | Manual: ✅, AI: Planned |
| **Chapters** | 📋 Manual creation | 📋 Chapter Detection | Both: Planned |
| **Multi-Track** | 📋 Manual comparison | 📋 AI Track Selection | Both: Planned |
| **Content Export** | 📋 Manual summary | 📋 AI Transformation | Both: Planned |

---

## AI Command Panel Architecture

A **unified side panel** provides consistent access to all batch AI operations (Speaker Classification, Segment Merge, Batch Text Revision, and planned features). The panel follows a **standardized structure** across all features, reducing learning curve and enabling seamless scaling.

### Key Design

- **Three-column layout**: Filters (20%) | Transcript (50-55%) | AI Panel (25-30%)
- **One entry point**: Single "AI Tools" button opens the unified panel
- **Standardized workflow**: Tabs → Scope → Configuration → Settings → Start → Progress → Results
- **Results in context**: Suggestions appear inline in the Transcript, not in the narrow panel
- **Two navigation modes**: Sequential (keyboard) and selective (mouse-click jump navigation)

### Quick Feature Mapping

| Feature | Workflow Type | Location | Panel Tabs |
| ------- | ------------ | -------- | --------- |
| **Text Revision (inline)** | Element-level | Menu on text [✨] | None (inline only) |
| **Text Revision (batch)** | Batch | AI Command Panel | ✅ Revision tab |
| **Speaker Classification** | Batch | AI Command Panel | ✅ Speaker tab |
| **Segment Merge** | Batch | AI Command Panel | ✅ Merge tab |
| **Chapter Detection** | Batch (planned) | AI Command Panel | 📋 Chapters tab |

### Quick Reference: Panel Structure

Every batch feature tab in the AI Command Panel contains this standardized structure:

```text
[Tabs: Revision | Speaker | Merge]
────────────────────────────────
SCOPE: [number of segments] | ☐ Exclude Confirmed

AI CONFIGURATION:
  Provider: [Dropdown] | Model: [Dropdown] | Batch: [Size]

[FEATURE] SETTINGS:
  [Template/Configuration specific to feature]

[▶ Start Batch]

[When running: Progress bar, Pause/Stop, Results Summary grouped by confidence]
```

**For Developers:**

- See [AI Command Panel Specification](./ai-command-panel.md) for complete UX design, mockups, design rationale, and implementation reference
- See "Feature Module Structure" below for code organization

### Key Concepts for Implementation

**Element-Level vs. Batch:**

- **Element-Level (Text Revision only)**: Inline menu with quick templates. Best for single-segment refinement (✨ button on segment).
- **Batch-Level (Speaker, Merge, etc.)**: Command Panel with start/pause/resume. Best for processing 100+ segments consistently.

**Scope Filtering:**

- `Exclude Confirmed`: Prevents reprocessing of segments the user has manually reviewed and marked as correct
- "Confirmed" is a user-set status distinct from "Accept" (accepting an AI suggestion)

**Results Display:**

- **Command Panel**: Configuration, progress, brief summary grouped by confidence level (High/Medium/Low)
- **Transcript View**: All detailed suggestions inline with context (original/revised side-by-side, reasoning, accept/reject buttons per item)

**Navigation:**

- **Keyboard**: N (Next) | P (Previous) | A (Accept) | R (Reject) | ESC (Close panel) for sequential review
- **Mouse**: Click on summary item (e.g., "#045 0:45.2") to jump directly to that segment in Transcript

---

## Feature Module Structure

### Directory Layout

Each feature is a self-contained module with clear boundaries:

```text
/src/features/
├── chapters/                     # Chapter feature module
│   ├── components/               # UI components
│   │   ├── ChapterEditor.tsx     # Manual chapter editing
│   │   ├── ChapterList.tsx       # Display chapters
│   │   ├── ChapterTimeline.tsx   # Visual timeline
│   │   └── AIChapterPanel.tsx    # AI enhancement panel
│   ├── hooks/
│   │   ├── useChapters.ts        # Chapter state management
│   │   └── useAIChapters.ts      # AI-specific hooks
│   ├── services/
│   │   ├── chapterService.ts     # Core chapter operations
│   │   └── aiChapterService.ts   # AI enhancement layer
│   ├── types/
│   │   └── chapter.types.ts      # TypeScript definitions
│   ├── utils/
│   │   └── chapterUtils.ts       # Helper functions
│   ├── __tests__/                # Tests for this feature
│   └── index.ts                  # Public API
│
├── multi-track/                  # Multi-track merge module
│   ├── components/
│   │   ├── TrackLoader.tsx       # Load transcript tracks
│   │   ├── TrackComparison.tsx   # Side-by-side view
│   │   ├── SegmentSelector.tsx   # Manual selection
│   │   └── AITrackPanel.tsx      # AI recommendations
│   ├── hooks/
│   │   ├── useMultiTrack.ts      # Track state management
│   │   └── useAITrackMerge.ts    # AI-specific hooks
│   ├── services/
│   │   ├── trackService.ts       # Core track operations
│   │   ├── alignmentService.ts   # Time alignment
│   │   └── aiTrackService.ts     # AI enhancement layer
│   ├── types/
│   │   └── track.types.ts
│   ├── __tests__/
│   └── index.ts
│
├── segment-merge/                # Segment merge module
│   ├── components/
│   │   ├── MergePreview.tsx      # Preview merge result
│   │   └── AIMergePanel.tsx      # AI suggestions panel
│   ├── hooks/
│   │   ├── useMerge.ts           # Merge operations
│   │   └── useAIMerge.ts         # AI suggestions
│   ├── services/
│   │   ├── mergeService.ts       # Core merge logic
│   │   └── aiMergeService.ts     # AI enhancement
│   ├── types/
│   │   └── merge.types.ts
│   ├── __tests__/
│   └── index.ts
│
└── content-export/               # Content export module
    ├── components/
    │   ├── ExportPreview.tsx     # Manual export preview
    │   └── AITransformPanel.tsx  # AI transformations
    ├── hooks/
    │   └── useExport.ts
    ├── services/
    │   ├── exportService.ts      # Core export logic
    │   └── aiTransformService.ts # AI transformations
    ├── types/
    │   └── export.types.ts
    ├── __tests__/
    └── index.ts
```

### Manual-First Implementation Order

For each feature, implementation follows this order:

```text
Phase A: Manual Feature (Required First)
├── 1. Define types and data structures
├── 2. Implement core service (business logic)
├── 3. Create UI components
├── 4. Add hooks for state management
├── 5. Write tests
└── 6. Document usage

Phase B: AI Enhancement (Optional, After Phase A)
├── 1. Create AI service using shared AIFeatureService
├── 2. Add AI-specific UI components
├── 3. Add AI hooks
├── 4. Wire AI suggestions to manual operations
├── 5. Write AI-specific tests
└── 6. Document AI features
```

### Feature Public API

Each feature exports a clean public API:

```typescript
// /src/features/chapters/index.ts
export {
  // Components
  ChapterEditor,
  ChapterList,
  ChapterTimeline,
  AIChapterPanel,       // AI enhancement
  
  // Hooks
  useChapters,
  useAIChapters,        // AI enhancement
  
  // Types
  type Chapter,
  type ChapterMetadata,
  
  // Services (for advanced usage)
  chapterService,
  aiChapterService,     // AI enhancement
} from './internal';
```

### Lazy Loading Support

Feature modules can be lazily loaded:

```typescript
// Lazy load feature when needed
const ChaptersFeature = lazy(() => import('@/features/chapters'));
const MultiTrackFeature = lazy(() => import('@/features/multi-track'));

// Usage
<Suspense fallback={<Loading />}>
  <ChaptersFeature />
</Suspense>
```

---

## Common Architecture

### High-Level Flow

```text
┌─────────────────────────────────────────────────────────────┐
│                          USER                               │
│                    (via UI Components)                       │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│                   FEATURE MODULES                            │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐        │
│  │   Speaker    │ │  Transcript  │ │    Merge     │        │
│  │Classification│ │   Revision   │ │  Suggestion  │  ...   │
│  └──────┬───────┘ └──────┬───────┘ └──────┬───────┘        │
└─────────┼────────────────┼────────────────┼────────────────┘
          │                │                │
          └────────────────┼────────────────┘
                           ▼
┌─────────────────────────────────────────────────────────────┐
│                  UNIFIED AI SERVICE LAYER                    │
│  ┌────────────────────────────────────────────────────────┐ │
│  │ Prompt System   │ Response Parser  │ State Manager    │ │
│  │ Request Builder │ Error Handling   │ Progress Tracking│ │
│  └────────────────────────────────────────────────────────┘ │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│                    PROVIDER ADAPTERS                         │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐        │
│  │    OpenAI    │ │    Ollama    │ │  Anthropic   │  ...   │
│  │   Adapter    │ │   Adapter    │ │   Adapter    │        │
│  └──────┬───────┘ └──────┬───────┘ └──────┬───────┘        │
└─────────┼────────────────┼────────────────┼────────────────┘
          │                │                │
          └────────────────┼────────────────┘
                           ▼
┌─────────────────────────────────────────────────────────────┐
│                      AI PROVIDERS                            │
│         (OpenAI API, Ollama Local, Anthropic API)           │
└─────────────────────────────────────────────────────────────┘
```

---

## Core Concepts

### 1. Feature Types

All AI features fall into one of these categories:

#### Type A: Metadata Generation
- **Input:** Transcript segments
- **Output:** Structured metadata (labels, tags, IDs)
- **Examples:** Speaker Classification, Chapter Detection
- **Characteristics:** 
  - Returns non-text data
  - Applied to transcript structure
  - Reversible (can undo)

#### Type B: Text Transformation
- **Input:** Transcript text
- **Output:** Modified text
- **Examples:** Transcript Revision
- **Characteristics:**
  - Returns revised text
  - Replaces or augments original
  - Undoable with history

#### Type C: Structural Operations
- **Input:** Multiple segments/transcripts
- **Output:** Operation suggestions (merge, split, select)
- **Examples:** Segment Merge, Multi-Track Merge
- **Characteristics:**
  - Returns instructions, not data
  - User reviews and approves
  - Modifies transcript structure

#### Type D: Content Export
- **Input:** Full/partial transcript
- **Output:** Formatted document (summary, article, etc.)
- **Examples:** Content Transformation
- **Characteristics:**
  - Creates new artifact
  - Doesn't modify original
  - Various output formats

---

### 2. Common Patterns

#### Pattern: Single vs. Batch

**Single Processing**
- User selects one item (segment, chapter boundary, etc.)
- Immediate AI request
- Quick response and preview
- Used for: Quick revisions, spot checks

**Batch Processing**
- User selects multiple items or full transcript
- Sequential or parallel AI requests
- Progress tracking required
- Used for: Full transcript operations, bulk changes

**Parallel Batch Execution (Optional)**
- Controlled by global AI settings
- Uses ordered concurrency so batch logs and suggestions remain deterministic
- Features with cross-batch dependencies (e.g., chapter detection) remain sequential

#### Optional: Batch Coordinator (Responsiveness)

Some AI features can precompute work plans (e.g., batches) and then execute requests in parallel. To keep the UI responsive, use the optional batch coordinator which:
- Separates preparation from execution
- Yields to the main thread during both phases
- Emits results in input order for deterministic batch logs

**Core API (recommended for heavy batch jobs):**

```ts
import { runBatchCoordinator } from "@/lib/ai/core/batch";

await runBatchCoordinator({
  inputs,
  prepare: (input, index) => /* return prepared work or null */,
  execute: (prepared, index) => /* async work */,
  concurrency: 2,
  prepareYieldEvery: 50,
  emitYieldEvery: 50,
  onPrepared: (count, total) => {},
  onItemComplete: (index, result) => {},
  onItemError: (index, error) => {},
  onProgress: (processed, totalPrepared) => {},
});
```

Use this for batch features where long synchronous preparation or ordered emissions can otherwise block the UI.

#### Global AI Concurrency Settings

Batch AI requests can run in parallel with a bounded concurrency limit:

- Global toggle in **Settings → AI Providers → Global AI Settings**
- When enabled, AI batch requests run concurrently
- Logs and suggestions remain ordered
- Keep disabled for providers that rate-limit aggressively

Features with cross-batch dependencies (e.g., chapter detection) should stay sequential.

#### Pattern: Streaming vs. Complete

**Streaming Response**
- AI returns data incrementally (token by token)
- Real-time UI updates
- Used for: Long-form content (summaries, articles)
- Better UX for slow operations

**Complete Response**
- AI returns full result at once
- UI updates when complete
- Used for: Structured data (JSON), short responses
- Simpler to implement

#### Pattern: Suggestion vs. Direct Application

**Suggestion Mode**
- AI proposes changes
- User reviews in diff/preview
- Accept or reject
- Used for: Text revision, merge suggestions

**Direct Application**
- AI result applied immediately
- User can undo if needed
- Used for: Metadata generation, transformations

---

## Unified Service Architecture

### Core Service: `AIFeatureService` ✅ Implemented

The service provides a single entry point for all AI feature execution:

```typescript
// Execute a single feature
const result = await executeFeature<SpeakerSuggestion[]>(
  "speaker-classification",
  {
    speakers: "Alice, Bob, [SL]",
    segments: "[1] Hello there...",
  },
  { model: "gpt-4" }
);

if (result.success) {
  console.log(result.data);  // SpeakerSuggestion[]
  console.log(result.metadata.durationMs);
}

// Execute batch processing
const batchResult = await executeBatch<string>(
  "text-revision",
  [
    { text: "Um, hello there!", speaker: "Alice" },
    { text: "Yeah, so like...", speaker: "Bob" },
  ],
  { model: "gpt-4" },
  {
    onProgress: (done, total) => console.log(`${done}/${total}`),
    onItemComplete: (i, result) => console.log(`Item ${i} done`),
  }
);
```

### Feature Configuration ✅ Implemented

```typescript
export interface AIFeatureConfig {
  // Identity
  id: AIFeatureType;
  name: string;
  category: "metadata" | "text" | "structural" | "export";

  // Prompt templates (using Handlebars syntax)
  systemPrompt: string;
  userPromptTemplate: string;

  // Processing capabilities
  batchable: boolean;
  streamable: boolean;
  defaultBatchSize: number;

  // UI configuration
  shortcut?: string;
  icon?: string;
  requiresConfirmation: boolean;

  // Available variables for prompts
  availablePlaceholders: string[];

  // Response validation schema
  responseSchema?: SimpleSchema;

  // Opt-in structured envelope contract (see "Structured Batch Outcomes" below)
  responseFormat?: "structured-batch";
}
```

### Structured Batch Outcomes ✅ Implemented

Speaker classification, segment merge, and chapter detection opt into `responseFormat: "structured-batch"`.
All other features (text revision, multi-track merge, content transformation, chapter rewrite,
chapter metadata) keep the legacy plain-text or lenient-JSON response shape unchanged.

For opted-in features, `parseStructuredBatchResponse` (`client/src/lib/ai/parsing/structuredBatchResponse.ts`)
requires the model to return one of three exact envelopes instead of a bare array:

```json
// ok - one or more valid items
{ "status": "ok", "retryable": false, "data": [ /* ≥1 item */ ], "error": null }

// empty - the model explicitly found nothing to return
{ "status": "empty", "retryable": false, "data": [], "error": null }

// error - the model itself reports a failure
{ "status": "error", "retryable": true, "data": [], "error": { "code": "TEMPORARY_FAILURE", "message": "..." } }
```

`empty` is a **terminal successful outcome**: `executeFeature` returns `success: true, status: "empty"`,
and `executeBatch` counts it toward `summary.succeeded`, not `summary.failed`. It means the model
completed the task and correctly found no applicable result (e.g. no chapters in this batch) - it is
never used for "no output" or "couldn't parse".

The model reports exactly six stable error codes for `status: "error"`, each with fixed, non-negotiable
retryability (enforced by the parser, not by the model's own claim):

| Code | Retryable | Meaning |
| --- | --- | --- |
| `MISSING_REQUIRED_INPUT` | No | Required input (segments/speakers) is missing |
| `INVALID_INPUT_SHAPE` | No | The input could not be understood |
| `CONTRADICTORY_INPUT` | No | The input is contradictory |
| `UNSUPPORTED_TASK` | No | The requested operation cannot be performed |
| `OUTPUT_TRUNCATED` | Yes | The response would exceed the output limit |
| `TEMPORARY_FAILURE` | Yes | A transient failure prevented completion |

**Invalid structured output is never accepted through lenient recovery.** If the envelope is malformed,
missing required fields, has an unknown `status`, or the `data` items fail schema validation, the parser
returns a `SCHEMA_MISMATCH` (or `INVALID_JSON`/`EMPTY_RESPONSE`) failure with diagnostics. `executeFeature`
retries this like any other parse failure up to `parseRetryCount`, but on exhaustion it returns a plain
parser failure (`errorSource: "parser"`, `retryable: true`) - it does **not** fall back to
`tryLenientRecovery`. Legacy (non-structured-batch) features are the only ones that use lenient recovery.

`AIFeatureResult` exposes four fields specific to structured-batch features so callers can distinguish
outcomes without inferring meaning from array length or error strings:

- `status?: "ok" | "empty" | "error"`
- `retryable?: boolean`
- `errorSource?: "model" | "provider" | "parser"` - who reported the failure:
  - `"model"`: the model itself returned `status: "error"`; `retryable` reflects the fixed table above.
  - `"provider"`: the HTTP/network/auth layer failed before any envelope was received; `retryable` is
    derived from `isRetryableAIError` (see the provider retryability table below).
  - `"parser"`: the response could not be parsed/validated as a structured-batch envelope after all
    retries; always `retryable: true`.
- `parserFailure?: StructuredBatchParserFailure` - present when `errorSource === "parser"`; carries the
  parser failure `code`, `message`, and validation `diagnostics` for the exhausted parse attempt.

**Provider retryability** (`isRetryableAIError` in `client/src/lib/ai/core/errors.ts`) - only consulted
for `errorSource: "provider"` failures:

| `AIError.code` | Retryable | Notes |
| --- | --- | --- |
| `CONNECTION_ERROR` | Yes | Network interruption or timeout |
| `PROVIDER_ERROR` | Yes | Provider-side (5xx-class) failure |
| `RATE_LIMIT` | Yes | HTTP 429 |
| `PARSE_ERROR` | Yes | Malformed/truncated output surfaced as a provider-layer error |
| `VALIDATION_ERROR` | Yes | Schema-invalid output surfaced as a provider-layer error |
| `REQUEST_ERROR` | Yes, only if `details.statusCode` is 408 or 429 | Other 4xx statuses are not retryable |
| `AUTH_ERROR` | No | Authentication failure |
| `CONFIGURATION_ERROR` | No | Missing/invalid local configuration |
| `CANCELLED` | No | User cancellation |
| Any other/unclassified code | No | Treated conservatively as non-retryable |

**Current scope (Phase 1 + Phase 2 of the batch AI reliability design,** see
`docs/superpowers/specs/2026-07-25-batch-ai-reliability-design.md`**):** Phase 1 exposes the envelope,
`retryable`, and `errorSource` diagnostics described above. Phase 2 (Corrective Retries) is now
implemented and described below. Not yet implemented:

- **Phase 3 - Mandatory OpenAI Prompt Caching:** always-on `prompt_cache_key`/`prompt_cache_retention`
  for the built-in OpenAI provider.
- **Phase 4 - Selective XML Prompt Structure:** XML tags for long/ambiguous prompt sections only, on top
  of the Phase 1 envelope contract.

### Corrective Retries ✅ Implemented

For `responseFormat: "structured-batch"` features, `executeFeature`
(`client/src/lib/ai/core/aiFeatureService.ts`) retries a failed attempt in place of surfacing it,
subject to a shared retry budget. The decision is made per attempt:

| Origin | Condition | Retry? | Corrective message? |
| --- | --- | --- | --- |
| Parser | Envelope malformed/schema-invalid (`errorSource: "parser"`) | Yes, up to `parseRetryCount` | Yes |
| Model | `status: "error"` with `retryable: true` per the error-code table above | Yes, up to `parseRetryCount` | No |
| Provider | Provider/network failure with `retryable: true` per `isRetryableAIError` | Yes, up to `parseRetryCount` | No |
| Any origin | `retryable: false`, or `status: "ok"`/`"empty"` | Never | - |

The retry budget (`settings.parseRetryCount`, default 3) is **shared across all three causes** - it is
not a separate allowance per origin. An attempt sequence can mix a parser retry, then a model retry,
then a provider retry, and all three count against the same `maxRetries` ceiling.

Only parser-failure retries send a **corrective message**, built by
`client/src/lib/ai/core/correctiveRetry.ts`. It appends two messages to the original conversation
prefix: the model's invalid response (as an `assistant` turn) and a repair instruction (as a `user`
turn) naming the parser failure `code`, its message, and per-field diagnostics (path, message, and
expected value where available) - without leaking parser implementation details. Model and provider
retries resend the original message prefix unchanged, with no corrective content appended.

`RetryAttemptInfo` (passed to `options.onRetry`) carries two new fields describing the retry that just
happened:

- `retryCategory?: "parser" | "model" | "provider"` - which layer triggered this retry.
- `corrective?: boolean` - whether a corrective message was appended (`true` only when
  `retryCategory === "parser"`).

Both fields are additive and optional. Existing `onRetry` consumers (segment merge, chapter detection)
need no changes: they only read `attempt`, `errorMessage`, and `attemptDurationMs`, which are unchanged.

### Prompt System ✅ Implemented

Prompts use **Handlebars syntax** for variable interpolation:

```typescript
// System prompt (fixed)
const systemPrompt = `You are a professional transcript editor.

TASK: Clean up and improve the transcript text while preserving voice.

CORRECTIONS:
- Fix spelling and grammar errors
- Remove filler words (um, uh, like, you know)
- Fix punctuation
- Improve clarity

PRESERVE:
- Speaker's unique voice and style
- Technical terms and proper nouns
- Intentional informal language`;

// User prompt template (variables substituted at runtime)
const userPromptTemplate = `{{#if previousText}}
CONTEXT (previous segment): {{previousText}}
{{/if}}

TEXT TO REVISE:
{{text}}

{{#if nextText}}
CONTEXT (next segment): {{nextText}}
{{/if}}

Provide the corrected text:`;

// Compile template with variables
const compiled = compileTemplate(userPromptTemplate, {
  text: "Um, hello there!",
  previousText: "Welcome everyone.",
  nextText: "Today we'll discuss AI.",
});
```

### Response Parser ✅ Implemented

```typescript
// Parse with schema validation
const result = parseResponse<Chapter[]>(response, {
  schema: {
    type: "array",
    items: {
      type: "object",
      properties: {
        startTime: { type: "number" },
        title: { type: "string" },
        summary: { type: "string" },
      },
      required: ["startTime", "title"],
    },
  },
});

if (result.success) {
  console.log(result.data);       // Typed as Chapter[]
  console.log(result.metadata);   // Extraction method, warnings, etc.
} else {
  console.error(result.error);    // ParseError with details
}
```

---

## API Usage Guide

### Pattern 1: Simple Single Execution

**Use Case:** Quick revision of one segment

```typescript
import { executeFeature } from "@/lib/ai/core/aiFeatureService";

async function reviseSegment(text: string, speaker: string) {
  const result = await executeFeature<string>(
    "text-revision",
    {
      text,
      speaker,
    },
    {
      model: "gpt-4",
    }
  );

  if (result.success) {
    return result.data;  // Revised text
  } else {
    console.error("Revision failed:", result.error);
    return null;
  }
}
```

### Pattern 2: Batch Processing with Progress

**Use Case:** Revise 50 segments with progress tracking

**Note:** For UI-driven batch runs, always pass the selected `providerId` and `model` into the feature execution options so the user's configuration is honored.

```typescript
import { executeBatch } from "@/lib/ai/core/aiFeatureService";

async function reviseAllSegments(segments: Segment[]) {
  const inputs = segments.map(seg => ({
    text: seg.text,
    speaker: seg.speaker,
    previousText: seg.previous?.text,
    nextText: seg.next?.text,
  }));

  const result = await executeBatch<string>(
    "text-revision",
    inputs,
    { model: "gpt-4" },
    {
      onProgress: (processed, total) => {
        console.log(`Progress: ${processed}/${total}`);
        updateProgressBar(processed, total);
      },
      onItemComplete: (index, itemResult) => {
        if (itemResult.success) {
          updateSegmentInUI(index, itemResult.data);
        }
      },
      onItemError: (index, error) => {
        console.error(`Segment ${index} failed:`, error);
      },
    }
  );

  return result.results;
}
```

### Pattern 3: Speaker Classification

**Use Case:** Classify speakers for all segments

```typescript
import { executeFeature } from "@/lib/ai/core/aiFeatureService";

interface SpeakerSuggestion {
  tag: string;
  confidence: "high" | "medium" | "low";
  reason?: string;
}

async function classifySegmentSpeakers(
  segments: Segment[],
  availableSpeakers: string[]
) {
  // Format segments for the prompt
  const segmentsText = segments
    .map((s, i) => `[${i + 1}] [${s.currentSpeaker}]: "${s.text}"`)
    .join("\n");

  const result = await executeFeature<SpeakerSuggestion[]>(
    "speaker-classification",
    {
      segments: segmentsText,
      speakers: availableSpeakers.join(", "),
    },
    { model: "gpt-4" }
  );

  if (result.success) {
    // result.data is SpeakerSuggestion[]
    console.log(result.data);
    console.log(`Completed in ${result.metadata.durationMs}ms`);
    return result.data;
  }
}
```

### Pattern 4: Custom Prompt

**Use Case:** Use a custom prompt instead of default

```typescript
import { executeFeature } from "@/lib/ai/core/aiFeatureService";

async function reviseWithCustomPrompt(text: string) {
  const result = await executeFeature<string>(
    "text-revision",
    { text, speaker: "Alice" },
    {
      model: "gpt-4",
      customPrompt: {
        systemPrompt: `You are a grammar expert. Only fix grammar, \
preserve all other content exactly as-is.`,
        userPromptTemplate: `Fix grammar: {{text}}`,
      },
    }
  );

  return result.success ? result.data : null;
}
```

---

## Feature Implementation Structure

### Speaker Classification Example

Directory structure:

```
/src/lib/ai/features/speaker/
├── types.ts               # TypeScript interfaces
├── config.ts              # Feature config & prompts
├── service.ts             # AI service functions
├── utils.ts               # Pure helper functions
└── index.ts               # Public exports
```

**types.ts** - Define data structures:

```typescript
export interface SpeakerSuggestion {
  tag: string;
  confidence: "high" | "medium" | "low";
  reason?: string;
}

export interface SpeakerClassificationInput {
  speakers: string;
  segments: string;
}

export interface SpeakerClassificationOutput {
  suggestions: SpeakerSuggestion[];
  summary: string;
}
```

**config.ts** - Define prompts and feature configuration:

```typescript
export const SPEAKER_SYSTEM_PROMPT = `You are an expert at analyzing transcripts...`;

export const SPEAKER_USER_PROMPT_TEMPLATE = `Available speakers: {{speakers}}

Segments to classify:
{{segments}}

Provide suggestions in JSON format...`;

export const speakerClassificationConfig: AIFeatureConfig = {
  id: "speaker-classification",
  name: "Speaker Classification",
  category: "metadata",
  
  systemPrompt: SPEAKER_SYSTEM_PROMPT,
  userPromptTemplate: SPEAKER_USER_PROMPT_TEMPLATE,
  
  batchable: true,
  streamable: false,
  defaultBatchSize: 15,
  
  requiresConfirmation: true,
  availablePlaceholders: ["speakers", "segments"],
  
  responseSchema: {
    type: "array",
    items: {
      type: "object",
      properties: {
        tag: { type: "string" },
        confidence: { 
          type: "string", 
          enum: ["high", "medium", "low"]
        },
      },
      required: ["tag"],
    },
  },
};
```

**service.ts** - Implement AI operations:

```typescript
import { executeFeature } from "@/lib/ai/core/aiFeatureService";
import {
  SPEAKER_SYSTEM_PROMPT,
  SPEAKER_USER_PROMPT_TEMPLATE,
} from "./config";

export async function classifySpeakers(
  segments: Segment[],
  availableSpeakers: string[],
  options: AIFeatureOptions = {}
): Promise<AIFeatureResult<SpeakerSuggestion[]>> {
  // Format segments for prompt
  const segmentsText = segments
    .map((s, i) => `[${i + 1}] [${s.speaker}]: "${s.text}"`)
    .join("\n");

  return executeFeature<SpeakerSuggestion[]>(
    "speaker-classification",
    {
      speakers: availableSpeakers.join(", "),
      segments: segmentsText,
    },
    {
      customPrompt: {
        systemPrompt: SPEAKER_SYSTEM_PROMPT,
        userPromptTemplate: SPEAKER_USER_PROMPT_TEMPLATE,
      },
      ...options,
    }
  );
}
```

**utils.ts** - Pure helper functions:

```typescript
export function normalizeSpeakerTag(tag: string): string {
  return tag.toUpperCase().replace(/\s+/g, "_");
}

export function resolveSuggestedSpeaker(
  suggestion: SpeakerSuggestion,
  currentSpeaker: string
): string {
  return suggestion.confidence === "high" ? suggestion.tag : currentSpeaker;
}

export function formatSegmentsForPrompt(segments: Segment[]): string {
  return segments
    .map((s, i) => `[${i + 1}] [${s.speaker}]: "${s.text}"`)
    .join("\n");
}
```

**index.ts** - Public API:

```typescript
export { classifySpeakers } from "./service";
export { SPEAKER_SYSTEM_PROMPT, SPEAKER_USER_PROMPT_TEMPLATE } from "./config";
export type { SpeakerSuggestion, SpeakerClassificationInput } from "./types";
```

---

## Revision Feature Example

### Text Revision Pattern

Directory structure (same as speaker):

```
/src/lib/ai/features/revision/
├── types.ts
├── config.ts
├── service.ts
├── utils.ts
└── index.ts
```

**config.ts** - Multiple prompts for different operations:

```typescript
// Cleanup prompt
export const REVISION_CLEANUP_SYSTEM_PROMPT = `You are a professional \
transcript editor. Fix spelling, grammar, remove fillers, improve clarity.`;


  // Extract structured data
  extractJSON(response: string): any;

  // Validate response
  validate<TOutput>(
    parsed: TOutput,
    schema: JSONSchema
  ): ValidationResult;

  // Handle parse errors
  handleParseError(
    error: Error,
    rawResponse: string
  ): ParsedResult | null;
}
```

---

## Implementation Strategy

### Phase 1: Core Infrastructure ✅
**Status:** Completed (Revision & Speaker Classification)

**Components:**
- Provider adapter system
- Basic prompt system
- Settings UI for AI providers
- Error handling and retry logic

**What's Working:**
- OpenAI and Ollama integration
- Custom prompts (for revision)
- Batch processing (basic)
- Progress tracking

---

### Phase 2: Unified Service Layer 🔄
**Status:** Next Priority

**Goals:**
- Extract common code from existing features
- Create `AIFeatureService` as single entry point
- Unified prompt management
- Standardized response parsing

**Tasks:**
1. Create `src/lib/services/aiFeatureService.ts`
2. Define feature registry
3. Integrate Speaker Classification into service
4. Integrate Transcript Revision into service
5. Create feature configuration system

**Deliverables:**
- `AIFeatureService` with type-safe API
- Feature configuration registry
- Unified prompt templates
- Response parsing utilities

**Estimated Time:** 2 weeks

---

### Phase 3: Segment Merge Suggestions 📋
**Status:** Planned

**Dependencies:** Phase 2 complete
**Prerequisite:** ✅ Manual merge already exists (select segments → merge action)

**Tasks:**
1. Define merge suggestion data schema
2. Create prompt template for merge analysis
3. Implement response parser for merge suggestions
4. Build UI components:
   - AI analysis panel
   - Merge preview (reuse existing)
   - Accept/reject controls
5. Integrate with transcript state
6. Add merge operation to history/undo

**Key Challenges:**
- Defining "merge confidence" algorithm
- Handling edge cases (large time gaps, speaker changes)
- Performance for large transcripts

**Estimated Time:** 3 weeks

---

### Phase 4: Chapter Feature 📋

**Status:** Planned (Blocked on Phase 2)

**Phase 4A: Manual Chapter Feature (Required First)**

**Tasks:**
1. Define chapter data structure
2. Implement chapter CRUD operations
3. Build UI components:
   - Chapter list/overview
   - Chapter editor (title, summary, time range)
   - Timeline visualization with chapter markers
   - Chapter navigation (jump to chapter)
4. Integrate with transcript store
5. Add export formats (YouTube, Markdown)

**Deliverables:**
- Users can manually create/edit/delete chapters
- Chapters displayed in transcript view
- Chapter-based navigation

**Estimated Time:** 2-3 weeks

**Phase 4B: AI Chapter Detection (Enhancement)**

**Tasks:**
1. Create AI prompt for chapter boundary detection
2. Implement response parser for chapters
3. Add AI-specific UI:
   - "Detect Chapters" button
   - Granularity selector
   - Review/edit detected chapters
4. Wire AI suggestions to manual chapter operations

**Estimated Time:** 2 weeks

**Total Phase 4:** 4-5 weeks

---

### Phase 5: Multi-Track Merge Feature 📋
**Status:** Planned

**Dependencies:** Phase 2 complete

> ⚠️ **Manual-First:** This phase has TWO sub-phases!

**Phase 5A: Manual Multi-Track Feature (Required First)**

**Tasks:**
1. Create multi-transcript data model
2. Implement track loading/management
3. Build time alignment algorithm
4. Build UI components:
   - Track loader (add/remove tracks)
   - Side-by-side comparison view
   - Manual segment selection (click to choose)
   - Merge progress/preview
5. Implement merge algorithm (combine selected segments)

**Deliverables:**
- Users can load 2+ transcripts
- Side-by-side view with time sync
- Manual selection of best segments
- Merge into single transcript

**Estimated Time:** 3-4 weeks

**Phase 5B: AI Track Merge Suggestions (Enhancement)**

**Tasks:**
1. Create AI prompt for quality assessment
2. Create AI prompt for primary speaker detection
3. Build UI for AI recommendations:
   - Quality indicators per segment
   - "Auto-select best" option
   - Accept AI suggestions
4. Wire AI suggestions to manual selection

**Estimated Time:** 2-3 weeks

**Total Phase 5:** 5-7 weeks

---

### Phase 6: Content Transformation 📋
**Status:** Planned

**Dependencies:** Phase 2 complete

> ⚠️ **Manual-First:** Basic export templates first, AI transformations second.

**Phase 6A: Manual Export Templates (Required First)**

**Tasks:**
1. Define export template structure
2. Build basic export formats:
   - Plain text (cleaned)
   - Markdown with speakers
   - Simple summary template
3. Export preview and editing

**Estimated Time:** 1-2 weeks

**Phase 6B: AI Content Transformation (Enhancement)**

**Tasks:**
1. Define transformation types
2. Create prompt templates for each type
3. Implement streaming for long outputs
4. Build AI-specific UI:
   - Transformation type selector
   - Options configuration
   - AI results viewer
5. Add export format handlers

**Estimated Time:** 3-4 weeks

**Total Phase 6:** 4-6 weeks

---

## Shared Components

### UI Components (Reusable)

```
/src/components/ai/
├── AIFeaturePanel.tsx           # Generic feature panel wrapper
├── AIProgressIndicator.tsx      # Progress bar with status
├── AIResultsViewer.tsx          # Generic results display
├── AIBatchControls.tsx          # Batch operation controls
├── AIDiffViewer.tsx             # Text comparison (for revision)
├── AIConfidenceIndicator.tsx    # Visual confidence badges
└── AIErrorMessage.tsx           # Error display with retry
```

### State Management

```typescript
// Zustand store for AI features
interface AIFeatureStore {
  // Active operations
  activeOperations: Map<string, AIOperation>;
  
  // Results cache
  results: Map<string, AIFeatureResult<any>>;
  
  // Settings
  defaultProvider: string;
  defaultModel: string;
  
  // Actions
  startOperation: (id: string, feature: AIFeatureType) => void;
  updateProgress: (id: string, progress: number) => void;
  completeOperation: (id: string, result: any) => void;
  cancelOperation: (id: string) => void;
  
  // Results
  cacheResult: (key: string, result: any) => void;
  getResult: (key: string) => any | null;
  clearResult: (key: string) => void;
}
```

---

## Data Flow Examples

### Example 1: Segment Merge Suggestion

```
1. User Action
   └─> Click "AI Merge Analysis" button
   └─> Select scope (filtered segments)

2. UI Component (MergeAnalysisPanel)
   └─> Collect options (max time gap, confidence threshold)
   └─> Call AIFeatureService.executeFeature()

3. AIFeatureService
   └─> Load feature config (segment-merge)
   └─> Build prompt with segment data
   └─> Call provider adapter

4. Provider Adapter (OpenAI)
   └─> Format request for OpenAI API
   └─> Send HTTP request
   └─> Return raw response

5. Response Parser
   └─> Parse JSON from response
   └─> Validate against schema
   └─> Return typed MergeSuggestion[]

6. AIFeatureService
   └─> Cache result
   └─> Return to UI component

7. UI Component
   └─> Update state with suggestions
   └─> Render MergeSuggestionsList

8. User Review
   └─> User accepts/rejects each suggestion
   └─> UI applies merges to transcript store
```

---

### Example 2: Chapter Detection (Streaming)

```
1. User Action
   └─> Click "Detect Chapters"
   └─> Select granularity (medium)

2. UI Component (ChapterDetectionPanel)
   └─> Call AIFeatureService.executeStreaming()

3. AIFeatureService
   └─> Chunk transcript (if needed)
   └─> Build prompt for each chunk
   └─> For each chunk:
       └─> Call provider with onChunk callback

4. Provider Adapter (Streaming)
   └─> Open SSE connection
   └─> For each chunk received:
       └─> Parse delta
       └─> Call onChunk callback

5. UI Component (onChunk callback)
   └─> Append chunk to buffer
   └─> Update progress indicator
   └─> Try to parse partial JSON

6. Complete
   └─> Parse final JSON
   └─> Validate chapters
   └─> Render ChapterTimeline
```

---

## Prompt Template System

### Template Variables

All prompts have access to these variables:

```typescript
interface PromptVariables {
  // Segment data
  text: string;
  speaker: string;
  confidence: number;
  timestamp: string;
  
  // Context
  previousSegments: Segment[];
  nextSegments: Segment[];
  
  // Transcript metadata
  transcriptTitle: string;
  transcriptDuration: number;
  totalSegments: number;
  
  // Feature-specific
  [key: string]: any;
}
```

### Template Examples

**Transcript Revision:**
```
System: You are editing a transcript. Fix spelling, grammar, and remove filler words while preserving meaning and speaker voice.

User: Revise this transcript segment:
Speaker: {{speaker}}
Text: {{text}}

Provide only the revised text, no explanation.
```

**Segment Merge:**
```
System: You analyze transcript segments to identify merge candidates. Suggest merging segments only when they clearly belong together (same speaker, incomplete sentence, short time gap).

User: Analyze these consecutive segments:

{{#each segments}}
Segment {{index}}: [{{speaker}}] "{{text}}" ({{start}} - {{end}})
{{/each}}

Respond with the structured-batch envelope (see "Structured Batch Outcomes" above), with each merge
suggestion under `data`:
{
  "status": "ok",
  "retryable": false,
  "data": [
    {
      "segmentIds": [1, 2],
      "confidence": 0.95,
      "reason": "Incomplete sentence continues in next segment"
    }
  ],
  "error": null
}
```

**Chapter Detection:**
```
System: You analyze transcripts to identify natural chapter boundaries. Consider topic shifts, speaker changes, and content structure. Generate descriptive titles and summaries for each chapter.

User: Analyze this transcript and identify chapters:

Duration: {{duration}}
Segments: {{segmentCount}}
Granularity: {{granularity}}

{{transcriptText}}

Respond with the structured-batch envelope (see "Structured Batch Outcomes" above), with each chapter
under `data` as a flat item (`start`/`end` are segment IDs, not timestamps):
{
  "status": "ok",
  "retryable": false,
  "data": [
    {
      "title": "Introduction",
      "summary": "The speaker welcomes attendees and outlines the agenda.",
      "tags": ["intro"],
      "start": 1,
      "end": 3
    }
  ],
  "error": null
}
```

---

## Error Handling Strategy

### Error Categories

1. **Network Errors**
   - Timeout
   - Connection refused
   - DNS failure
   - **Strategy:** Retry with exponential backoff

2. **API Errors**
   - Rate limit exceeded
   - Invalid API key
   - Model not available
   - **Strategy:** Show error, suggest alternative provider/model

3. **Parsing Errors**
   - Invalid JSON
   - Schema mismatch
   - Incomplete response
   - **Strategy:** Attempt recovery, show warning, allow manual edit
   - **Exception:** structured-batch features (speaker classification, segment merge, chapter
     detection) never attempt lenient recovery for invalid output - see
     "Structured Batch Outcomes" above.

4. **Validation Errors**
   - Output doesn't match schema
   - Missing required fields
   - Invalid data types
   - **Strategy:** Use defaults, show warning, allow retry

### Error Recovery

```typescript
interface ErrorRecoveryStrategy {
  // Determine if error is recoverable
  isRecoverable(error: Error): boolean;

  // Attempt recovery
  recover(
    error: Error,
    context: FeatureContext
  ): Promise<RecoveryResult>;

  // Get user-facing message
  getUserMessage(error: Error): string;

  // Get suggested action
  getSuggestedAction(error: Error): Action | null;
}
```

### User-Facing Errors

Provider-related errors are normalized into compact, user-facing messages:

- `AIAuthError`: Authentication failed. Check your API key.
- `AIRateLimitError`: Rate limit hit. Please wait and try again.
- `AIRequestError`: Request rejected. Check model and parameters.
- `AIProviderUnavailableError`: Provider error. Please try again later.
- `AIConnectionError`: Connection failed. Check your network and base URL.

**Hard errors and toasts**

If an AI request fails with one of the provider error codes above, the UI raises a destructive toast
in addition to the inline error message so critical failures are visible immediately.

**Request timeout**

Global AI settings include a request timeout (default: 30 seconds). Set it to 0 to disable.

**Batch log responses**

Revision batch logs capture the response payload for failed requests. If a provider error returns
only a message, that message is stored as the response payload so it is visible in the log.

---

## Testing Strategy

### Unit Tests

**For each feature:**
- Prompt building with various inputs
- Response parsing (happy path)
- Response parsing (malformed input)
- Error handling
- Validation logic

**Shared services:**
- Provider adapters (mocked APIs)
- Response parsers
- State management

### Integration Tests

**Feature workflows:**
- Single segment revision
- Batch processing
- Streaming responses
- Cancel operations
- Retry on failure

### E2E Tests

**User scenarios:**
- Complete revision workflow
- Chapter detection on real transcript
- Multi-track merge simulation
- Content transformation variations

---

## Performance Considerations

### Optimization Strategies

1. **Batching**
   - Combine multiple small requests when possible
   - Trade-off: Latency vs. throughput

2. **Caching**
   - Cache AI results keyed by input hash
   - Invalidate on prompt change
   - Store in IndexedDB for persistence

3. **Parallel Processing**
   - Process independent requests in parallel
   - Limit concurrency to avoid rate limits

4. **Chunking**
   - Split very long transcripts into chunks
   - Process chunks separately
   - Combine results

5. **Progressive Enhancement**
   - Show partial results as they arrive
   - Streaming for long outputs
   - Interruptible operations

### Performance Targets

| Operation | Target | Notes |
|-----------|--------|-------|
| Single segment revision | < 3s | 95th percentile |
| Batch 10 segments | < 15s | Sequential processing |
| Chapter detection (1h) | < 60s | With chunking |
| Multi-track merge (2 tracks) | < 30s | Analysis only |
| Full transcript summary | < 45s | Streaming enabled |

---

## Security & Privacy

### Data Handling

1. **Audio files never sent** to AI providers
2. **Transcript text** sent only for selected features
3. **Metadata** (timestamps, IDs) included only when necessary
4. **User can choose provider** (local Ollama for privacy)

### Settings

```typescript
interface PrivacySettings {
  // Provider preference
  preferLocalProvider: boolean;
  
  // Data sending
  includeTimestamps: boolean;
  includeSpeakerLabels: boolean;
  includeConfidenceScores: boolean;
  
  // Caching
  cacheResults: boolean;
  cacheExpiryDays: number;
  
  // Telemetry
  allowAnonymousUsageStats: boolean;
}
```

---

## Configuration & Extensibility

### Adding New Feature

1. **Define feature config:**
```typescript
const newFeatureConfig: AIFeatureConfig = {
  id: 'my-new-feature',
  name: 'My New Feature',
  type: 'metadata',
  systemPrompt: '...',
  userPromptTemplate: '...',
  // ...
};
```

2. **Register feature:**
```typescript
aiFeatureService.registerFeature(newFeatureConfig);
```

3. **Create UI component:**
```tsx
<AIFeaturePanel
  feature="my-new-feature"
  onComplete={handleComplete}
/>
```

4. **Done!** Service layer handles the rest.

---

---

## Open Questions & Decisions Needed

### Q1: Prompt Versioning
**Question:** How do we handle prompt updates without breaking existing results?

**Options:**
- A: Version prompts (v1, v2), allow users to choose
- B: Always use latest, cache invalidation on change
- C: Store prompt with result for reproducibility

**Recommendation:** B for simplicity, C for power users

---

### Q2: Long Transcript Handling
**Question:** How do we handle transcripts that exceed token limits?

**Options:**
- A: Automatic chunking with context overlap
- B: Summarize first, then analyze summary
- C: User selects sections manually

**Recommendation:** A + C (automatic with manual override)

---

### Q3: Result Storage
**Question:** Should we persist AI results between sessions?

**Options:**
- A: Store in IndexedDB (persistent)
- B: Memory only (cleared on reload)
- C: User choice in settings

**Recommendation:** C (default to A for convenience)

---

## Developer APIs & Patterns

### 1. Logging Service

**Purpose:** Centralized logging for all AI features with feature-specific debug modes.

**Implementation:** Uses `loglevel` library (~1.5KB, 50M+ downloads/month)

**Basic Usage:**
```typescript
import { createLogger } from "@/lib/ai/logging";

const logger = createLogger({ feature: "SegmentMerge" });
logger.info("Starting analysis");
logger.warn("Warning message");
logger.debug("Debug info"); // Only if debug enabled
logger.error("Error occurred");
```

**Debug Control:**
```typescript
import { 
  enableFeatureDebug, 
  enableGlobalDebug,
  setGlobalLogLevel 
} from "@/lib/ai/logging";

// Enable debug for specific feature
enableFeatureDebug("SegmentMerge");

// Or globally
enableGlobalDebug();

// Or set log level
setGlobalLogLevel("debug");  // "debug", "info", "warn", "error"

// Browser console also works:
// __AISegmentMergeDebug = true;    // Feature-specific
// __AIDebugMode = true;             // Global
```

**Location:** `/src/lib/ai/logging/loggingService.ts`

---

### 1.1 Batch Log Payload Capture

Batch-capable features should include request/response payloads in their batch log entries to make parse failures actionable in the UI. For each batch, capture the compiled system + user prompt as `requestPayload` and the raw provider response as `responsePayload` when available. This enables operators to inspect exactly what was sent and received without turning on full debug logging.

---

### 2. Recovery Strategies (Strategy Pattern)

**Purpose:** Handle malformed AI responses with fallback mechanisms.

**Usage:**
```typescript
import { 
  createStandardStrategies, 
  applyRecoveryStrategies 
} from "@/lib/ai/parsing";

// Create standard strategies
const strategies = createStandardStrategies(
  yourSchema,
  (item): item is YourType => {
    // Type guard
    return item && typeof item === "object" && "requiredField" in item;
  }
);

// Apply to raw response
const result = applyRecoveryStrategies(rawResponse, strategies);

if (result.data) {
  console.log(`Data recovered using: ${result.usedStrategy}`);
  // Process recovered data
}
```

**Available Strategies:**
- `lenientParseStrategy(schema)` - Tolerant JSON parsing with schema validation
- `partialArrayStrategy(typeGuard)` - Extract valid items from malformed arrays
- `jsonSubstringStrategy()` - Find and parse JSON substrings in text

**Creating Custom Strategies:**
```typescript
import { RecoveryStrategy } from "@/lib/ai/parsing";

const myStrategy: RecoveryStrategy<MyType> = {
  name: "my-strategy",
  attempt: (rawResponse: string): MyType[] | null => {
    try {
      // Custom parsing logic
      const data = parseMyFormat(rawResponse);
      return data.isValid ? data.items : null;
    } catch {
      return null;  // Strategy failed, try next
    }
  },
};
```

**Location:** `/src/lib/ai/parsing/recoveryStrategies.ts`

---

### 3. Validation Rules (Rule Pattern)

**Purpose:** Flexible, reusable validation logic.

**Basic Usage:**
```typescript
import { 
  validateWithRules, 
  mergeValidationRules,
  hasValidationErrors,
  createRule 
} from "@/lib/ai/features/segmentMerge/validation";

// Validate with standard rules
const issues = validateWithRules(segments, mergeValidationRules);

if (hasValidationErrors(issues)) {
  // Handle errors (level: "error")
  const errorMessages = issues
    .filter(i => i.level === "error")
    .map(i => i.message);
}
```

**Creating Custom Rules:**
```typescript
// Single rule
const maxSegmentsRule = createRule(
  (segments) => segments.length <= 1000,
  { 
    level: "warn", 
    message: "More than 1000 segments may impact performance" 
  }
);

// Multiple rules
const customRules = [
  createRule(
    (data) => data.length > 0,
    { level: "error", message: "No data provided" }
  ),
  createRule(
    (data) => data.every(item => isValid(item)),
    { level: "error", message: "Invalid items in data" }
  ),
  createRule(
    (data) => data.length < 100,
    { level: "warn", message: "Large dataset" }
  ),
];

const issues = validateWithRules(data, customRules);
```

**Location:** `/src/lib/ai/features/segmentMerge/validation.ts`

---

### 4. Response Processor

**Purpose:** Handle AI response extraction, recovery, and normalization.

**Usage:**
```typescript
import { processAIResponse } from "@/lib/ai/features/segmentMerge/responseProcessor";

const result = await executeFeature("segment-merge", variables, options);

const processed = processAIResponse(result, {
  idMapping: context.mapping,  // For ID normalization
});

if (processed.suggestions.length > 0) {
  console.log(`Got ${processed.suggestions.length} suggestions`);
  
  if (processed.recoveryStrategy) {
    logger.warn(`Data recovered using: ${processed.recoveryStrategy}`);
  }
}

// Handle issues
processed.issues.forEach(issue => {
  if (issue.level === "error") {
    handleError(issue.message);
  } else {
    handleWarning(issue.message);
  }
});
```

**Location:** `/src/lib/ai/features/segmentMerge/responseProcessor.ts`

---

### 5. Prompt Builder

**Purpose:** Separate prompt construction from AI execution logic.

**Usage:**
```typescript
import { buildMergePrompt, hasEligiblePairs } from "@/lib/ai/features/segmentMerge/promptBuilder";

// Build prompt with all variables and metadata
const prompt = buildMergePrompt({
  segments,
  maxTimeGap: 2.0,
  sameSpeakerOnly: true,
  enableSmoothing: "true",
  idContext,  // From createSimpleIdContext()
});

// Check if we have work to do
if (!hasEligiblePairs(prompt)) {
  return { suggestions: [], summary: { /* ... */ }, issues: [] };
}

// Execute with built prompt
const result = await executeFeature(
  "segment-merge",
  prompt.variables,
  {
    customPrompt: {
      systemPrompt: prompt.systemPrompt,
      userPromptTemplate: prompt.userTemplate,
    },
    signal,
  }
);
```

**Location:** `/src/lib/ai/features/segmentMerge/promptBuilder.ts`

---

## Applying Patterns to New Features

When implementing a new AI feature, use these patterns:

### 1. **Recovery Strategies**
```typescript
const strategies = createStandardStrategies(yourSchema, typeGuard);
const recovered = applyRecoveryStrategies(rawResponse, strategies);
```

### 2. **Validation Rules**
```typescript
const issues = validateWithRules(input, yourValidationRules);
if (hasValidationErrors(issues)) return earlyExit();
```

### 3. **Logging**
```typescript
const logger = createLogger({ feature: "YourFeature" });
logger.info("Starting...");
logger.debug("Details...");
```

### 4. **Response Processing**
```typescript
const processed = processAIResponse(result, { idMapping });
if (processed.suggestions.length === 0) handleEmpty();
```

### 5. **Prompt Building**
```typescript
const prompt = buildPrompt({ /* ... */ });
if (!hasEligiblePairs(prompt)) return early();
const result = await executeFeature("your-feature", prompt.variables, {...});
```

---

## Success Metrics


### Feature Adoption
- % of users who try each feature
- Features per session (average)
- Return usage rate (within 7 days)

### Quality Metrics
- Acceptance rate (suggestions accepted vs. rejected)
- Edit rate (results edited after generation)
- Undo rate (results undone)

### Performance Metrics
- Average response time per feature
- Error rate per provider
- Retry rate

### User Satisfaction
- Feature ratings (in-app feedback)
- Support tickets per feature
- User interviews (qualitative)

---

## Roadmap Summary

### Completed ✅

**Phase 1:** Core Infrastructure
- Complete unified AI service layer
- Speaker Classification feature (ready for production)
- Text Revision feature (ready for production)
- 750+ tests, 80%+ coverage on core utilities

**Phase 2:** Service Layer
- Unified API adoption across features
- 900+ lines of old code removed
- All deprecated aliases cleaned up
- Documentation complete

**Phase 2B:** Segment Merge Refactoring (Just Completed!)
- ✅ Response Recovery extraction (Strategy Pattern)
- ✅ Validation Rules extraction (Rule Pattern)
- ✅ Response Processor module (separate concerns)
- ✅ Prompt Builder module (reusable pattern)
- ✅ Logging Service (feature-specific debug control)
- ✅ 280+ new unit tests
- ✅ Developer APIs documented
- ✅ Service reduced by 37% (301 → 181 lines)

### Next 🎯

**Phase 3:** Apply Refactoring Patterns to Other Features (~2-3 weeks)
- Extract Recovery/Validation/Response Processing for Speaker Classification
- Extract Recovery/Validation/Response Processing for Text Revision
- Unify patterns across all AI features

**Phase 4:** Segment Merge Suggestions (~3 weeks)
- Uses unified service with existing manual merge

**Phase 4:** Chapter Feature (~4-5 weeks)
- Phase 4A: Manual chapters (2-3 weeks) ← Foundation first!
- Phase 4B: AI chapter detection (2 weeks)

**Phase 5:** Multi-Track Merge (~5-7 weeks)
- Phase 5A: Manual multi-track (3-4 weeks) ← Foundation first!
- Phase 5B: AI track suggestions (2-3 weeks)

**Phase 6:** Content Transformation (~4-6 weeks)
- Phase 6A: Manual export templates (1-2 weeks)
- Phase 6B: AI transformations (3-4 weeks)

---

*Last Updated: January 4, 2026*
*Next Review: January 11, 2026*
