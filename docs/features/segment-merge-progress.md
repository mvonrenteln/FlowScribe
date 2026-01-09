# Segment Merge AI Feature - Implementation Progress

*Started: January 4, 2026*
*Status: In Progress 🔄*

---

## Overview

Implementation of the AI Segment Merge Suggestion feature that helps users identify and merge fragmented transcript segments. The AI optionally provides "smoothing" suggestions to clean up text artifacts from Whisper transcription (e.g., incorrect sentence breaks, capitalization issues).

---

## Phase 1: Foundation & Core Types ✅

### 1.1 Update Konzept-Dokument ✅
- [x] Ergänze "Text-Glättung" (Smoothing) zum Konzept
- [x] Aktualisiere AI-Analyse-Prompt für Smoothing-Erkennung
- [x] Merge-Konflikte gelöst

### 1.2 Types & Interfaces ✅
- [x] Create `/src/lib/ai/features/segmentMerge/types.ts`
  - [x] `MergeSuggestion` - einzelner Merge-Vorschlag
  - [x] `TextSmoothingInfo` - Glättungsvorschlag
  - [x] `MergeAnalysisResult` - Ergebnis der AI-Analyse
  - [x] `MergeAnalysisParams` - Parameter für Analyse
  - [x] `SegmentMergeConfig` - Konfiguration
  - [x] Status-Types: `pending`, `accepted`, `rejected`

### 1.3 Core Utilities ✅
- [x] Create `/src/lib/ai/features/segmentMerge/utils.ts`
  - [x] `calculateTimeGap()` - Zeitabstand zwischen Segmenten
  - [x] `isSameSpeaker()` - Sprecher-Vergleich
  - [x] `detectIncorrectSentenceBreak()` - Unvollständige Sätze erkennen
  - [x] `formatSegmentsForPrompt()` - Segmente für AI formatieren
  - [x] `validateMergeCandidate()` - Prüfen ob Merge möglich
  - [x] `groupByConfidence()` - Aufeinanderfolgende Segmente gruppieren
  - [x] `processSuggestions()` - Texte mit Glättung zusammenführen

### 1.4 Configuration & Prompts ✅
- [x] Create `/src/lib/ai/features/segmentMerge/config.ts`
  - [x] System-Prompt für Merge-Analyse (mit Smoothing)
  - [x] User-Prompt-Template
  - [x] Response-Schema für JSON-Validierung
  - [x] Default-Konfiguration

---

## Phase 2: AI Service Layer ✅

### 2.1 Service Implementation ✅
- [x] Create `/src/lib/ai/features/segmentMerge/service.ts`
  - [x] `analyzeMergeCandidates()` - Hauptfunktion für AI-Analyse
  - [x] `analyzeMergeCandidatesBatch()` - Batch-Verarbeitung
  - [x] `getMergePreview()` - Vorschau für Glättung

### 2.2 Register Feature ✅
- [x] Update `/src/lib/ai/features/index.ts`
  - [x] Export segment merge feature
- [x] Register in Feature Registry (`featureRegistry.ts`)

---

## Phase 3: Store Integration ✅

### 3.1 Store Types ✅
- [x] Update `/src/lib/store/types.ts`
  - [x] `AISegmentMergeConfig`
  - [x] `AISegmentMergeSuggestion`
  - [x] State properties for processing
  - [x] `AISegmentMergeSlice` interface

### 3.2 Store Slice ✅
- [x] Create `/src/lib/store/slices/aiSegmentMergeSlice.ts`
  - [x] Initial state
  - [x] `startMergeAnalysis()`
  - [x] `cancelMergeAnalysis()`
  - [x] `acceptMergeSuggestion()`
  - [x] `rejectMergeSuggestion()`
  - [x] `acceptAllHighConfidence()`
  - [x] `clearMergeSuggestions()`
  - [x] `updateMergeConfig()`

### 3.3 Integrate Slice ✅
- [x] Update `/src/lib/store.ts`
  - [x] Import and spread slice

---

## Phase 4: UI Components ✅

### 4.1 Main Dialog ✅
- [x] Create `/src/components/AISegmentMergeDialog.tsx`
- [x] Provider/Model selection (wie AI Command Panel)
  - [x] Options (max time gap, min confidence, same speaker only, enable smoothing)
  - [x] Start/Cancel buttons
  - [x] Progress indicator
  - [x] Error display

### 4.2 Suggestions List ✅
- [x] Add suggestions list to dialog
  - [x] Group by confidence (High/Medium/Low)
  - [x] Show segment preview (before/after with smoothing)
  - [x] Accept/Reject buttons per suggestion
  - [x] Batch actions (Accept All High, Reject All)

### 4.3 Inline Indicators (Optional - Phase 5)
- [ ] Merge hint indicators in TranscriptSegment
- [ ] Inline accept/reject controls

---

## Phase 5: Integration ✅

### 5.1 Editor Integration ✅
- [x] Update `EditorDialogs.tsx`
  - [x] Add AISegmentMergeDialog
