# TODO: AI Command Panel – Batch Text Revision Implementation

**Feature**: Batch Text Revision  
**Related Ticket**: [TICKET_AI_PANEL_REVISION.md](TICKET_AI_PANEL_REVISION.md)  
**Status**: Not Started  

---

## Phase 1: Foundation & Panel Infrastructure

- [x] **Create RevisionPanel wrapper component** (`src/components/AICommandPanel/RevisionPanel.tsx`)
  - Configuration form:
    - Scope display (filtered segments count)
    - Provider selector
    - Model selector
    - Batch size selector
    - Template selector (Fix Grammar, Remove Fillers, Improve Clarity, Custom)
  - Progress display during batch execution
  - Results summary display area

- [ ] **Create side-by-side revision component** (`src/components/transcript-segment/SideBySideRevision.tsx`)
  - Left side: Original text
  - Right side: Revised text
  - Change highlighting:
    - Green background for additions
    - Strikethrough for removals
    - Subtle highlight for formatting changes
  - ✗ Reject and ✓ Accept buttons below
  - Optional reasoning text

- [x] **Update AICommandPanel main component**
  - "Revision" tab (first tab)
  - Tab switching with state preservation
  - Store batch revision results during session

---

## Phase 2: Results Display & Inline Rendering

- [ ] **Create revision results summary component** (`src/components/AICommandPanel/RevisionSummary.tsx`)
  - Collapsible sections: High Confidence / Medium / Low
  - List format: "#045  0:45.2  Preview..."
  - Preview shows first 40-50 characters of revision
  - Click-to-navigate to segment in transcript
  - Confidence percentage display

- [ ] **Integrate side-by-side component into transcript**
  - Update `TranscriptSegment` to display revision when available
  - Replace original text display with side-by-side comparison
  - Maintain segment metadata (speaker, timing)
  - Handle segments without revisions (show normal view)

- [ ] **Create revision results state management**
  - Store revisions in Zustand store
  - Track original text (for undo)
  - Track acceptance/rejection per segment
  - Organize by confidence level
  - Clear results when starting new batch

---

## Phase 3: Change Highlighting & Text Comparison

- [ ] **Implement diff algorithm**
  - Compare original vs revised text character-by-character
  - Identify additions, removals, modifications
  - Handle word-level vs character-level diffing appropriately
  - Preserve whitespace/punctuation semantics

- [ ] **Create change highlighting component**
  - Green background for additions (inserted text)
  - Strikethrough for removals (deleted text)
  - Subtle yellow/gray highlight for modified whitespace/punctuation
  - Optional emphasis for changed case/formatting
  - Preserve original code formatting (quotes, etc.)

- [ ] **Test highlighting with various templates**
  - "Fix Grammar" should highlight grammar/punctuation fixes
  - "Remove Fillers" should show strikethrough on removed fillers (um, uh, like, etc.)
  - "Improve Clarity" should highlight structural/semantic improvements

---

## Phase 4: Template Management

- [ ] **Create template configuration system**
  - Define built-in templates: Fix Grammar, Remove Fillers, Improve Clarity
  - Store prompt text for each template
  - Support custom prompts (extensible)
  - Allow template selection from dropdown

- [ ] **Create custom template UI** (future enhancement, can skip initially)
  - Form to create/edit custom prompts
  - Save custom prompts to storage
  - Load saved custom prompts in dropdown

---

## Phase 5: Keyboard Navigation & UX

- [ ] **Implement keyboard navigation**
  - `N` = Next revision
  - `P` = Previous revision
  - `A` = Accept current revision
  - `R` = Reject current revision
  - `ESC` = Close panel
  - Add shortcuts to help dialog

- [ ] **Add "Show only suggestions" toggle**
  - Filter transcript to show only segments with revisions
  - Keep context segments visible (±1 or 0 depending on scroll)
  - Button in panel

- [ ] **Implement bulk actions**
  - "✓ Accept All High" button (accepts all high-confidence revisions)
  - "✗ Reject All" button (rejects all suggestions)
  - Optional confirmation dialog for bulk operations

---

## Phase 6: Backend Integration

- [ ] **Verify text revision service supports batching**
  - Check `src/lib/ai/features/revision/service.ts`
  - Confirm batch processing API
  - Add batch wrapper if needed

