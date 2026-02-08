
**Summary**

This pull request introduces advanced AI-powered chapter metadata editing features, enabling users to suggest chapter titles, generate summaries, and perform content rewrites directly within the editorial workflow. These new capabilities are designed to streamline chapter refinement, improve metadata quality, and support editorial tasks with customizable AI prompts for each operation.

Alongside these features, the underlying architecture for chapter-related AI operations has been unified to ensure consistent handling and extensibility, but the main focus is on empowering users with new metadata editing tools.


**Key Features**

- **AI-powered Chapter Metadata Editing:**
  - **Suggest Chapter Titles:** Instantly generate alternative chapter titles using AI, with a selection dialog for easy adoption.
  - **Generate and Improve Summaries:** Create or refine concise chapter summaries, with diff views to compare and adopt improvements.
  - **Editorial Notes Generation:** Produce editorial notes based on chapter content, supporting review and annotation workflows.
- **Customizable Prompts:** All chapter operations (title, summary, notes, rewrite) are driven by editable AI prompts, allowing users to tailor the behavior to their editorial needs.
- **Integrated Editorial Workflow:** Metadata editing actions are accessible directly from the chapter header menu, supporting seamless editorial refinement.

**Technical Foundation**

- **Unified Chapter Settings:** All chapter AI settings are now managed under Settings → AI Prompts → Chapters. The previous "Chapter Rewrite" section has been removed.
- **Unified Architecture:** Chapter prompts use a `chapter-detect` prompt type with an `operation` field (`'detection' | 'rewrite' | 'metadata'`), ensuring consistent handling and extensibility for all chapter operations.
- **Store Migration:** Existing `rewriteConfig` and `rewritePrompts` are migrated automatically into the new `aiChapterDetectionConfig` during store hydration/initialization.
- **UI Consolidation:** Prompt template management and editors were centralized into a smaller set of components to reduce duplication and improve discoverability.
- **Service Layer:** A unified router was added to the rewrite service layer to dispatch different chapter operations with operation-specific validation and context handling.

**Technical Changes (Short)**

- **Unified Architecture:** Chapter prompts now use a `chapter-detect` prompt type with an `operation` field (`'detection' | 'rewrite' | 'metadata'`) so detection, rewrite and metadata flows share the same plumbing.
- **Store Migration:** Existing `rewriteConfig` and `rewritePrompts` are migrated automatically into the new `aiChapterDetectionConfig` during store hydration/initialization.
- **UI Consolidation:** Prompt template management and editors were centralized into a smaller set of components to reduce duplication and improve discoverability.
- **Service Layer:** A unified router was added to the rewrite service layer to dispatch different chapter operations with operation-specific validation and context handling.


**Adjust Chapter Boundaries**

This branch also includes improvements to chapter boundary handling:

- Chapter boundaries are now more resilient to downstream edits (merges, splits, AI rewrites), ensuring metadata remains attached to the correct semantic unit.
- Clearer invariants define chapter boundaries (time-range + content-anchor + heuristic score), enabling AI operations to reason about segments consistently.
- UI affordances for boundary adjustments (manual nudge, split/join actions) ensure atomic updates to both the chapter model and dependent metadata.


**Migration & Compatibility**

- During store hydration, legacy `rewriteConfig` and `rewritePrompts` are migrated into the unified `aiChapterDetectionConfig`. Existing user settings are preserved where possible, with fallbacks for partially populated or inconsistent legacy data.
- The old "Chapter Rewrite" settings UI was removed; previously stored user prompts and overrides are migrated into the new unified settings area.


**Verification & Tests**

- Unit tests have been added/adapted to cover:
  - Prompt template compilation
  - Response parsing
  - State updates (migration and metadata flows)
- Manual testing performed:
  - Verified migration of existing settings
  - Exercised all new metadata operations (title suggestions, summaries, notes)
  - Confirmed undo/redo integration for metadata edits
  - Tested with local (Ollama) and cloud (OpenAI) providers