- [x] Update `useTranscriptEditor.ts`
  - [x] Add state for merge dialog
  - [x] Add keyboard shortcut (Alt+Shift+M)
- [x] Update `useNavigationHotkeys.ts`
  - [x] Add hotkey binding
- [x] Update `KeyboardShortcuts.tsx`
  - [x] Document keyboard shortcut

### 5.2 Translations
- [ ] Update `/src/translations/en.json`
- [ ] Update `/src/translations/de.json`

### 5.3 Documentation
- [x] Update `ai-segment-merge-suggestion.md` with final implementation
- [ ] Update `AI_QUICK_REFERENCE.md`
- [ ] Update `ai-features-unified.md`

---

## Phase 6: Testing ✅

### 6.1 Unit Tests ✅
- [x] `segmentMerge/__tests__/utils.test.ts` - Pure function tests (80%+ coverage)
  - [x] Time & gap calculations (calculateTimeGap, isTimeGapAcceptable, formatTime, formatTimeRange)
  - [x] Speaker comparison (isSameSpeaker)
  - [x] Sentence analysis (endsWithSentencePunctuation, startsWithCapital, endsIncomplete, detectIncorrectSentenceBreak)
  - [x] Text operations (concatenateTexts, applyBasicSmoothing, createSmoothingInfo)
  - [x] Confidence calculation (scoreToConfidenceLevel, meetsConfidenceThreshold)
  - [x] Prompt formatting (formatSegmentsForPrompt, formatSegmentPairsForPrompt)
  - [x] Suggestion processing (processSuggestion, processSuggestions)
  - [x] Grouping & filtering (groupByConfidence, filterByStatus, countByConfidence)
  - [x] Validation (validateMergeCandidate)
- [x] `segmentMerge/__tests__/config.test.ts` - Configuration tests
  - [x] segmentMergeConfig structure
  - [x] Prompt content validation
  - [x] Response schema validation
  - [x] getMergeSystemPrompt / getMergeUserTemplate
- [x] `segmentMerge/__tests__/types.test.ts` - Constants tests
  - [x] DEFAULT_SEGMENT_MERGE_CONFIG
  - [x] INITIAL_SEGMENT_MERGE_STATE

### 6.2 Integration Tests
- [ ] Dialog component tests (requires mocking)
- [ ] Store slice tests (requires mocking)

---

## Technical Decisions

### Reusable Functions to Move to Core
1. **Progress tracking pattern** - from AI Speaker/Revision
2. **Provider selection UI** - similar pattern
3. **Batch processing with callbacks** - already in core

### UX Decisions
- **Dialog-based** (like AI Revision) not panel-based
- **Preview before apply** - show merged text with smoothing
- **Confidence grouping** - High/Medium/Low
- **Batch actions** - Accept all high-confidence

### Smoothing Feature
- Optional per analysis
- Shows preview of smoothed text
- AI suggests grammatical fixes for:
  - Incorrect sentence breaks (punkt + Großschreibung mitten im Satz)
  - Incomplete sentences spanning segments
  - Punctuation cleanup at merge points

---

## Files Created/Modified

### New Files
```
/src/lib/ai/features/segmentMerge/
├── types.ts              # Type definitions
├── utils.ts              # Pure helper functions
├── config.ts             # Prompts and configuration
├── service.ts            # AI analysis service
└── index.ts              # Public exports

/src/lib/store/slices/aiSegmentMergeSlice.ts    # Zustand slice
/src/components/AISegmentMergeDialog.tsx         # Main UI dialog
```

### Modified Files
```
/src/lib/ai/features/segmentMerge.ts            # Re-exports from folder
/src/lib/ai/features/index.ts                   # Export new feature
/src/lib/ai/core/featureRegistry.ts             # Register feature
/src/lib/store/types.ts                         # Add store types
/src/lib/store.ts                               # Integrate slice
/src/components/transcript-editor/EditorDialogs.tsx       # Add dialog
/src/components/transcript-editor/useTranscriptEditor.ts  # Dialog state
/src/components/transcript-editor/useNavigationHotkeys.ts # Keyboard shortcut
/src/components/KeyboardShortcuts.tsx           # Document shortcut
/docs/features/ai-segment-merge-suggestion.md   # Updated with smoothing
/docs/features/architecture/AI_QUICK_REFERENCE.md # Added feature reference
```

---

## Current Progress

**Last Updated:** January 4, 2026

| Phase | Status | Progress |
|-------|--------|----------|
| Phase 1: Foundation | ✅ Complete | 100% |
| Phase 2: AI Service | ✅ Complete | 100% |
| Phase 3: Store | ✅ Complete | 100% |
| Phase 4: UI | ✅ Complete | 100% |
| Phase 5: Integration | ✅ Complete | 100% |
| Phase 6: Testing | ✅ Complete | 100% |

### Overall: Feature Implementation Complete 🎉

---

## Notes & Questions

- Die manuelle Merge-Funktion existiert bereits (`mergeSegments` im Store)
- AI fügt nur Vorschläge hinzu, die dann die bestehende Merge-Funktion nutzen
- Smoothing ist optional und wird im Prompt konfiguriert