- [ ] **Implement "Exclude Confirmed" filtering**
  - Get confirmed segments from store
  - Filter them from batch scope
  - Display filtered count in panel

- [ ] **Test with AI providers**
  - Ollama Desktop (check if revision service works)
  - OpenAI API
  - Verify response parsing and confidence extraction

- [ ] **Ensure compatibility with inline revision**
  - Inline ✨ revision feature still works independently
  - No conflicts between inline and batch modes
  - Both can coexist in UI

---

## Phase 7: Undo/Redo & Persistence

- [ ] **Integrate with Undo/Redo system**
  - Track accepted revisions
  - Store original text for undo
  - Allow undo of accepted revisions (restore to original)
  - Support redo of undone revisions

- [ ] **Persist revisions to transcript**
  - Save accepted revisions to transcript data
  - Ensure data consistency across saves
  - Handle conflicts with concurrent manual edits

- [ ] **Revision history**
  - Optionally track what was revised when
  - Store for potential audit/comparison

---

## Phase 8: Testing

- [ ] **Unit tests**
  - Diff algorithm (additions, removals, unchanged)
  - Change highlighting logic
  - Confidence grouping
  - Template selection logic
  - Filter logic (Exclude Confirmed)

- [ ] **Component tests**
  - Side-by-side revision rendering
  - Change highlighting (green/strikethrough/highlight)
  - Accept/Reject buttons
  - Results summary collapsing
  - Keyboard shortcut handling

- [ ] **Integration tests**
  - Full batch flow: start → process → show results → accept/reject
  - Undo functionality (restore original text)
  - Redo functionality
  - Filter interactions
  - Inline revision still works

- [ ] **Manual QA**
  - Test with 100-segment transcript (quick smoke test)
  - Test with 343-segment real transcript
  - Verify UI doesn't freeze during processing
  - Check revision quality (spot-check 20+ revisions)
  - Verify change highlighting is clear and accurate
  - Test undo on 5-10 revisions

---

## Phase 9: Polish & Documentation

- [ ] **Styling & Layout**
  - Side-by-side layout at 50-55% width (verified by design)
  - Color scheme for highlighting (green, strikethrough, yellow)
  - Responsive sizing for different screen widths
  - Dark mode support

- [ ] **Error messaging**
  - Clear messages for failed revisions
  - Helpful configuration suggestions
  - Conflict warnings if transcript modified during batch

- [ ] **User guidance**
  - Tooltips on settings (Template selector, batch size, etc.)
  - Help text explaining confidence levels
  - Explanation of change highlighting colors
  - Usage examples

- [ ] **Performance optimization**
  - Lazy-load revisions only for visible segments
  - Virtualize long transcript (if not already done)
  - Test performance with 343+ segments

---

## Blocking Dependencies

- [ ] AI Command Panel foundation (shared infrastructure)
- [ ] Text revision service must support batching
- [ ] Zustand store structure for results management
- [ ] Inline revision component must not conflict with batch mode

---

## Known Issues / Risks

- **Service Batching**: Text revision service may not support batching currently → May need refactoring
- **Diff Algorithm**: Different revision types (grammar vs clarity) produce different diffs → Highlighting may be ambiguous without context
- **UI Performance**: Rendering 343+ segments with side-by-side comparison requires efficient rendering and virtualization
- **Change Clarity**: For some revisions, highlighting may not clearly show the improvement (e.g., reordered words)

---

## Success Criteria for Completion

- [ ] Batch revision panel displays with all configuration options
- [ ] Revisions appear side-by-side in transcript with clear change highlighting
- [ ] Confidence grouping works correctly
- [ ] Jump-navigation jumps to correct segments
- [ ] Keyboard shortcuts don't conflict with existing ones
- [ ] Undo completely restores original text (character-perfect)
- [ ] UI responsive during processing (no freezing on 343-segment transcript)
- [ ] All unit + integration tests pass
- [ ] Manual QA on 343-segment transcript passes
- [ ] Revision quality acceptable (90%+ of revisions improve transcript)
- [ ] Inline revision feature still works
- [ ] No performance regressions

---

*Delete this file when feature is complete.*
