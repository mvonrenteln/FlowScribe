# AI Segment Merge – Technical Architecture & Developer Guide

_Last updated: January 5, 2026_

---

## 1. Motivation & Scope

AI Segment Merge enables users to automatically identify transcript segments that should be combined and optionally smooth merged text to fix transcription artifacts. The system supports both manual merging (fully functional) and optional AI-driven suggestions with configurable confidence levels.

This document covers:
- System architecture and data flow
- Core merge engine (manual + AI)
- Text smoothing system
- Response parsing and validation
- UI/UX integration
- State management
- Testing strategy
- Configuration and extensibility

---

## 2. High-Level Architecture

```
┌─────────────────────────────────────────────────────────┐
│ User Actions                                            │
│ (Manual merge, AI analysis, smoothing)                 │
└────────────────────┬────────────────────────────────────┘
                     │
         ┌───────────┴────────────┐
         │                        │
    ┌────▼────────┐       ┌──────▼─────────┐
    │ Manual Merge │       │ AI Analysis    │
    │ Engine       │       │ Panel          │
    └──────┬───────┘       └────────┬───────┘
           │                        │
           │    ┌───────────────────┘
           │    │
      ┌────▼────▼──────────────────────────┐
      │ Segment Merge Service              │
      │ • Validation                        │
      │ • Merge execution                   │
      │ • Text smoothing coordination       │
      └────┬─────────┬──────────┬───────────┘
           │         │          │
      ┌────▼──┐  ┌───▼────┐  ┌─▼──────────┐
      │ Store │  │ History│  │AI Provider │
      │ Update│  │ (Undo) │  │(Smoothing) │
      └───────┘  └────────┘  └────────────┘
```

### Core Components

- **Manual Merge Engine**: Pure business logic for combining segments
- **AI Analysis Service**: Analyzes transcript and generates merge suggestions
- **Text Smoothing**: Optional AI enhancement to fix transcription artifacts
- **Response Parser**: Robust extraction and validation of AI responses
- **State Management**: Zustand store for merge state and results
- **UI Components**: Dialog, preview, batch actions

---

## 3. Merge Engine (Manual)

### Data Flow

```typescript
// Input: Two or more segments to merge
interface SegmentMergeInput {
  segmentIds: string[];
  targetSpeaker?: string; // Optional override
  textSeparator?: string;  // Default: " " (space)
}

// Output: Single merged segment
interface MergedSegment {
  id: string;
  startTime: number;
  endTime: number;
  speaker: string;
  text: string;
  confidence: number; // Average of merged
  words?: Word[];     // Interpolated if available
}
```

### Merge Rules

1. **Time Window**: `startTime` = min(first segment), `endTime` = max(last segment)
2. **Speaker Validation**: All segments must have same speaker (or override provided)
3. **Text Concatenation**: Join with separator, optionally trim whitespace
4. **Word-Level Timestamps**: 
   - If available: merge word arrays and adjust timing
   - If unavailable: generate synthetic word array based on segment duration
5. **Confidence**: Average of all merged segments' confidence scores

### Implementation Location

**File**: `client/src/lib/ai/features/segmentMerge/utils.ts`

```typescript
export function mergeSegments(
  segments: Segment[],
  options: MergeOptions
): MergedSegment { ... }

export function validateMergeableSegments(
  segments: Segment[]
): ValidationError[] { ... }

export function generateWordTimestamps(
  text: string,
  startTime: number,
  endTime: number
): Word[] { ... }
```

### Undo/Redo

All merges are tracked in Zustand history slice. Undo/Redo is handled by the main transcript store, not segment merge specifically.

---

## 4. AI Merge Analysis Service

### High-Level Flow

```
User Input (scope, criteria)
    ↓
Build Prompt (transcript context, criteria)
    ↓
Call AI Provider
    ↓
Parse Response (JSON + recovery)
    ↓
Validation & Normalization
    ↓
Display Suggestions UI
    ↓
User Reviews & Acts
    ↓
Execute Merges
```

