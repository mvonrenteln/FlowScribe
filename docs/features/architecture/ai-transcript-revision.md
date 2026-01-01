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
- Testing & migration
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
- **Persistence**: Prompts and provider settings stored in localStorage (migrated from legacy template system).
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

## 11. Migration & Deprecation

- Old template system fully migrated to prompt system.
- All UI and code now use "Prompt" terminology.
- Deprecated code and migration warnings removed.
- Data migration handled on settings load (versioned JSON).

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

- [User Guide: AI Transcript Revision](../ai-transcript-revision-guide.md)
- [Prompt System Refactoring Notes](../prompt-system-refactoring.md)
- [AI Transcript Revision – TODOs](../ai-transcript-revision-todo.md)

---

For questions or contributions, see the repository README or contact the maintainers.
