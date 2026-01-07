# TODO: AI Command Panel – Speaker Classification Implementation

**Feature**: Speaker Classification (Batch)  
**Related Ticket**: [TICKET_AI_PANEL_SPEAKER.md](TICKET_AI_PANEL_SPEAKER.md)  
**Status**: Not Started  

---

## Phase 1: Foundation & Panel Infrastructure

- [ ] **Create SpeakerPanel wrapper component** (`src/components/AICommandPanel/SpeakerPanel.tsx`)
  - Houses configuration form (scope, provider, model, template selector)
  - Connect to batch processing service
  - Display progress when running
  
- [ ] **Create inline suggestion box component** (`src/components/transcript-segment/SpeakerSuggestionBox.tsx`)
  - Displays: Speaker name + confidence % + reasoning
  - Renders above segment
  - Has ✓ Accept and ✗ Reject buttons
  - Connected to segment state

- [ ] **Update AICommandPanel main component**
  - Add "Speaker" tab alongside "Revision" and "Merge"
  - Tab switching logic
  - Store active results during session

---

## Phase 2: Results Display & Inline Rendering

- [ ] **Create results summary component** (`src/components/AICommandPanel/ResultsSummary.tsx`)
  - Collapsible sections: High/Medium/Low confidence
  - List format: "#045  0:45.2  Marc → GM  95%"
  - Click-to-navigate functionality (scrolls to segment)
  
- [ ] **Integrate suggestion boxes into transcript segments**
  - Update `TranscriptSegment` to optionally render `SpeakerSuggestionBox` above text
  - Conditional rendering based on whether suggestion exists
  - Styling to match design mockup

- [ ] **Create results storage/state management**
  - Store speaker suggestions in Zustand store
  - Track acceptance/rejection state
  - Organize by confidence level
  - Clear results when starting new batch

---

## Phase 3: Keyboard Navigation & UX

- [ ] **Implement keyboard navigation**
  - `N` = Next suggestion
  - `P` = Previous suggestion
  - `A` = Accept current
  - `R` = Reject current
  - `ESC` = Close panel
  - Add shortcuts to help dialog

- [ ] **Add "Show only suggestions" toggle**
  - Filter transcript to show only segments with suggestions
  - Keep context segments (±1) visible
  - Button in panel or transcript view

- [ ] **Implement bulk actions**
  - "✓ Accept All High" button
  - "✗ Reject All" button
  - Confirmation dialog for bulk operations

---

## Phase 4: Backend Integration

- [ ] **Adapt speaker classification service for batch mode**
  - Check if `src/lib/ai/features/speaker/service.ts` supports batching
  - Add batch processing wrapper if needed
  - Handle errors and retries

- [ ] **Implement "Exclude Confirmed" filtering**
  - Get list of confirmed segments from store
  - Filter them from scope before sending to AI
  - Display filtered count in panel

- [ ] **Test with real AI providers**
  - Test with Ollama Desktop
  - Test with OpenAI API
  - Verify confidence score extraction from responses

---

## Phase 5: Undo/Redo & Persistence

- [ ] **Integrate with Undo/Redo system**
  - Track speaker changes made by accepting suggestions
  - Allow undo of accepted suggestions
  - Update redo history

- [ ] **Persist speaker assignments**
  - Save accepted suggestions to transcript data
  - Ensure data consistency across saves
  - Handle conflicts if manual edits happen during batch

---

## Phase 6: Testing

- [ ] **Unit tests**
  - Confidence grouping logic
  - Navigation index calculation
  - Filter logic (Exclude Confirmed)
  
- [ ] **Component tests**
  - Suggestion box rendering
  - Accept/Reject button functionality
  - Results summary collapsing/expanding
  - Keyboard shortcut handling

- [ ] **Integration tests**
  - Full batch flow: start → process → show results → accept
  - Undo functionality
  - Filter interactions

- [ ] **Manual QA**
  - Test with 100-segment transcript (quick)
  - Test with 343-segment real transcript
  - Verify no UI freezing
  - Check keyboard responsiveness

---

## Phase 7: Polish & Documentation

- [ ] **Fix styling issues**
  - Match design mockup colors and spacing
  - Ensure responsive at different widths
  - Dark mode support

- [ ] **Add explanatory text**
  - Tooltips on settings
  - Help text for template selector
  - Status messages during processing

- [ ] **Update documentation**
  - Add speaker panel to feature overview
  - Document keyboard shortcuts
  - Add usage examples

---

## Blocking Dependencies

- [ ] AI Command Panel foundation (shared infrastructure)
- [ ] Speaker classification service must support batching
- [ ] Zustand store structure for results management

---

## Known Issues / Risks

- **Confidence Score Extraction**: Different AI models return confidence differently (sometimes as percentage, sometimes as 0-1 range) → Need robust parsing
- **Long Transcript Performance**: Processing 343+ segments requires progress updates without UI lag
- **Concurrent Requests**: Ensure batch requests don't overload the AI provider

---

## Success Criteria for Completion

- [ ] All speaker suggestions appear inline in Transcript
- [ ] Confidence grouping works correctly
- [ ] Jump-navigation jumps to correct segments
- [ ] Keyboard shortcuts don't conflict with existing ones
- [ ] All unit + integration tests pass
- [ ] Manual QA on 343-segment transcript passes
- [ ] No performance regressions

---

*Delete this file when feature is complete.*