### Service Architecture

**Location**: `client/src/lib/ai/features/segmentMerge/service.ts`

```typescript
interface SegmentMergeSuggestion {
  segmentIds: string[];
  reason: string;
  confidence: 'high' | 'medium' | 'low';
  suggestedText?: string;        // With smoothing
  smoothingChanges?: string;     // Explanation of changes
}

interface SegmentMergeInput {
  segments: Segment[];
  maxTimGap?: number;
  minConfidence?: ConfidenceLevel;
  enableSmoothing?: boolean;
  selectedSpeaker?: string;      // Filter to speaker
}

class SegmentMergeService extends AIFeatureService {
  async analyzeMerges(input: SegmentMergeInput): Promise<SegmentMergeSuggestion[]> {
    const prompt = this.promptBuilder.build(input);
    const response = await this.provider.execute(prompt);
    const parsed = await this.responseProcessor.process(response);
    return this.validate(parsed);
  }
}
```

### Prompt System

**Location**: `client/src/lib/ai/features/segmentMerge/promptBuilder.ts`

#### System Prompt

Contains instructions for:
- Identifying merge candidates (same speaker, incomplete sentences, time gaps)
- Assigning confidence levels
- Detecting smoothing opportunities
- Response format expectations

#### User Prompt Templates

Two built-in variants:
1. **Detailed**: Full context, verbose reasoning
2. **Compact**: Minimal context, concise results

**Location**: Built into `segmentMerge/config.ts`

```typescript
export const SEGMENT_MERGE_PROMPTS = {
  detailed: {
    id: 'segment-merge-detailed',
    name: 'Detailed Analysis',
    userPromptTemplate: `Analyze these segments...`,
  },
  compact: {
    id: 'segment-merge-compact',
    name: 'Compact Analysis',
    userPromptTemplate: `Quick merge candidates...`,
  },
};
```

### Response Processing

**Location**: `client/src/lib/ai/features/segmentMerge/responseProcessor.ts`

Handles:
- Extracting JSON from response (with recovery strategies)
- Validating against schema
- Normalizing field names
- Handling malformed responses

**Recovery Strategies** (from `client/src/lib/ai/parsing/recoveryStrategies.ts`):
- Lenient JSON parsing (allow trailing commas, missing quotes)
- Partial array extraction (extract valid items, skip invalid)
- JSON substring extraction (find embedded JSON in text)

### Validation

**Location**: `client/src/lib/ai/features/segmentMerge/validation.ts`

Rule-based validation for:
- **Segment Reference**: IDs must exist and be consecutive
- **Confidence Level**: Must be valid enum value
- **Time Window**: Start < End, no overlap with excluded segments
- **Speaker Consistency**: All segments have same speaker
- **Text Quality**: Not empty, reasonable length

---

## 5. Text Smoothing

### What is Text Smoothing?

When segments are merged, Whisper sometimes creates transcription artifacts:

```
Segment A: "So what we're trying to."
Segment B: "Achieve here is better performance."
```

**Problem**: Incorrect period and capitalization created artificial sentence break

**Solution**: AI proposes smoothing to fix:
```
"So what we're trying to achieve here is better performance."
```

### Smoothing Workflow

1. **Detection**: During merge suggestion analysis, AI identifies smoothing opportunities
2. **Preview**: User sees before/after comparison with explanation
3. **Optional**: User can accept smoothing or merge without it
4. **Reversible**: Undo applies original merged text, not smoothed

### Implementation

Text smoothing is integrated into the main service:

```typescript
interface SegmentMergeSuggestion {
  segmentIds: string[];
  reason: string;
  confidence: 'high' | 'medium' | 'low';
  suggestedText?: string;        // Original merge
  smoothedText?: string;         // With smoothing applied
  smoothingChanges?: string;     // What was fixed
}
```

The service returns both options; UI lets user choose.

### System Prompt Instructions

The system prompt includes explicit instructions for smoothing:

