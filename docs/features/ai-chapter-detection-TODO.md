# AI Chapter Detection – Implementation TODO

*Created: January 22, 2026*  
*Updated: January 23, 2026 (design locked: `summary`/`notes`/`tags` + Collapsible chapter header + minimal AI context)*  
*Status: Partially Done (manual chapters shipped; AI detection not shipped)*

---

## Phase 1: Foundation & Data Layer

- [x] **1.1 Define Chapter Types**
  - [x] Create `client/src/types/chapter.ts`
  - [x] Define `Chapter` interface (id, title, summary?, notes?, tags?, startSegmentId, endSegmentId, source, createdAt, segmentCount)
  - [x] Define `ChapterSuggestion` extends `Chapter` with `acceptanceStatus` (no confidence field)
  - [x] Add JSDoc comments for all fields
  - [ ] Tests: type integrity, validation helpers (covered indirectly; no dedicated type-level tests)

- [x] **1.2 Create Chapter Store Slice**
  - [x] Create `client/src/lib/store/slices/chapterSlice.ts`
  - [x] Implement state: `chapters: Chapter[]`, `selectedChapterId?: string`
  - [x] Implement actions: `startChapter()`, `updateChapter()`, `deleteChapter()`, `selectChapter()`, `clearChapters()`
  - [x] Implement selectors: `selectAllChapters()`, `selectChapterById()`, `selectChapterForSegment()`, `selectSegmentsInChapter()`
  - [x] Add validation: no overlaps on add/update
  - [x] Tests: >80% coverage for all actions & selectors

- [ ] **1.3 Create AI Chapter Detection Slice**
  - [x] Create `client/src/lib/store/slices/aiChapterDetectionSlice.ts`
  - [x] Define AI detection state fields (processing, suggestions, config)
  - [x] Define `AIChapterDetectionConfig` interface (batchSize, min/max length, tagIds, provider/model, prompts)
  - [ ] Ensure AI detection state is in-memory only (no localStorage/IndexedDB persistence)
  - [x] Implement state & actions (see architecture doc)
  - [x] Tests: basic slice coverage (overlap refusal + accept-all history)

- [x] **1.4 Export & Register Slices**
  - [x] Update `client/src/lib/store/index.ts` to export new slices
  - [x] Verify store integration with existing slices

---

## Phase 2: UI Foundation

- [x] **2.1 Create ChaptersOutlinePanel Component**
  - [x] Create `client/src/components/ChaptersOutlinePanel.tsx`
  - [x] Floating, non-modal outline panel (fixed position, right side)
  - [ ] List all chapters: title + segment range (currently title + optional summary only)
  - [x] Click chapter → jump (select chapter + select start segment + seek)
  - [x] No edit/delete actions in the panel (orientation only)
  - [x] Toggle button (toolbar)
  - [ ] Keyboard shortcut: Outline / TOC
    - [ ] macOS: `Cmd+Shift+O`
    - [ ] Windows/Linux: `Ctrl+Shift+O`
  - [x] Tests: user interactions, store dispatch

- [x] **2.2 Simplify Chapter Header UX**
  - [x] Keep `ChapterHeader` but move all editing inline (title, summary, notes, tags)
  - [x] Title becomes an `<Input>` when focused; Enter/blur commits, Esc cancels
  - [x] Summary and notes expand inline (textarea) only in edit mode
  - [x] Delete action is a compact button directly on the header (edit mode only)
  - [x] Tags are chips with inline remove controls and a local `+` trigger that opens the segment-style tag selector
  - [x] Tests: inline editing, deletion, inline tag management
- [x] **2.3 Segment Menu Integration**
  - [x] “Start Chapter Here” stays inside the segment context menu
  - [x] Action inserts a chapter header, then instantly requests inline title focus with the placeholder selected
  - [x] No popovers: focus is handled via `ChapterHeader` props (e.g., `autoFocus`)
  - [x] Tests: creation + auto-focus behavior, edit-mode gating via `document.body.dataset.transcriptEditing`
