# Ticket: AI Command Panel – Segment Merge Feature

**Status**: Proposed  
**Priority**: Medium  
**Complexity**: Medium-High  
**Related Documentation**: [AI Command Panel Specification](docs/features/architecture/ai-command-panel.md) | [AI Features Guide](docs/features/architecture/ai-features-unified.md#ai-command-panel-architecture)

---

## Description

Implement the **Segment Merge tab** in the unified AI Command Panel. Users can batch-process segments to identify and merge incomplete or naturally-split segments. AI suggestions appear as inline merge widgets between segment pairs, showing merged text, gap analysis, and confidence scores.

### Part of Larger Initiative

This ticket is part of the **Unified AI Command Panel** refactoring, which consolidates all batch AI features under one consistent interface. See [AI Command Panel Specification](docs/features/architecture/ai-command-panel.md) for full UX design and architecture.

---

## Acceptance Criteria

### 1. Command Panel Integration

- [ ] "Merge" tab appears in AI Command Panel (after "Speaker" tab)
- [ ] Panel shows correct configuration:
  - Scope: "Filtered: X segments" + "☐ Exclude Confirmed" checkbox
  - AI Configuration: Provider + Model + Batch Size dropdowns
  - Merge Settings:
    - Max Time Gap: slider or input (default: 2.0 seconds)
    - Min Confidence: dropdown (High only / Medium and above / All)
    - ☐ Same speaker only (checkbox)
    - ☐ Enable text smoothing (checkbox)
  - Start Batch button
- [ ] Progress display during execution (progress bar, X/Y count, elapsed time)
- [ ] Pause/Stop/Clear buttons functional during processing

### 2. Batch Processing

- [ ] Process segment pairs in batches (configurable batch size)
- [ ] Respect Max Time Gap setting (only consider gaps < threshold)
- [ ] Respect "Same speaker only" setting (skip pairs with different speakers if checked)
- [ ] "Exclude Confirmed" checkbox prevents reprocessing of confirmed segments
- [ ] Text smoothing option produces natural combined text when enabled
- [ ] Handle edge cases gracefully:
  - Last segment (no next segment to merge with)
  - Segments at transcript boundaries
  - Multiple consecutive merge suggestions
- [ ] Store results temporarily during session
- [ ] Handle errors gracefully with retry capability

### 3. Results Display – Inline Merge Widgets

Each suggested merge displays as a **widget between the two segments**:

- [ ] Visual bracket or connector lines between segments
- [ ] Widget contains:
  - Status line: "MERGE SUGGESTION | Gap: X.XXs | Confidence: Y%"
  - Merged text preview with changes highlighted (additions in green, removals strikethrough)
  - Reasoning from AI (e.g., "Incomplete sentence continuation, natural speech flow")
  - ✗ (Reject) and ✓ (Accept) buttons
- [ ] Merged timestamps and speaker tags displayed clearly
- [ ] Accepted merge:
  - Combines the two segments into one
  - Removes gap between segments
  - Updates UI immediately
- [ ] Rejected merge:
  - Segments remain unchanged
  - Move to "Low Confidence" in results summary
  - Appears in summary for potential manual review

### 4. Results Summary – Grouping by Confidence

Command Panel Results Summary displays:

- [ ] **High Confidence** (e.g., 12 results)
  - List format: "#045 → #046 | 0:45.2 | Preview..."
  - Clicking jumps to that segment pair in Transcript
  - Shows two-segment snippet in summary
- [ ] **Medium Confidence** (e.g., 3 results)
  - Same format, collapsed by default
- [ ] **Low Confidence** (e.g., 0 results)
  - Same format, collapsed by default
- [ ] **Bulk Actions**:
  - "✓ Accept All High" button (accepts all High Confidence merges)
  - "✗ Reject All" button (rejects all suggestions)

### 5. Keyboard Navigation

- [ ] `N` = Navigate to next merge suggestion
- [ ] `P` = Navigate to previous merge suggestion
- [ ] `A` = Accept current merge
- [ ] `R` = Reject current merge
- [ ] `ESC` = Close panel
- [ ] Arrow keys navigate between results summary entries

### 6. Additional Features

- [ ] "Show only suggestions" toggle filters Transcript to show only segment pairs with merge suggestions
- [ ] Speaker filter in left sidebar respected: Merge only processes filtered speakers if "Same speaker only" is checked
- [ ] Undo/Redo support: Accepted merges can be undone (reverts to two separate segments)
- [ ] Storage: Merged segments persist in transcript data
- [ ] Manual merge shortcut still works (M key) on individual segments without using AI

---

## Implementation Notes

### Key Design Decisions

1. **Widget Display**: Merge suggestion appears **between segments** (not in side panel) to clearly show the exact merge proposal in context.

2. **Merged Text Preview**: Showing the actual merged text with highlighted changes lets users preview exactly what will happen before accepting.

3. **Gap Analysis**: Displaying the gap (0.79s) and allowing Max Time Gap configuration lets users control merge aggressiveness.

4. **Text Smoothing**: Optional smoothing cleans up artifacts (e.g., "together without the  overall" → "together without the overall") for natural-sounding results.

### Related Components

- **AI Command Panel Wrapper**: See foundation ticket for shared panel infrastructure
- **Merge Widget Component**: New inline component between segments showing merge details and controls
- **Results Summary Component**: Segment-pair list with confidence grouping

### Existing Infrastructure

- Merge widget component already exists for manual merges (check `src/components/transcript-segment/`)
- Segment merge service exists: `src/lib/ai/features/segmentMerge/` (production-ready, recently refactored)
- May need to adapt UI to show AI-generated reasoning alongside manual merge UI

---

## Testing Requirements

### Unit Tests

- [ ] Confidence score grouping logic
- [ ] Time gap validation (respects Max Time Gap setting)
- [ ] Speaker filtering (same-speaker-only logic)
- [ ] Text smoothing algorithm
- [ ] Timestamp calculation after merge
- [ ] Jump-navigation (segment-pair lookup)

### Integration Tests

- [ ] End-to-end batch processing (start → process → show results → accept/reject)
- [ ] Results summary accuracy (correct pair identification and confidence)
- [ ] Undo/Redo of merged segments
- [ ] Filter interactions (Exclude Confirmed, Speaker filter, Same speaker only)

### Component Tests

- [ ] Merge widget rendering (correct text and metadata display)
- [ ] Results summary with segment pairs
- [ ] Accept/Reject button functionality
- [ ] Bulk action buttons
- [ ] Widget visibility and scrolling

### Manual QA

- [ ] Processing 343 segments completes without freezing
- [ ] Merged segments have correct new timestamps
- [ ] Gap validation works (doesn't suggest merges > Max Time Gap)
- [ ] Text smoothing improves readability for 90%+ of merges
- [ ] Undo restores both segments with original timestamps
- [ ] Manual merge shortcut (M) still works when AI panel is closed

---

## Scope & Boundaries

### In Scope

- Segment merge batch processing via AI Command Panel
- Merge suggestion widget displayed inline between segments
- Results summary with confidence grouping
- Keyboard and mouse navigation
- Text smoothing option
- Time gap and speaker filtering

### Out of Scope (Future Tickets)

- Multi-model merge comparison
- Merge preview mode (non-destructive preview of multiple merges at once)
- Automatic merge without user confirmation (safety requirement)
- Mobile/tablet optimization

---

## Success Metrics

- [ ] Users can identify merge candidates in 343+ segments in < 3 minutes
- [ ] 95%+ of merge suggestions are correct (validated with real transcripts)
- [ ] Undo works for 100% of accepted merges
- [ ] Zero data loss or corruption from merge operations
- [ ] No regressions in manual merge functionality

---

## Related Tickets

- **Foundation**: TICKET_AI_PANEL_FOUNDATION.md (shared Command Panel infrastructure)
- **Text Revision**: TICKET_AI_PANEL_REVISION.md (similar batch workflow)
- **Speaker Classification**: TICKET_AI_PANEL_SPEAKER.md (similar results display pattern)

---

## Design References

- **Full UX Specification**: [AI Command Panel](docs/features/architecture/ai-command-panel.md) – See "Segment Merging" section for mockups and interaction patterns
- **Architecture Guide**: [AI Features Unified](docs/features/architecture/ai-features-unified.md#ai-command-panel-architecture) – Quick reference on panel structure and design decisions
- **Existing Merge Service**: `src/lib/ai/features/segmentMerge/service.ts` – Production-ready implementation

---

## Estimated Effort

- **Design & Planning**: 4 hours
- **Implementation**: 20-24 hours (merge widget is more complex than other suggestions)
- **Testing**: 10-12 hours
- **Review & Polish**: 4 hours

**Total**: ~38-44 hours

---

*Last Updated: January 2026*
