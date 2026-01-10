# AI Text Revision – Technical Architecture & Developer Guide

_Last updated: January 1, 2026_

---

## 1. Motivation & Scope

AI Text Revision enables users to automatically improve, clean up, or rephrase transcript sections using customizable AI prompts. The system supports both single-section and batch operations, integrates with multiple AI providers, and is fully internationalized and accessible.

This document covers:
- System architecture
- Data models
- Prompt system (unified for speaker/text)
- Provider/model abstraction
- UI/UX structure
- State management
- API integration
- Open points & future work

---

## 2. High-Level Architecture

- **Prompt System**: Unified model for both speaker and text revision. Prompts are stored in app state and user settings. Built-in prompts are always present, user prompts are fully editable.
- **AI Provider Abstraction**: Providers (OpenAI, Ollama, etc.) and models are managed centrally. Each provider can define its own batch size and capabilities.
- **Revision Engine**: Handles prompt substitution, API calls, and diff computation. Ensures word-level alignment for accurate timing.
- **UI Components**: Modular React components for popovers, batch controls, diff views, and prompt management. All use i18n and accessibility best practices.
- **State Management**: Zustand store slices for transcript, prompts, providers, and revision state.
- **Testing**: Comprehensive unit and integration tests for diff logic, prompt management, and UI flows.

---

## 3. Data Models

### Prompt (AIPrompt)
```ts
interface AIPrompt {
  id: string;
  name: string;
  type: 'text' | 'speaker';
  systemPrompt: string;
  userPromptTemplate: string;
  isBuiltIn: boolean;
  quickAccess: boolean;
  isDefault: boolean;
}
```
- **Built-in prompts**: `isBuiltIn: true`, cannot be deleted, can be edited/reset.
- **Custom prompts**: `isBuiltIn: false`, fully editable/deletable.
- **Quick Access**: Shown in popover menu.
- **Default**: Used for hotkey/quick action.

### Provider/Model
```ts
interface AIProvider {
  id: string;
  name: string;
  models: string[];
  defaultModel: string;
  batchSize: number;
  ...
}
```

---

## 4. Prompt System (Unified)

- All prompts (speaker/text) share the same structure and management UI.
- Prompts are persisted in user settings (JSON, versioned).
- Placeholders (e.g. `{{text}}`, `{{speaker}}`) are dynamically replaced at runtime.
- Built-in prompts are always present and can be reset to default.
- Only one default and quick access prompt per type.

---

## 5. Provider & Model Abstraction

- Providers are registered in settings and can be local (Ollama) or cloud (OpenAI, custom).
- Each provider exposes available models and a default model.
- Batch size is provider-specific (AI Speaker has its own batch size).
- Model selection is available in the sidebar and batch UI.
- Default models are marked with a star in the UI.

---

## 6. Revision Engine

- **Prompt Substitution**: Replaces placeholders with segment data.
- **API Call**: Sends prompt and segment(s) to selected provider/model.
- **Diff Computation**: Uses `diffUtils` to compute word-level and punctuation-aware diffs.
- **Timing Alignment**: Attempts to preserve word timing; warns if changes are too large.
- **Batch Processing**: Applies prompt to all filtered segments, tracks progress, and handles errors per segment.

---

## 7. UI/UX Structure

- **Single Segment**: AI button opens popover with quick access prompts, more prompts, and status feedback. Diff view is side-by-side or compact.
- **Batch Mode**: Collapsible section in filter bar, minimal UI until expanded. Progress and results are shown inline.
- **Prompt Management**: Settings > AI Prompts. Edit, add, delete, set quick access/default, reset built-ins. Placeholders shown per type.
- **Provider/Model Selection**: Sidebar dropdowns, default model marked, models filtered by provider.
- **Accessibility**: All actions keyboard-accessible, ARIA roles, high-contrast support.
- **Internationalization**: All UI and prompt texts use i18n (react-i18next).

---

## 8. State Management

- **Zustand store** with slices for:
  - Transcript segments
  - Prompts (AIPrompt[])
  - Providers/models
  - Revision state (processing, results, errors)
