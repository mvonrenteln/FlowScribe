# Ticket: AI Command Panel – Speaker Classification Feature

**Status**: Proposed  
**Priority**: Medium  
**Complexity**: Medium  
**Related Documentation**: [AI Command Panel Specification](docs/features/architecture/ai-command-panel.md) | [AI Features Guide](docs/features/architecture/ai-features-unified.md#ai-command-panel-architecture)

---

## Description

Implement the **Speaker Classification tab** in the unified AI Command Panel. Users can batch-process segments with AI to suggest speaker assignments, grouped by confidence level. Suggestions appear inline in the Transcript View with accept/reject controls.

### Part of Larger Initiative

This ticket is part of the **Unified AI Command Panel** refactoring, which consolidates all batch AI features under one consistent interface. See [AI Command Panel Specification](docs/features/architecture/ai-command-panel.md) for full UX design and architecture.

---

## Acceptance Criteria

### 1. Command Panel Integration

- [ ] "Speaker" tab appears in AI Command Panel (between "Revision" and "Merge" tabs)
- [ ] Panel shows correct configuration:
  - Scope: "Filtered: X segments" + "☐ Exclude Confirmed" checkbox
  - AI Configuration: Provider + Model + Batch Size dropdowns
  - Speaker Settings: Prompt Template selector (RPG – Marc, Interview Style, Custom Prompt 1, etc.)
  - Start Batch button
- [ ] Progress display during execution (progress bar, X/Y count, elapsed time)
- [ ] Pause/Stop/Clear buttons functional during processing

### 2. Batch Processing

- [ ] Process segments in batches (configurable batch size: 10, 20, 50)
- [ ] "Exclude Confirmed" checkbox prevents reprocessing of confirmed segments
- [ ] Store results temporarily during session
- [ ] Handle errors gracefully (show error summary, allow retry)
- [ ] Cancel/Pause functionality works smoothly

### 3. Results Display – Inline Suggestions

Each segment with a suggestion displays:
- [ ] Suggestion box **above the segment** with:
  - Speaker name + confidence percentage (e.g., "Marc → GM 95%")
  - Optional reasoning from AI
  - ✓ (Accept) and ✗ (Reject) buttons
- [ ] Accepted suggestions update the segment's speaker label immediately
- [ ] Rejected suggestions are skipped and moved to "Low Confidence" group
- [ ] Segments without suggestions remain unmodified

### 4. Results Summary – Grouping by Confidence

Command Panel shows Results Summary with three collapsible sections:

- [ ] **High Confidence** (e.g., 12 results)
  - List format: "#045  0:45.2  Preview..."
  - Clicking an entry jumps directly to that segment in Transcript
  - Collapsible/expandable
- [ ] **Medium Confidence** (e.g., 3 results)
  - Same list format as High
  - Collapsed by default
- [ ] **Low Confidence** (e.g., 0 results)
  - Same list format
  - Collapsed by default
- [ ] **Bulk Actions**:
  - "✓ Accept All High" button (accepts all High Confidence in one click)
  - "✗ Reject All" button (rejects all suggestions)

### 5. Keyboard Navigation

- [ ] `N` = Navigate to next suggestion
- [ ] `P` = Navigate to previous suggestion
- [ ] `A` = Accept current suggestion
- [ ] `R` = Reject current suggestion
- [ ] `ESC` = Close panel
- [ ] Arrow keys navigate between results summary entries (when panel is focused)

### 6. Additional Features

- [ ] "Show only suggestions" toggle filters Transcript to show only segments with suggestions
- [ ] Speaker filter in left sidebar works: Panel respects pre-filtered speaker selection
- [ ] Undo/Redo support: Accepted/rejected suggestions can be undone
- [ ] Storage: Speaker assignments persist in transcript data

---

## Implementation Notes

### Key Design Decisions

1. **Suggestion Display**: Suggestions appear **above the segment** (not in the narrow side panel) to provide context and allow clear preview before accepting.

2. **Results Organization**: Confidence-level grouping lets users focus on high-confidence suggestions first, then review medium-confidence if desired.

3. **Jump Navigation**: Clicking a summary entry directly scrolls to that segment, enabling fast selective review across long transcripts.

4. **Exclude Confirmed**: The checkbox prevents re-processing of user-confirmed segments, respecting manual review work already completed.

### Related Components

- **AI Command Panel Wrapper**: See TODO_AI_PANEL_FOUNDATION.md for shared panel infrastructure
- **Inline Suggestion Component**: New reusable component for displaying confidence + reasoning + buttons
- **Results Summary Component**: Collapsible sections with jump-navigation

### Backend Service

- Speaker classification service already exists in `src/lib/ai/features/speaker/`
- May need to adapt service for batch mode if not already implemented
- See existing implementation in `src/lib/ai/features/speaker/service.ts`

---

## Testing Requirements

### Unit Tests

- [ ] Prompt template selection logic
- [ ] Confidence score grouping (High/Medium/Low cutoffs)
- [ ] Jump-navigation calculation (segment lookup by ID)
- [ ] Keyboard shortcut handling (N/P/A/R/ESC)

### Integration Tests

- [ ] End-to-end batch processing (start → process → show results → accept)
- [ ] Results summary accuracy (correct counts and grouping)
- [ ] Undo/Redo of accepted suggestions
- [ ] Filter interaction (Exclude Confirmed prevents reprocessing)

### Component Tests

- [ ] Panel layout and tab switching
- [ ] Suggestion box rendering (confidence display, buttons)
- [ ] Results summary collapsing/expanding
- [ ] Bulk action buttons work correctly

### Manual QA

- [ ] Processing 343 segments with slow provider doesn't freeze UI
- [ ] Canceling mid-batch clears results and allows restart
- [ ] Jump-navigation scrolls to correct segment
- [ ] Keyboard shortcuts don't conflict with existing shortcuts

---

## Scope & Boundaries

### In Scope

- Speaker classification batch processing via AI Command Panel
- Results display inline in Transcript
- Results summary with confidence grouping
- Keyboard and mouse navigation
- Integration with existing speaker assignment system

### Out of Scope (Future Tickets)

- Multi-model comparison (compare suggestions from different models)
- Export of suggestion history
- A/B testing between prompt templates (feature tracking)
- Mobile/tablet optimization (documented as not supported initially)

---

## Success Metrics

- [ ] Users can batch-process 343+ segments in < 2 minutes with Ollama
- [ ] 95%+ of user actions complete without errors
- [ ] Keyboard navigation feels responsive (no lag > 100ms)
- [ ] Undo/Redo history doesn't exceed 100 MB in-memory
- [ ] Zero regressions in existing speaker assignment workflows

---

## Related Tickets

- **Foundation**: TICKET_AI_PANEL_FOUNDATION.md (shared Command Panel infrastructure)
- **Text Revision**: TICKET_AI_PANEL_REVISION.md (similar batch workflow)
- **Segment Merge**: TICKET_AI_PANEL_MERGE.md (similar results display pattern)

---

## Design References

- **Full UX Specification**: [AI Command Panel](docs/features/architecture/ai-command-panel.md) – See "Speaker Classification (Batch)" section for mockups and interaction patterns
- **Architecture Guide**: [AI Features Unified](docs/features/architecture/ai-features-unified.md#ai-command-panel-architecture) – Quick reference on panel structure
- **Existing Speaker Service**: `src/lib/ai/features/speaker/service.ts` – Production-ready implementation

---

## Estimated Effort

- **Design & Planning**: 4 hours
- **Implementation**: 16-20 hours
- **Testing**: 8-10 hours
- **Review & Polish**: 4 hours

**Total**: ~32-38 hours

---

*Last Updated: January 2026*
