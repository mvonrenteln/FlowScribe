# FlowScribe AI Features: Complete Overview
*Last Updated: January 1, 2026*

---

## 🎯 Core Design Principle: Manual-First

> **"Every AI feature must have a fully functional manual alternative."**

This is FlowScribe's most important design principle:

- **Users without AI API access remain fully capable**
- Manual features serve as the foundation
- AI adds convenience, but is never required
- Users learn through manual work, then accelerate with AI

---

## Feature Matrix

| # | Domain | Manual Feature | AI Enhancement | Status |
|---|--------|---------------|----------------|--------|
| 1 | **Text Editing** | Direct segment editing | Transcript Revision | ✅ Both Complete |
| 2 | **Quality Check** | Confidence, Spellcheck, Glossary | Revision suggestions | ✅ Manual, 🔄 AI integrated |
| 3 | **Speaker Labels** | Manual speaker assignment | Speaker Classification | ✅ Both Complete |
| 4 | **Segment Merge** | Select + merge segments | AI Merge Suggestions | ✅ Manual, 📋 AI Planned |
| 5 | **Chapters** | Manual chapter creation | AI Chapter Detection | 📋 Both Planned |
| 6 | **Multi-Track** | Manual track comparison | AI Track Selection | 📋 Both Planned |
| 7 | **Content Export** | Manual templates | AI Transformation | 📋 Both Planned |

---

## Features In-Depth

### 1. Transcript Text Editing ✅

**Manual Foundation:**
- Direct inline text editing in segments
- Undo/Redo history
- Word-level confidence indicators
- Spellcheck integration
- Glossary for consistent terms

**AI Enhancement:** Transcript Revision
- Fix grammar and spelling
- Remove filler words
- Improve clarity
- Custom prompts for domain-specific corrections

**Documentation:** [ai-transcript-revision-guide.md](ai-transcript-revision-guide.md)

---

### 2. Speaker Assignment ✅

**Manual Foundation:**
- Click on segment to change speaker
- Speaker sidebar with quick-select
- Bulk speaker assignment
- Rename speakers globally

**AI Enhancement:** Speaker Classification
- Analyze conversation context
- Suggest speaker labels based on dialogue
- Batch processing for entire transcript
- Works with generic labels (SPEAKER_00, etc.)

**Documentation:** [ai-speaker-classification.md](ai-speaker-classification.md)

---

### 3. Segment Merge 📋

**Manual Foundation:** ✅ Exists
- Select adjacent segments
- Merge via context menu or keyboard shortcut
- Preview merged result
- Undo support

**AI Enhancement:** Merge Suggestions 📋 Planned
- Analyze transcript for merge candidates
- Suggest based on:
  - Same speaker
  - Incomplete sentences
  - Short time gaps
- Confidence-based recommendations
- Batch accept/reject

**Documentation:** [ai-segment-merge-suggestion.md](ai-segment-merge-suggestion.md)

---

### 4. Chapters 📋 Both Planned

**Manual Foundation:** To be implemented first
- Create chapter at current position
- Edit chapter title, summary
- Timeline visualization
- Jump to chapter navigation
- Export as YouTube chapters, Markdown

**AI Enhancement:** Chapter Detection (after manual exists)
- Automatic chapter boundary detection
- Generate titles and summaries
- Configurable granularity
- Review and edit AI suggestions

**Documentation:** [ai-chapter-detection.md](ai-chapter-detection.md)

---

### 5. Multi-Track Merge 📋 Both Planned

**Manual Foundation:** To be implemented first
- Load multiple transcript files
- Side-by-side comparison view
- Time-synchronized display
- Click to select best segment
- Merge selected segments into single transcript

**AI Enhancement:** Track Selection (after manual exists)
- Quality-based recommendations
- Primary speaker detection
- Confidence indicators
- Auto-select with review

**Documentation:** [ai-multi-track-merge.md](ai-multi-track-merge.md)

---

### 6. Content Export 📋 Both Planned

**Manual Foundation:** To be implemented first
- Basic export templates
- Plain text, Markdown, SRT/VTT
- Speaker formatting options
- Manual summary editing

**AI Enhancement:** Content Transformation (after manual exists)
- Summarization (various lengths)
- Q&A extraction
- Article generation
- Meeting minutes
- Custom transformations

**Documentation:** [ai-content-transformation.md](ai-content-transformation.md)

---

## Implementation Roadmap

### Phase 2: Unified AI Service Layer (2 weeks)
Foundation for all AI features. Extract common code, create shared services.

### Phase 3: AI Segment Merge (3 weeks)
Uses existing manual merge. Add AI suggestion layer.

### Phase 4: Chapter Feature (4-5 weeks)
- **4A: Manual Chapters (2-3 weeks)** ← First!
- **4B: AI Detection (2 weeks)**

### Phase 5: Multi-Track Merge (5-7 weeks)
- **5A: Manual Multi-Track (3-4 weeks)** ← First!
- **5B: AI Suggestions (2-3 weeks)**

### Phase 6: Content Transformation (4-6 weeks)
- **6A: Manual Templates (1-2 weeks)** ← First!
- **6B: AI Transformations (3-4 weeks)**

**Total:** 18-23 weeks for all features

---

## Architecture Overview

All AI features share common infrastructure:

```
Feature Modules (chapters, multi-track, etc.)
           ↓
Unified AI Service Layer
           ↓
Provider Adapters (OpenAI, Ollama, Anthropic)
           ↓
AI Providers
```

**Key Components:**
- `AIFeatureService` - Unified entry point
- `PromptBuilder` - Template system
- `ResponseParser` - Typed output handling
- Provider adapters - API abstraction

**Details:** [architecture/ai-features-unified.md](architecture/ai-features-unified.md)

---

## For Users Without AI

FlowScribe is fully functional without AI API access:

| Task | How to do it manually |
|------|----------------------|
| Fix transcript text | Edit segments directly |
| Check quality | Use confidence indicators, spellcheck |
| Assign speakers | Click segment, select speaker |
| Merge segments | Select + merge shortcut |
| Create chapters | Manual chapter editor (coming) |
| Compare tracks | Side-by-side view (coming) |
| Export content | Use export templates (coming) |

AI features are an enhancement, not a requirement.

---

## Common UI Patterns

All AI features use consistent UI patterns:

**Analysis Panel:**
```
┌─────────────────────────────────────────┐
│ Feature Name                            │
├─────────────────────────────────────────┤
│ Scope: ○ All  ● Filtered  ○ Selected   │
│ Provider: [OpenAI ▼]                   │
│ [   ✨ Analyze   ]                     │
└─────────────────────────────────────────┘
```

**Results with Accept/Reject:**
```
┌─────────────────────────────────────────┐
│ Suggestion: Merge segments 12 + 13     │
│ Confidence: 🟢 High                     │
│ [Reject] [Accept]                      │
└─────────────────────────────────────────┘
```

**Progress Tracking:**
```
████████████░░░░░░░░░░░ 60%
Processing 120 / 200 segments...
```

---

## Quick Links

### User Guides
- [Speaker Classification](ai-speaker-classification.md)
- [Transcript Revision](ai-transcript-revision-guide.md)
- [Segment Merge Suggestions](ai-segment-merge-suggestion.md) (Planned)
- [Chapter Detection](ai-chapter-detection.md) (Planned)
- [Multi-Track Merge](ai-multi-track-merge.md) (Planned)
- [Content Transformation](ai-content-transformation.md) (Planned)

### Technical Documentation
- [Unified Architecture](architecture/ai-features-unified.md)

### Settings
- [AI Settings Guide](settings.md)

---

*Last Updated: January 1, 2026*

