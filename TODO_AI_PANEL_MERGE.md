# TODO: AI Command Panel – Segment Merge Implementation

**Feature**: Segment Merge (Batch)  
**Related Ticket**: [TICKET_AI_PANEL_MERGE.md](TICKET_AI_PANEL_MERGE.md)  
**Status**: Not Started  

---

## Phase 1: Foundation & Panel Configuration

- [ ] **Create MergePanel wrapper component** (`src/components/AICommandPanel/MergePanel.tsx`)
  - Configuration form with settings:
    - Max Time Gap slider/input
    - Min Confidence dropdown
    - ☐ Same speaker only checkbox
    - ☐ Enable text smoothing checkbox
  - Progress display during processing
  - Results summary display

- [ ] **Create merge widget component** (`src/components/transcript-segment/MergeWidget.tsx`)
  - Displays between two segments
  - Shows: "MERGE SUGGESTION | Gap: X.XXs | Confidence: Y%"
  - Merged text preview with highlighting
  - ✗ Reject and ✓ Accept buttons
  - Optional reasoning text

- [ ] **Update AICommandPanel main component**
  - Add "Merge" tab (after "Speaker" tab)
  - Tab switching logic
  - Store merge results during session

---

## Phase 2: Results Display & Widget Rendering

- [ ] **Create merge results summary component** (`src/components/AICommandPanel/MergeSummary.tsx`)
  - Collapsible sections: High/Medium/Low confidence
  - List format: "#045 → #046 | 0:45.2 | Gap: 0.79s"
  - Click-to-navigate to segment pair
  - Confidence display with visual indicators

- [ ] **Integrate merge widgets into transcript**
  - Update `TranscriptList` to optionally render `MergeWidget` between segments
  - Widget positioned between two segments in DOM
  - Conditional rendering based on suggestion availability
  - Handle edge cases: last segment, gaps > threshold

- [ ] **Create merge results state management**
  - Store merge suggestions in Zustand store
  - Track which pairs have been suggested
  - Track acceptance/rejection per pair
  - Organize by confidence level

---

## Phase 3: Text Merging & Highlighting

- [ ] **Implement text merging logic**
  - Combine text from two segments
  - Remove redundant whitespace
  - Optional text smoothing (grammar fixes between segments)
  
- [ ] **Create change highlighting component**
  - Green background for additions
  - Strikethrough for removals
  - Subtle highlight for grammar/punctuation changes
  - Preserve original formatting when possible

- [ ] **Implement timestamp calculation**
  - New start time = first segment start
  - New end time = second segment end
  - Display in merged widget
  - Update after acceptance

---

## Phase 4: Keyboard Navigation & UX

- [ ] **Implement keyboard navigation**
  - `N` = Next merge suggestion
  - `P` = Previous merge suggestion
  - `A` = Accept current merge
  - `R` = Reject current merge
  - `ESC` = Close panel
  - Update help dialog with merge shortcuts

- [ ] **Add "Show only suggestions" toggle**
  - Filter transcript to show only segment pairs with suggestions
  - Include ±1 context segments for clarity
  - Toggle in panel

- [ ] **Implement bulk actions**
  - "✓ Accept All High" button
  - "✗ Reject All" button
  - Optional confirmation for bulk merges

- [ ] **Preserve manual merge shortcut**
  - `M` key still works on individual segments
  - No conflict with batch merge feature

---

## Phase 5: Backend Integration

- [ ] **Verify segment merge service supports batching**
  - Check `src/lib/ai/features/segmentMerge/service.ts`
  - Confirm batch processing capability
  - Add batch wrapper if needed

- [ ] **Implement filtering logic**
  - Filter by Max Time Gap
  - Filter by Min Confidence
  - Filter by Same Speaker (if checkbox enabled)
  - Filter out confirmed segments (if Exclude Confirmed is checked)

- [ ] **Implement text smoothing**
  - Fix grammar between segments when enabled
  - Remove stutters/fillers at join point
  - Test with real transcripts

- [ ] **Test with AI providers**
  - Ollama Desktop
  - OpenAI API
  - Verify confidence score parsing

---

## Phase 6: Edge Case Handling

- [ ] **Handle last segment** (no next segment to merge)
  - Don't suggest merge for final segment
  - Clear UI error states

- [ ] **Handle overlapping suggestions**
  - If merge is suggested for segments 5-6 AND 6-7, handle both
  - Prevent accepting 5-6 then 6-7 (would merge 5-6-7 unexpectedly)
  - Show warning if detected

- [ ] **Handle transcript modifications during batch**
  - If user manually edits segment while batch is running
  - Gracefully handle segment index shifts
  - Show warning if detected

---

## Phase 7: Undo/Redo & Persistence

- [ ] **Integrate with Undo/Redo system**
  - Track merge operations
  - Support undo (split merged segments back)
  - Support redo
  - Maintain segment history

- [ ] **Persist merged segments**
  - Save merged segments to transcript data
  - Ensure data consistency
  - Handle conflicts with manual edits

---

## Phase 8: Testing

- [ ] **Unit tests**
  - Text merging algorithm
  - Timestamp calculation
  - Confidence grouping
  - Filter logic (gap, speaker, confidence)

- [ ] **Component tests**
  - Merge widget rendering
  - Text highlighting
  - Accept/Reject buttons
  - Results summary display

- [ ] **Integration tests**
  - Full batch flow: start → process → show results → accept/reject
  - Undo functionality
  - Filter interactions
  - Edge cases (last segment, overlapping suggestions)

- [ ] **Manual QA**
  - Test with 100-segment transcript
  - Test with 343-segment real transcript
  - Verify no UI freezing
  - Check accuracy of merge suggestions
  - Test text smoothing quality

---

## Phase 9: Polish & Documentation

- [ ] **Styling & Layout**
  - Match design mockup
  - Proper spacing and alignment
  - Visual clarity of merge widget
  - Responsive design

- [ ] **Error messaging**
  - Clear messages for failed merges
  - Helpful suggestions for configuration
  - Conflict warnings

- [ ] **User guidance**
  - Tooltips on settings (Max Time Gap, Text Smoothing, etc.)
  - Help text explaining confidence levels
  - Usage examples

---

## Blocking Dependencies

- [ ] AI Command Panel foundation (shared infrastructure)
- [ ] Segment merge service must support batching
- [ ] Zustand store structure for results management

---

## Known Issues / Risks

- **Overlapping Merges**: If merge is suggested for consecutive pairs (5-6, 6-7), need to handle carefully to avoid unintended three-way merge
- **Text Smoothing Accuracy**: Grammar fixes between segments may introduce errors → Needs careful testing
- **Large Transcripts**: Processing 343+ segments with merge suggestions requires efficient UI rendering
- **Timestamp Precision**: Ensure merged segment timestamps are exact (no rounding errors)

---

## Success Criteria for Completion

- [ ] Merge widgets appear between suggested segment pairs
- [ ] Merged text preview displays correctly with highlighting
- [ ] Confidence grouping works as expected
- [ ] Jump-navigation scrolls to correct segment pairs
- [ ] Undo correctly splits merged segments
- [ ] Text smoothing improves natural flow without introducing errors
- [ ] All unit + integration tests pass
- [ ] Manual QA on 343-segment transcript passes
- [ ] No performance issues with large transcripts

---

*Delete this file when feature is complete.*