- [x] **2.4 TranscriptEditor Integration**
  - [x] Continue rendering headers before the segments that start them
  - [x] Replace `chapterEditTarget` popover state with a minimal inline focus request prop
  - [x] Outline panel toggle/state history remains untouched
  - [x] Tests: chapter rendering + inline focus behavior

---

## Phase 3: Manual Chapter Management

- [x] **3.1 Manual Chapter CRUD**
  - [x] Test: add chapter at segment
  - [x] Test: edit chapter (title, summary, notes, tags, range)
  - [x] Test: delete chapter
  - [x] Test: no overlaps validation
  - [x] Test: segment order validation
  - [x] Verify integration with segment selection/scroll

- [x] **3.2 Undo/Redo Support**
  - [x] Verify chapterSlice actions integrated with undo/redo system
  - [x] Test: add + undo, edit + undo, delete + undo
  - [ ] Test: accept all AI results as single undo entry

- [x] **3.3 Tag System Integration**
  - [x] Verify `Chapter.tags` stores existing `Tag.id` values
  - [x] Inline ChapterHeader tag UI mirrors segment tag picker (chips with remove + local `+` selector)
  - [x] UI displays tags as compact badges in collapsed ChapterHeader
  - [x] Test: assign/change tags

---

## Phase 4: AI Infrastructure

- [ ] **4.1 Create Chapter Detection Feature Config**
  - [x] Create `client/src/lib/ai/features/chapterDetection/config.ts`
  - [ ] Define system prompt
  - [ ] Define user prompt template (with Handlebars variables)
  - [ ] Variables: `maxBatchSize`, `minChapterLength`, `maxChapterLength`, `tagsAvailable`, `segments`, `previousChapter`
  - [ ] Define response schema (Zod validation) using `segmentSimpleIds[]` (or start/end SimpleID), no real segment IDs
  - [ ] Ensure AI response uses `summary` + `tags` (no `notes` generation)
  - [x] Register templates in AI Prompts settings store (persisted) and select via `activePromptId`
  - [x] Align AI output with persisted chapter model (`startSegmentId`/`endSegmentId`)
  - [ ] Tests: prompt compilation with various variables (nice-to-have)

- [ ] **4.2 Chapter Detection Feature Types**
  - [x] Create `client/src/lib/ai/features/chapterDetection/types.ts`
  - [x] Define `ChapterDetectionResponse` interface
  - [x] Define `ChapterContinuation` for overlap logic (optional)
  - [ ] Tests: parsing edge cases (nice-to-have)

- [ ] **4.3 Batch Utilities**
  - [x] Reuse `client/src/lib/ai/core/batchIdMapping.ts` for SimpleID mapping
  - [ ] Implement explicit overlap/continuation batch logic (future improvement)
  - [ ] Implement validation: `validateBatchResults()`
  - [ ] Tests: >90% coverage (batch slicing, overlap, mapping roundtrip)

- [ ] **4.4 Response Parsing & Recovery**
  - [ ] Create `client/src/lib/ai/parsing/chapterResponseParser.ts`
  - [ ] Implement JSON extraction from AI response
  - [ ] Implement schema validation with Zod
  - [ ] Implement recovery strategies (lenient parsing, fallbacks)
  - [ ] Map SimpleIDs → real segment IDs via shared ai/core helpers; no real IDs sent to the model
  - [ ] Tests: >90% coverage (valid responses, partial responses, malformed JSON)

- [ ] **4.5 Feature Service**
  - [ ] Create `client/src/lib/ai/features/chapterDetection/service.ts`
  - [ ] Implement `analyzeChapters()` (single batch)
  - [ ] Implement `analyzeChaptersBatch()` (multi-batch with overlap)
  - [ ] Handle errors, cancellation, progress updates
  - [ ] Tests: >80% coverage

- [ ] **4.6 Feature Registration**
  - [ ] Register feature in `client/src/lib/ai/core/featureRegistry.ts`
  - [ ] Verify `executeFeature()` works with chapter-detection ID
  - [ ] Test: provider resolver, model selection