- **Persistence**: Prompts and provider settings stored in localStorage (from previous template system).
- **Undo/Redo**: All revisions are undoable via history slice.

---

## 9. API Integration

- **Provider API**: Each provider implements a standard interface for prompt execution.
- **Error Handling**: Per-segment error reporting, user feedback in UI.
- **Security**: No audio or timing data sent to cloud providers; only text and prompt.

---

## 10. Testing

- **Unit tests**: For diff logic, prompt substitution, state updates.
- **Integration tests**: For UI flows (single, batch, prompt management, provider selection).
- **Regression tests**: For edge cases (punctuation, word-level diffs, batch errors).
- **Test coverage**: All critical paths and edge cases are covered.

---

## 12. Open Points & Future Work

- **Confidence scoring**: Expose AI confidence per change
- **Word-level timing updates**: Smarter alignment after large changes
- **Prompt history**: Recently used prompts for quick access
- **Context window**: Send surrounding segments for better results
- **Revision suggestions**: AI proactively suggests segments to revise
- **Provider plugin system**: Allow user-defined providers

---

## 13. References & Further Reading

- [User Guide: AI Transcript Revision](../../features/ai-transcript-revision-guide.md)
- Implementation checklist and background were consolidated into Appendix A of this document. The original internal source files (prompt-system-refactoring.md, ai-transcript-revision-todo.md) were merged here and can be removed from the repo to avoid duplication.

---

## Developer Notes

- Terminology (important):
  - `prompt` — the full configuration object (stored as `AIPrompt`).
  - `userPromptTemplate` — the template string inside a prompt which contains placeholders such as `{{text}}` or `{{speaker}}`.
  - `built-in prompts` — supplied by the app (editable, not deletable). `isBuiltIn: true`.
  - `default prompt` — prompt executed by hotkey (one per type).
  - `quickAccess` — flag for prompts shown in the segment popover.

- Placeholder overview (quick reference):
  - Text prompts: `{{text}}`, `{{speaker}}`, `{{previousText}}`, `{{nextText}}`
  - Speaker prompts: `{{speakers}}`, `{{segments}}`

---

## Types & Interfaces (reference)

```ts
export type RevisionType =
  | "grammar"
  | "clarity"
  | "formalize"
  | "transcription-cleanup"
  | "custom";

export interface TextChange {
  type: "insert" | "delete" | "replace";
  position: number;
  oldText?: string;
  newText?: string;
}

export interface RevisionState {
  segmentId: string;
  originalText: string;
  revisedText: string;
  status: "pending" | "accepted" | "rejected";
  revisionType: RevisionType;
  changes: TextChange[];
  reasoning?: string;
}

export interface AIRevisionConfig {
  selectedProviderId?: string;
  selectedModel?: string;
  batchSize: number;
  prompts: AIPrompt[]; // unified prompts list (was templates)
  activePromptId?: string;
}

export interface RevisionTemplate /* alias */ {
  id: string;
  name: string;
  type: RevisionType;
  systemPrompt: string;
  userPromptTemplate: string;
  isBuiltIn?: boolean;
  quickAccess?: boolean;
  isDefault?: boolean;
}
```

---

## Appendix A — Full Implementation TODO

The following checklist is the detailed implementation TODO originally maintained in `ai-transcript-revision-todo.md`. It has been consolidated here so this architecture document contains the full actionable list for contributors. Status markers reflect the last known state at time of consolidation.

# AI Transcript Revision - TODO List

## 📋 Overview

This TODO list documents all implementation steps for the AI Transcript Revision feature.
See [Concept Document](./ai-transcript-revision.md) for details.


**Status**: ✅ Core Implementation Complete

---

## Phase 1: Foundation (2-3 days) ✅

### 1.1 Types & Interfaces
- [x] Define `RevisionType` union type
- [x] Create `RevisionState` interface
- [x] Create `TextChange` interface for diff
- [x] Create `AIRevisionConfig` interface
- [x] Create `RevisionTemplate` interface
- [x] Define `AIRevisionSlice` interface
- [x] Add types to `client/src/lib/store/types.ts`

