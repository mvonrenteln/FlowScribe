# Ticket: AI Command Panel – Batch Text Revision Feature

**Status**: Proposed  
**Priority**: High  
**Complexity**: Medium  
**Related Documentation**: [AI Command Panel Specification](docs/features/architecture/ai-command-panel.md) | [AI Features Guide](docs/features/architecture/ai-features-unified.md#ai-command-panel-architecture)

---

## Description

Implement the **Batch Text Revision tab** in the unified AI Command Panel. Users can batch-process transcript segments with various revision templates (Fix Grammar, Remove Fillers, Improve Clarity, etc.). Suggested revisions appear side-by-side in the Transcript View with accept/reject controls per segment.

### Part of Larger Initiative

This ticket is part of the **Unified AI Command Panel** refactoring, which consolidates all batch AI features under one consistent interface. See [AI Command Panel Specification](docs/features/architecture/ai-command-panel.md) for full UX design and architecture.

---

## Acceptance Criteria

### 1. Command Panel Integration

- [ ] "Revision" tab appears in AI Command Panel (first tab)
- [ ] Panel shows correct configuration:
  - Scope: "Filtered: X segments" + "☐ Exclude Confirmed" checkbox
  - AI Configuration: Provider + Model + Batch Size dropdowns
  - Revision Settings: Template selector with options:
    - Fix Grammar & Style
    - Remove Fillers
    - Improve Clarity
    - Custom Prompt 1 (extensible)
  - Start Batch button
- [ ] Progress display during execution (progress bar, X/Y count, elapsed time)
- [ ] Pause/Stop/Clear buttons functional during processing

### 2. Batch Processing

- [ ] Process segments in batches (configurable batch size: 10, 20, 50, etc.)
- [ ] "Exclude Confirmed" checkbox prevents reprocessing of confirmed segments
- [ ] Template selection determines the revision direction (e.g., "Remove Fillers" vs "Improve Clarity")
- [ ] Store results temporarily during session
- [ ] Handle errors gracefully (show error summary, allow retry)
- [ ] Cancel/Pause functionality pauses processing and allows resuming or clearing

### 3. Results Display – Side-by-Side Comparison

Each segment with a revision shows:

- [ ] Original text on left side
- [ ] Revised text on right side
- [ ] Changes highlighted:
  - Additions in green
  - Removals as strikethrough
  - Formatting/case changes in subtle highlight
- [ ] ✗ (Reject) and ✓ (Accept) buttons
- [ ] Optional: Reasoning from AI (why specific changes were made)
- [ ] Accepted revisions update the segment's text immediately
- [ ] Rejected revisions are skipped without modifying the segment
- [ ] Layout: Side-by-side comparison works well at 50-55% Transcript width (verified by design)

### 4. Results Summary – Grouping by Confidence

Command Panel shows Results Summary with three collapsible sections:

- [ ] **High Confidence** (e.g., 245 results)
  - List format: "#045  0:45.2  Preview..."
  - Clicking an entry jumps directly to that segment in Transcript
  - Shows brief preview of the revision (first 40 chars)
  - Collapsible/expandable
- [ ] **Medium Confidence** (e.g., 67 results)
  - Same list format as High
  - Collapsed by default
- [ ] **Low Confidence** (e.g., 12 results)
  - Same list format
  - Collapsed by default, but clearly visible for manual review
- [ ] **Bulk Actions**:
  - "✓ Accept All High" button
  - "✗ Reject All" button

### 5. Keyboard Navigation

- [ ] `N` = Navigate to next revision
- [ ] `P` = Navigate to previous revision
- [ ] `A` = Accept current revision
- [ ] `R` = Reject current revision
- [ ] `ESC` = Close panel
- [ ] Arrow keys navigate between results summary entries (when panel focused)

### 6. Additional Features

- [ ] "Show only suggestions" toggle filters Transcript to segments with revisions only
- [ ] Speaker filter in left sidebar respected: Panel respects pre-filtered speaker selection
- [ ] Undo/Redo support: Accepted revisions can be undone (reverts to original text)
- [ ] Storage: Accepted revisions persist in transcript data
- [ ] Inline text revision (single ✨ button on segment) still works independently
- [ ] Revision history tracking: Store original → revised mappings for audit

---

## Implementation Notes

### Key Design Decisions

1. **Side-by-Side Layout**: Showing original and revised text side-by-side in the main Transcript allows users to review changes in context without losing surrounding segments.

2. **Template Flexibility**: Template selector lets users choose revision strategy (grammar vs style vs clarity), enabling targeted improvements without full transcript processing.

3. **Confidence Grouping**: Three-tier grouping (High/Medium/Low) lets users focus on confident changes first, then review edge cases.

4. **Results in Transcript**: Keeping results in the main work area (not in the narrow side panel) maximizes space for detailed comparison.

5. **Exclude Confirmed**: The checkbox respects user-confirmed segments, avoiding unnecessary reprocessing of already-reviewed content.

### Related Components

- **AI Command Panel Wrapper**: See foundation ticket for shared panel infrastructure
- **Side-by-Side Revision Component**: Shows Original/Revised with change highlighting and accept/reject
- **Results Summary Component**: Collapsible confidence-grouped entries with jump navigation

### Existing Infrastructure

- Text revision service exists: `src/lib/ai/features/revision/service.ts` (production-ready)
- Inline revision component exists: Check `src/components/` for ✨ button implementation
- May need to refactor inline revision to share widgets with batch version

---

## Testing Requirements

### Unit Tests

- [ ] Template selection logic
- [ ] Confidence score grouping (High/Medium/Low cutoffs)
- [ ] Change highlighting algorithm (additions, removals, formatting)
- [ ] Timestamp preservation (revisions don't change segment timing)
- [ ] Jump-navigation (segment lookup by ID)

### Integration Tests

- [ ] End-to-end batch processing (start → process → show results → accept/reject)
- [ ] Results summary accuracy (correct counts and preview generation)
- [ ] Undo/Redo of accepted revisions
- [ ] Filter interaction (Exclude Confirmed prevents reprocessing)
- [ ] Revision history stored correctly

### Component Tests

- [ ] Panel layout and tab switching
- [ ] Side-by-side comparison rendering
- [ ] Change highlighting (green additions, strikethrough removals)
- [ ] Accept/Reject buttons work correctly
- [ ] Results summary collapsing/expanding

### Manual QA

- [ ] Processing 343 segments completes without UI freezing
- [ ] Side-by-side layout doesn't overflow or break at 50-55% width
- [ ] Revision quality acceptable across all templates (spot-check 20+ segments)
- [ ] Undo completely restores original text (character-perfect)
- [ ] Keyboard navigation doesn't interfere with text selection
- [ ] Inline ✨ revision still works when panel is open

---

## Scope & Boundaries

### In Scope

- Batch text revision processing via AI Command Panel
- Side-by-side original/revised display in Transcript
- Template selection (Grammar, Fillers, Clarity, Custom)
- Results summary with confidence grouping
- Keyboard and mouse navigation
- Undo/Redo support
- Integration with existing inline revision feature

### Out of Scope (Future Tickets)

- Multiple templates applied sequentially (request from different provider)
- Revision preview mode (apply changes temporarily without saving)
- Weighted scoring for confidence (currently binary/threshold-based)
- Mobile/tablet optimization

---

## Success Metrics

- [ ] Users can review 343+ revisions in < 5 minutes (with 95%+ High Confidence)
- [ ] 90%+ of revisions are acceptable with minimal manual editing
- [ ] Zero character loss or corruption from revision storage
- [ ] Undo works for 100% of accepted revisions
- [ ] Side-by-side layout renders without performance degradation
- [ ] No regressions in inline revision feature

---

## Related Tickets

- **Foundation**: TICKET_AI_PANEL_FOUNDATION.md (shared Command Panel infrastructure)
- **Speaker Classification**: TICKET_AI_PANEL_SPEAKER.md (similar batch workflow)
- **Segment Merge**: TICKET_AI_PANEL_MERGE.md (similar results display pattern)

---

## Design References

- **Full UX Specification**: [AI Command Panel](docs/features/architecture/ai-command-panel.md) – See "Batch Text Revision" section for mockups and interaction patterns
- **Architecture Guide**: [AI Features Unified](docs/features/architecture/ai-features-unified.md#ai-command-panel-architecture) – Quick reference on panel structure
- **Existing Revision Service**: `src/lib/ai/features/revision/service.ts` – Production-ready implementation

---

## Estimated Effort

- **Design & Planning**: 4 hours
- **Implementation**: 18-22 hours
- **Testing**: 8-10 hours
- **Review & Polish**: 4 hours

**Total**: ~34-40 hours

---

*Last Updated: January 2026*