---

## Phase 5: UI for AI Detection

- [ ] **5.1 Create ChapterDetectionPanel**
  - [ ] Create `client/src/components/AICommandPanel/ChapterDetectionPanel.tsx`
  - [ ] Use standard AI Command Panel layout (Scope → AI Configuration → Feature Settings → Start/Progress → Summary)
  - [ ] Feature Settings:
    - [ ] Prompt Template selector (from Settings → AI Prompts store)
    - [ ] Min/Max chapter length inputs
    - [ ] Tags multi-select
  - [ ] Results summary only in panel (confidence groups + navigation); detailed suggestions render inline in transcript
  - [ ] Tests: configuration, result rendering, user interactions

- [ ] **5.2 Integrate into AICommandPanel**
  - [ ] Add new tab: "Chapters"
  - [ ] Route chapter-detection actions through store
  - [ ] Connect to `aiChapterDetectionSlice`
  - [ ] Ensure keyboard navigation matches AI Command Panel defaults (N/P/A/R/ESC)
  - [ ] Tests: tab rendering, tab switching

- [ ] **5.3 Store Action Handlers**
  - [ ] Implement `aiChapterDetectionSlice.startDetection()`
  - [ ] Hook into service: call `analyzeChaptersBatch()` with progress callbacks
  - [ ] Update state: `isProcessing`, `processedBatches`, `totalBatches`, `suggestions`
  - [ ] Handle errors: set `error` state
  - [ ] Tests: >80% coverage

- [ ] **5.4 Accept/Reject UI Logic**
  - [ ] Implement `onAcceptSuggestion()`: mark as accepted, move to chapterSlice on final accept
  - [ ] Implement `onRejectSuggestion()`: mark as rejected
  - [ ] Implement `onAcceptAll()`: 
    - [ ] Accept all pending suggestions
    - [ ] Batch as single store action (for undo)
    - [ ] Add to chapterSlice
    - [ ] Clear AI suggestions
  - [ ] Tests: state transitions, store integration

---

## Phase 6: Batch Processing & AI Integration

- [ ] **6.1 Full Batch Processing Flow**
  - [ ] Test: create batches from 200-segment transcript
  - [ ] Test: batch with overlap (check last batch context sent)
  - [ ] Test: chapter continuation logic
  - [ ] Test: SimpleID mapping roundtrip
  - [ ] Test: multi-batch detection end-to-end

- [ ] **6.2 AI Call & Response Handling**
  - [ ] Test: chapter detection calls executeBatch() correctly
  - [ ] Test: response parsing with valid chapters
  - [ ] Test: error recovery on malformed response
  - [ ] Test: cancellation mid-batch

- [ ] **6.3 Progress Tracking**
  - [ ] Test: processedBatches, totalBatches updated correctly
  - [ ] Test: UI progress bar reflects state
  - [ ] Test: user sees progress during long detection

---

## Phase 7: Export Integration

- [ ] **7.1 Text Export**
  - [ ] Update `client/src/lib/exportUtils.ts`
  - [ ] Add chapter headers before segment groups
  - [ ] Format: `# Chapter X: Title`
  - [ ] Options: include/exclude summary, notes, tags
  - [ ] Tests: >80% coverage

- [ ] **7.2 JSON Export**
  - [ ] Implement option: "chapter structure" (metadata vs. separate)
  - [ ] Option A: Chapters as metadata in first segment
  - [ ] Option B: Separate top-level chapters structure
  - [ ] Add UI setting for user choice
  - [ ] Tests: >80% coverage (roundtrip, schema validity)

- [ ] **7.3 Export Settings UI**
  - [ ] Add checkboxes to ExportDialog:
    - [ ] "Include chapter summaries"
    - [ ] "Include chapter notes"
    - [ ] "Include chapter tags"
    - [ ] (JSON only) "Chapter structure: Metadata / Separate"
  - [ ] Tests: settings persist, affect export output