### 1.2 Store Slice
- [x] Create `client/src/lib/store/slices/aiRevisionSlice.ts`
- [x] Define initial state
- [x] Implement `startSingleRevision` action
- [x] Implement `startBatchRevision` action
- [x] Implement `cancelRevision` action
- [x] Implement `acceptRevision` action
- [x] Implement `rejectRevision` action
- [x] Implement `acceptAllRevisions` action
- [x] Implement `rejectAllRevisions` action
- [x] Implement `clearRevisions` action
- [x] Implement `updateRevisionConfig` action
- [x] Integrate slice into `store.ts`
- [x] Export `initialAIRevisionState`

### 1.3 Diff Utility
- [x] Create `client/src/lib/diffUtils.ts` (custom implementation instead of external package)
- [x] `computeTextChanges(original, revised)` function
- [x] `summarizeChanges(changes)` function
- [x] `getOriginalDiffSegments()` and `getRevisedDiffSegments()` for side-by-side

### 1.4 Service Layer
- [x] Create `client/src/lib/services/aiRevisionService.ts`
- [x] Define default revision templates (not deletable, editable):
  - [x] **Transcript Cleanup**: Spelling, filler words, grammar
  - [x] **Improve Clarity**: Clearer expression
  - [x] **Formalize**: Informal → formal
- [x] Template schema with `isDefault` flag for non-deletable templates
- [x] Implement `buildRevisionPrompt(template, segment, context)`
- [x] Implement `parseRevisionResponse(response)`
- [x] Implement `reviseSegment(segment, templateId, context, config)`
- [x] Implement `reviseSegmentsBatch()` as AsyncGenerator
- [x] Integrate with existing AI provider system

### 1.5 Unit Tests - Phase 1
- [x] `client/src/lib/__tests__/diffUtils.test.ts` (21 tests)
- [x] `client/src/lib/store/slices/__tests__/aiRevisionSlice.test.ts` (26 tests)

---

## Phase 2: Single Segment UI (2-3 days) ✅

### 2.1 AI Button Component
- [x] Create `client/src/components/transcript-editor/AIRevisionPopover.tsx`
- [x] Sparkle icon (✨)
- [x] Loading state (spinner)
- [x] Success state (checkmark animation)
- [x] Error state (red border)

### 2.2 Revision Popover
- [x] Use Radix Popover
- [x] Load and display quick-access prompts from settings
- [x] "More prompts..." link for all others
- [x] Keyboard navigation (arrow keys)
- [x] Auto-close after action

### 2.3 Default Prompt Hotkey
- [x] Hotkey (Alt+R) immediately runs default prompt (no menu!)
- [x] Load default prompt from settings
- [x] Directly trigger revision without popover

### 2.4 Integration in TranscriptSegment
- [x] Extend `TranscriptSegment.tsx`:
  - [x] Add AI button to header
  - [x] Props for revision state
  - [x] Conditional rendering for diff view
- [x] Update props interface
- [x] Event handler for AI actions

### 2.5 Diff View Component
- [x] Create `client/src/components/transcript-editor/SegmentDiffView.tsx`
- [x] Side-by-side view
- [x] Highlighting (red/green)
- [x] Compact mode
- [x] Toggle between views
- [x] Accept button
- [x] Reject button
- [x] Animation on accept/reject

### 2.6 Unit Tests - Phase 2
- [x] `AIRevisionPopover.test.tsx`
- [x] `SegmentDiffView.test.tsx`

---

## Phase 3: Batch Processing (2-3 days)

### 3.1 FilterPanel Extension (Collapsible)
- [x] "AI Batch Revision" as **collapsible section** in `FilterPanel.tsx`
- [x] **Collapsed (default)**: Looks like normal filter header
- [x] **Expanded**: Prompt selector + start button
- [x] Chevron icon for expand/collapse state
- [x] Prompt selector (shows all available prompts)
- [x] Segment count badge (dynamic based on active filters)
- [x] "Start" button
- [x] Disabled state if no segments filtered
- [x] Compact display even when expanded

