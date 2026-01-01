# 🚀 AI Transcript Revision Feature

This PR introduces **AI-powered transcript revision** — a major new feature that lets users intelligently improve their transcript text using LLMs.

## ✨ What's New

### Single Segment Revision
- New **✨ AI button** on each transcript segment
- **One-click access** to revision templates via popover menu
- **Keyboard shortcut** (`Alt+R`) for instant default template execution
- **Side-by-side diff view** showing original vs revised text
- Accept or reject changes with full undo/redo support

### Batch Processing
- **AI Batch Revision section** in the filter panel (collapsible)
- Process all filtered segments at once
- Progress tracking with cancel option
- Accept All / Reject All bulk actions

### Template System (Custom First)
- **3 built-in templates** (Transcript Cleanup, Improve Clarity, Formalize)
- **Custom templates** with full prompt control
- **Settings page** for template management
- Configure which templates appear in quick-access menu
- Set a default template for the keyboard shortcut

## 🎯 Key Features

| Feature | Description |
|---------|-------------|
| **Inline Diff View** | Side-by-side comparison with color-coded changes |
| **Progressive Processing** | See results as they arrive during batch operations |
| **Provider Selection** | Choose provider/model per batch operation |
| **i18n Support** | Full internationalization with `react-i18next` |
| **Accessibility** | Keyboard navigation, ARIA labels, focus management |

## 🏗️ Architecture

### New Store Slice
- `aiRevisionSlice.ts` — State management for revisions
- Pending revisions stored as suggestions until accepted/rejected
- Integration with existing undo/redo history

### New Components
- `AIRevisionPopover` — Quick-access menu on segments
- `SegmentDiffView` — Side-by-side diff visualization
- `AIBatchRevisionSection` — Batch processing UI in sidebar
- `AIRevisionTemplateSettings` — Template management in Settings

### Service Layer
- Uses existing `aiProviderService` for LLM calls
- Template-based prompt generation
- Diff calculation for change visualization

## 📸 Screenshots

### Segment AI Button
The sparkle icon provides quick access to revision templates:
```
┌─────────────────────────────────────────────────────────────┐
│ [00:15.30] SPEAKER_01                        [⋮] [✨] [✓]  │
├─────────────────────────────────────────────────────────────┤
│ The player says that he wants to attack...                  │
└─────────────────────────────────────────────────────────────┘
```

### Side-by-Side Diff
Clear visualization of changes:
```
┌──────────────────────────────────┬──────────────────────────────────────┐
│ ORIGINAL                         │ REVISED                              │
├──────────────────────────────────┼──────────────────────────────────────┤
│ The player says [that] he wants  │ The player says he wants to attack  │
│ to attack...                     │ ...                                  │
└──────────────────────────────────┴──────────────────────────────────────┘
```

## 📝 Documentation

- **User Guide**: `docs/features/ai-transcript-revision-guide.md`
- **Technical Concept**: `docs/features/ai-transcript-revision.md`
- Updated `README.md` with feature highlight
- Updated `docs/usage.md` with quick reference

## 🧪 Testing

- Unit tests for `aiRevisionSlice`
- Unit tests for `diffUtils`
- Component integration covered by existing test infrastructure
- Manual testing across:
  - Single segment revision flow
  - Batch processing with various filters
  - Template CRUD operations
  - Accept/Reject/Undo workflows

## 🔧 Technical Notes

### Internationalization
- Migrated from custom i18n to **react-i18next** (industry standard)
- Translation files: `client/src/translations/en.json`, `de.json`
- All AI revision UI strings are translatable

### Dependencies Added
- `i18next` — Core i18n library
- `react-i18next` — React bindings for i18next

### Breaking Changes
None. Existing functionality is preserved.

## ✅ Checklist

- [x] Feature implementation complete
- [x] Store slice with full CRUD operations
- [x] UI components (popover, diff view, batch section)
- [x] Settings page for template management
- [x] i18n support
- [x] Accessibility considerations
- [x] Unit tests
- [x] User documentation
- [x] README update
- [x] Lint fixes applied

## 🔮 Future Enhancements

- Confidence scoring for AI changes
- Word-level timing updates when text changes
- Prompt history for quick access
- Context window (send surrounding segments)
- Proactive revision suggestions

---

**Related Issues**: N/A (new feature)
**Breaking Changes**: None
**Migration Required**: None