---

## Phase 8: Documentation & Polish

- [ ] **8.1 Update Feature Docs**
  - [ ] Verify `docs/features/ai-chapter-detection.md` is complete
  - [ ] Add screenshots/mockups (later if needed)
  - [ ] Verify keyboard shortcuts documented

- [ ] **8.2 Update Architecture Docs**
  - [ ] Verify `docs/features/architecture/ai-chapter-detection-architecture.md` is complete
  - [ ] Update examples if needed

- [ ] **8.3 Update Feature Overview**
  - [ ] Update `docs/features/README.md`
  - [ ] Add chapter detection to feature list
  - [ ] Link to new docs

- [ ] **8.4 Developer Docs**
  - [ ] Add JSDoc comments to all exported functions
  - [ ] Document batch processing algorithm
  - [ ] Document SimpleID mapping mechanism

---

## Phase 9: Testing & QA

- [ ] **9.1 Unit Tests**
  - [ ] Run `npm run test` — verify all >80% coverage
  - [ ] Check specific coverage:
    - [ ] Batch utilities: >90%
    - [ ] Response parsing: >90%
    - [ ] Store slices: >80%

- [ ] **9.2 Integration Tests**
  - [ ] Manual chapter workflow: add → edit → delete
  - [ ] AI detection workflow: configure → detect → accept/reject
  - [ ] Multi-batch detection
  - [ ] Export with chapters

- [ ] **9.3 Manual QA (Desktop)**
  - [ ] Create 200-segment test transcript
  - [ ] Add chapter manually at segment 50
  - [ ] Edit chapter: change title, summary, notes, tags
  - [ ] Delete chapter, undo
  - [ ] Run AI detection:
    - [ ] Verify batches process
    - [ ] Accept all
    - [ ] Verify chapters appear in outline panel + transcript
  - [ ] Export to text: verify chapter headers
  - [ ] Export to JSON: verify metadata/structure

- [ ] **9.4 Edge Cases & Error Handling**
  - [ ] Empty transcript (no chapters)
  - [ ] Very small batch (5 segments)
  - [ ] Very large batch (500+ segments)
  - [ ] Overlapping chapters (should fail validation)
  - [ ] AI timeout / API error (should show error, allow retry)
  - [ ] Cancellation mid-detection
  - [ ] Edit chapter while detection running

- [ ] **9.5 Mobile Responsiveness**
  - [ ] ChaptersOutlinePanel → mobile positioning (non-modal, design tbd)
  - [ ] ChapterDetectionPanel → responsive layout
  - [ ] Segment menu → accessible on mobile

---

## Phase 10: Code Review & Merge

- [ ] **10.1 Code Quality**
  - [ ] Run `npm run check`
  - [ ] Run `npm run lint:fix`
  - [ ] Fix any linting issues

- [ ] **10.2 Final Testing**
  - [ ] `npm test` — all tests pass, coverage >80%
  - [ ] Manual smoke test: full workflow

- [ ] **10.3 PR & Merge**
  - [ ] Create PR with documentation
  - [ ] Verify CI passes
  - [ ] Get code review
  - [ ] Merge to main

---

## Estimated Effort

- Phase 1: 4–6h (types + store)
- Phase 2: 6–8h (UI foundation)
- Phase 3: 3–4h (manual CRUD)
- Phase 4: 8–10h (AI infrastructure)
- Phase 5: 6–8h (detection UI)
- Phase 6: 6–8h (batch processing)
- Phase 7: 4–6h (export)
- Phase 8: 2–3h (docs)
- Phase 9: 5–7h (testing & QA)
- Phase 10: 1–2h (review & merge)

**Total: ~45–65 hours** (depending on complexity & testing depth)

---

## Notes

- Start with Phase 1–3 for basic manual chapter management
- Phases 4–6 add AI automation (can be separate PR if needed)
- Export (Phase 7) needed for full feature completeness
- Testing throughout, not just at end
- Keep manual workflow functional even if AI fails