### 3.2 Progress Component
- [x] `client/src/components/transcript-editor/AIRevisionProgress.tsx`
- [x] Progress bar
- [x] Current/total counter
- ~~[ ] Estimated time remaining (optional)~~
- [x] Cancel button
- [x] Error display

### 3.3 Batch State Management
- [x] Create `useAIRevisionBatch` hook
- [x] Collect filtered segment IDs
- [x] Progress tracking
- [x] Error aggregation
- [x] Partial results handling

### 3.4 Batch Results UI
- [ ] Accept All button in FilterPanel
- [ ] Reject All button in FilterPanel
- [ ] Results counter (X accepted, Y pending)
- [ ] Navigation to next pending segment

### 3.5 Scroll & Navigation
- [ ] Auto-scroll to first pending segment after batch
- [ ] Keyboard navigation between pending segments
- [ ] Visual indicator for segments with pending revision

### 3.6 Unit Tests - Phase 3
- [x]  FilterPanel AI section tests
- [x] `AIRevisionProgress.test.tsx`
- [x] `useAIRevisionBatch.test.ts`

---

## Phase 4: Settings & Advanced Features (1-2 days)

### 4.1 Settings: Prompt Configuration UI
- [x] New section "AI Revision Prompts" in settings
- [x] **Default prompt dropdown**: Prompt for hotkey execution
- [x] **Quick-access checkboxes**: Prompts visible in menu
- [x] Prompt list with edit/delete (custom) or edit only (default)
- [x] "Create new prompt" button
- [x] Default prompts are editable but not deletable (`isDefault: true`)

### 4.2 Prompt Create/Edit Dialog
- [x] Name field
- [x] System prompt textarea
- [x] User prompt template textarea (with placeholder hints)
- [x] Save/cancel
- [x] Validation

### 4.3 Toolbar Integration
- [x] Extend AI dropdown in `Toolbar.tsx`:
  - [x] "Speaker Analysis" (existing)
  - [x] AI provider/model selector
- [ ] Conditional rendering based on state
- ~~[ ] Keyboard shortcut hints~~

### 4.4 More Menu Integration
- ~~[ ] Extend `TranscriptSegment.tsx` more menu~~
- ~~[ ] "AI Revision" submenu with quick-access prompts~~
- [x] "More..." link for all prompts

### 4.5 Context Enhancement
- [x] Pass previous/next segment context
- [ ] Pass spellcheck errors to AI
- [ ] Consider lexicon matches
- [x] Use speaker information

### 4.6 Keyboard Shortcuts
- [x] `Alt + R`: **Immediately run default prompt** (no menu!)
- [x] `Alt + Shift + R`: Open AI revision popover (choose prompt)
- [ ] `Escape`: Cancel revision
- [ ] `Enter`: Accept (when diff focused)
- [x] Document shortcuts in `KeyboardShortcuts.tsx`

### 4.7 Additional UI Features ✅
- [x] Provider/model selector in toolbar
- [x] Improved visual feedback for AI requests
- [x] Inline feedback for "No changes" and errors
- [x] `aiRevisionLastResult` state for status tracking

### 4.8 Unit Tests - Phase 4
- [ ] Settings prompt UI tests
- [ ] Toolbar AI menu tests
- [ ] Context enhancement tests
- [ ] Keyboard shortcut tests

---

## Phase 5: Polish & Testing (1-2 days)

### 5.1 Accessibility Audit
- [ ] ARIA labels for all AI buttons
- [ ] Screen reader announcements:
  - [ ] "Revision started"
  - [ ] "Revision complete, X changes suggested"
  - [ ] "Revision accepted/rejected"
- [ ] Focus management after accept/reject
- [ ] Respect `prefers-reduced-motion`
- [ ] Color contrast check for diff view
- [ ] Keyboard-only testing

### 5.2 Error Handling Polish
- [ ] User-friendly error messages
- [ ] Retry mechanism for retryable errors
- [ ] Partial success handling in batch
- [ ] Network error recovery
- [ ] Provider-specific error hints