```
When text will be merged:
1. Check for common Whisper artifacts:
   - Mid-sentence period followed by capital letter
   - Fragmented punctuation
   - Capitalization errors

2. If found, suggest smoothing:
   - Suggest both original merge and smoothed variant
   - Explain what was fixed
   - Set confidence based on certainty of fix
```

---

## 6. State Management

**Location**: `client/src/lib/store.ts` (segmentMerge slice)

```typescript
interface SegmentMergeState {
  // Analysis
  isAnalyzing: boolean;
  suggestions: SegmentMergeSuggestion[];
  analysisError?: string;

  // User interaction
  acceptedSuggestions: Set<string>;  // Suggestion IDs
  rejectedSuggestions: Set<string>;

  // Results
  appliedMerges: MergedSegment[];
}

// Actions
setAnalyzing(isAnalyzing: boolean)
setSuggestions(suggestions: SegmentMergeSuggestion[])
acceptSuggestion(suggestionId: string, withSmoothing?: boolean)
rejectSuggestion(suggestionId: string)
applySuggestions(suggestions: SegmentMergeSuggestion[], mode: 'accepted' | 'all-high')
```

Suggestions are pruned whenever segments are deleted or manually merged, so any
merge suggestion that references removed segment IDs is removed from state to
avoid stale UI entries.

---

## 7. UI Components

### Main Components

**AISegmentMergeDialog.tsx**
- Dialog wrapper for analysis panel
- Scope selection (entire/filtered/selected)
- Configuration (max gap, confidence level, smoothing toggle)
- Execution and error handling
- Results display with batch actions

**Merge Preview** (integrated in TranscriptEditor)
- Inline indicators on segments marked for merge
- Clickable to accept/reject inline
- Shows reason and smoothing preview if applicable

### Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Alt+Shift+M` | Open AI analysis dialog |
| `Enter` | Accept current suggestion |
| `Delete` | Reject current suggestion |
| `↑/↓` | Navigate suggestions |
| `H` | Accept all high-confidence |
| `Escape` | Close dialog |

---

## 8. Configuration

### Built-in Settings

**Location**: `client/src/lib/ai/features/segmentMerge/config.ts`

```typescript
export const SEGMENT_MERGE_CONFIG = {
  DEFAULT_MAX_TIME_GAP: 2.0,           // seconds
  DEFAULT_MIN_CONFIDENCE: 'medium',    // high | medium | low
  ENABLE_SMOOTHING_BY_DEFAULT: true,
  SHOW_MERGE_PREVIEW: true,
  ALLOW_CROSS_SPEAKER_MERGE: false,
};
```

### User Settings

Accessible via Settings → Editor → Segment Merge:
- Default time gap threshold
- Default confidence filter
- Text separator (default: space)
- Smoothing enabled by default
- Show inline merge hints

---

## 9. Testing Strategy

### Unit Tests (Utilities)

**Location**: `client/src/lib/ai/features/segmentMerge/__tests__/`

- **utils.test.ts**: Merge logic, word interpolation, validation
  - Test merging 2-5 segments
  - Word timestamp interpolation
  - Speaker consistency validation
  - Undo/Redo integration

- **validation.test.ts**: Rule-based validation
  - Valid and invalid segment references
  - Confidence level validation
  - Time window validation
  - Speaker consistency

- **promptBuilder.test.ts**: Prompt construction
  - Variable substitution
  - Template rendering
  - Scope handling (entire/filtered/selected)

### Integration Tests

- **service.test.ts**: Service end-to-end
  - Mock AI provider responses
  - Response parsing and recovery
  - Error handling
  - Batch operations

### Component Tests

- **AISegmentMergeDialog.test.tsx**: Dialog flow
  - Scope selection
  - Configuration changes
  - Accept/reject actions
  - Error handling

### Coverage Goals

- **Utilities**: 85%+ (pure functions)
- **Service**: 40-50% (with AI mocks)
- **Components**: 60%+ (critical paths)