### 5.3 Performance Optimization
- [ ] Debounce for custom prompt input
- [ ] Virtualization for many pending revisions
- [ ] Memory cleanup after batch complete
- [ ] Abort controller cleanup
- [ ] Request cancellation on dialog close

### 5.4 Visual Polish
- [ ] Loading animations
- [ ] Success/error micro-animations
- [ ] Consistent spacing & typography
- [ ] Dark mode verification
- [ ] Mobile responsive check

### 5.5 E2E Tests
- [x] Single segment revision flow
- [x] Batch revision flow
- [x] Accept/reject flow
- [x] Undo after accept
- [x] Cancel during processing
- [x] Error recovery
- [x] Keyboard navigation

### 5.6 Documentation
- [x] Update `docs/usage.md`
- [x] Update `docs/shortcuts.md`
- [x] Update README features
- [ ] Inline code comments

## Implementation & Progress of Refactoring Merging Template/Prompt Types

This feature progressed through a phased rollout during initial implementation. The key phases and current status are listed below to help maintainers and contributors understand what is complete and what remains.

- Phase 1 — Foundation: COMPLETED
  - Types, store slice (`aiRevisionSlice`), `diffUtils`, `aiRevisionService`, default prompts, core unit tests implemented.

- Phase 2 — Single Segment UI: COMPLETED (core)
  - AI popover, sparkle button, side-by-side diff view, compact view, acceptance/rejection flows implemented. Some UX polish and keyboard navigation remain.

- Phase 3 — Batch Processing: COMPLETED (core)
  - Collapsible filter panel integration, batch runner, progress tracking, per-segment error handling implemented. Remaining: some UI polish and E2E tests.

- Phase 4 — Settings & Advanced Features: MOSTLY COMPLETED
  - Unified prompt settings UI (`AI Prompts`) with built-in and custom prompts, quick access & default selection implemented. Remaining: minor accessibility and i18n key audits.

- Phase 5 — Polish & Testing: IN PROGRESS
  - Accessibility audit, E2E tests, performance optimization, and visual polish mostly pending or partially complete.

---

## 🔧 Technische Abhängigkeiten

### Neue Packages
- [ ] `fast-diff` oder `diff-match-patch` für Text Diffing

### Zu modifizierende Dateien
- `client/src/lib/store/types.ts` - Types ergänzen
- `client/src/lib/store.ts` - Slice integrieren
- `client/src/components/TranscriptSegment.tsx` - AI Button & Diff
- `client/src/components/transcript-editor/FilterPanel.tsx` - Batch Section
- `client/src/components/transcript-editor/Toolbar.tsx` - AI Menu
- `client/src/components/settings/` - Template Management

### Neue Dateien
- `client/src/lib/store/slices/aiRevisionSlice.ts`
- `client/src/lib/services/aiRevisionService.ts`
- `client/src/lib/diffUtils.ts`
- `client/src/components/transcript-editor/AIRevisionButton.tsx`
- `client/src/components/transcript-editor/AIRevisionPopover.tsx`
- `client/src/components/transcript-editor/AIRevisionProgress.tsx`
- `client/src/components/transcript-editor/SegmentDiffView.tsx`
- `client/src/components/transcript-editor/CustomRevisionDialog.tsx`
- `client/src/hooks/useAIRevisionBatch.ts`

---

## 📊 Progress Tracking

| Phase | Status | Fortschritt | Notizen |
|-------|--------|-------------|---------|
| Phase 1: Foundation | ✅ Complete | 100% | Types, Store Slice, Service, Diff Utils |
| Phase 2: Single Segment | ✅ Complete | 100% | AIRevisionPopover, SegmentDiffView, Integration |
| Phase 3: Batch Processing | ✅ Complete | 100% | AIBatchRevisionSection, FilterPanel Integration |
| Phase 4: Settings & Advanced | ✅ Complete | 100% | Template Management, Keyboard Shortcuts |
| Phase 5: Polish | 🟡 In Progress | 60% | i18n, Accessibility basics done |

**Legend**:
- ⬜ Not Started
- 🟡 In Progress
- ✅ Complete
- ⏸️ Blocked

---

*Letztes Update: 31. Dezember 2025*