---

## 10. Error Handling

### Common Errors

| Scenario | Recovery |
|----------|----------|
| AI provider unavailable | Show error, disable analysis |
| Malformed JSON response | Try recovery strategies, fallback to text parsing |
| Invalid segment references | Skip invalid entries, continue with valid ones |
| No merge candidates found | Show empty results, explain criteria |
| Text smoothing failure | Offer original merge without smoothing |

### Error Messages

User-facing errors are localized (i18n) and contextual:
- What went wrong
- Why it happened
- Suggested next steps

---

## 11. Response Parsing & Recovery

The segment merge service uses the unified response parsing infrastructure (see `client/src/lib/ai/parsing/`):

### Flow

```typescript
const response = await provider.execute(prompt);

// 1. Try primary parser (JSON)
const parsed = await jsonParser.parse(response);

// 2. If fails, try recovery strategies
if (!parsed.success) {
  const recovered = await recoveryStrategies
    .tryLenientParse(response)
    .tryPartialArray(response)
    .tryJsonSubstring(response);
}

// 3. Validate against schema
const validated = validator.validate(parsed, SCHEMA);

// 4. Return or throw
if (!validated.success) {
  logging.warn('Parsing failed', { response, errors: validated.errors });
  throw new AIFeatureError('Invalid response');
}
```

### Robustness

- Handles malformed JSON gracefully
- Attempts partial extraction from valid responses
- Logs detailed errors for debugging
- User always gets feedback (not silent failures)

---

## 12. Extensibility Points

### Adding New Merge Criteria

Edit `client/src/lib/ai/features/segmentMerge/validation.ts`:

```typescript
const MERGE_RULES = [
  // Existing rules...
  {
    name: 'newCriterion',
    validate: (segments) => { /* logic */ },
    severity: 'warn',
  },
];
```

Then update system prompt to include the new criterion.

### Adding New Smoothing Strategies

Extend the system prompt with additional artifact detection patterns.

### Supporting New AI Providers

No changes needed—uses unified provider abstraction.

---

## 13. Performance Considerations

### Batch Analysis

- Analyze entire transcript in batches (configurable)
- Show progress during analysis
- Stream results as they're parsed

### Caching

- Cache analysis results until user modifies segments
- Invalidate cache on transcript changes

### Memory

- Don't hold full response text in state
- Clear suggestions after user accepts/rejects all

---

## 14. Developer Quick Start

### Running Segment Merge

1. **Manual merge**: Works out-of-the-box
   ```typescript
   const merged = mergeSegments([seg1, seg2], options);
   ```

2. **AI analysis**:
   ```typescript
   const service = new SegmentMergeService(store, provider);
   const suggestions = await service.analyzeMerges(input);
   ```

3. **Apply merge**:
   ```typescript
   store.mergeSegments(segmentIds);
   ```

### Testing

```bash
# Unit tests
npm test -- segmentMerge

# Coverage
npm test -- segmentMerge --coverage
```

### Adding Logging

```typescript
logging.debug('segmentMerge', {
  action: 'analyze',
  scope: 'entire',
  segmentCount: 100,
});
```

---

## 15. Known Limitations & Future Work

### Current Limitations

- **Cross-speaker merge**: Disabled by default (can be enabled with warning)
- **Confidence accuracy**: Depends on AI provider quality
- **Smoothing scope**: Limited to common Whisper artifacts

### Future Enhancements

- **Confidence scoring**: Expose per-change confidence to UI
- **Bulk operations**: Accept/reject by pattern or speaker
- **Merge preview**: Show word-level diffs before applying
- **Custom criteria**: User-definable merge rules
- **Performance**: Incremental analysis for very large transcripts

---

## 16. Related Documentation

- [AI Features Unified](./ai-features-unified.md) - Core architecture, patterns, APIs
- [User Guide](../ai-segment-merge-suggestion.md) - End-user documentation
- [PR Details](./PR_segment_merge.md) - Implementation details for this feature
