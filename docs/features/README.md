# FlowScribe Features Documentation

## 🎯 Core Principle: Manual-First

> **Every feature works fully without AI. AI is an optional enhancement.**

This ensures:
- Users without AI API access remain fully capable
- Manual features serve as foundation for learning
- AI adds convenience, but is never required

---

## Feature Overview

| Feature | Manual | AI Enhancement | Status |
|---------|--------|----------------|--------|
| **Text Editing** | ✅ Direct editing | ✅ Transcript Revision | Complete |
| **Speakers** | ✅ Manual assignment | ✅ Speaker Classification | Complete |
| **Segment Merge** | ✅ Click to merge | 📋 AI Suggestions | Manual ✅, AI planned |
| **Chapters** | 📋 Manual creation | 📋 AI Detection | Both planned |
| **Multi-Track** | 📋 Manual comparison | 📋 AI Selection | Both planned |
| **Export** | 📋 Manual templates | 📋 AI Transformation | Both planned |

---

## Documentation

### Overview
- [**AI Features Overview**](ai-features-overview.md) — Complete feature guide with Manual-First design

### Implemented Features
- [Speaker Classification](ai-speaker-classification.md) — AI-assisted speaker identification
- [Transcript Revision](ai-transcript-revision-guide.md) — AI text correction and improvement

### Planned Features
- [Segment Merge](ai-segment-merge-suggestion.md) — Manual merge + AI suggestions
- [Chapters](ai-chapter-detection.md) — Manual chapters + AI detection
- [Multi-Track Merge](ai-multi-track-merge.md) — Manual comparison + AI selection
- [Content Transformation](ai-content-transformation.md) — Manual export + AI transformation

### Technical Documentation
- [**Unified Architecture**](architecture/ai-features-unified.md) — Implementation guide, patterns, roadmap

### Settings
- [Settings Guide](settings.md) — AI provider configuration

---

## Quick Reference

### Without AI (Always Available)

| Task | How |
|------|-----|
| Edit text | Click segment, type |
| Fix spelling | Spellcheck panel |
| Assign speakers | Click segment, select speaker |
| Merge segments | Select + Ctrl+M |
| Create chapters | Alt+Shift+C (planned) |
| Compare tracks | Load + manual selection (planned) |
| Export | Ctrl+E, choose format |

### With AI (Optional Enhancement)

| Task | How |
|------|-----|
| Auto-fix text | AI Revision panel |
| Identify speakers | AI Speaker Classification |
| Find merge candidates | AI Merge Analysis |
| Detect chapters | AI Chapter Detection |
| Best track selection | AI Track Recommendations |
| Generate summary | AI Content Transformation |

---

## Implementation Roadmap

```
Phase 2: Unified AI Service Layer (2 weeks)
    ↓
Phase 3: AI Merge Suggestions (3 weeks)
    ↓
Phase 4: Chapters (4-5 weeks)
    ├── 4A: Manual chapters (2-3 weeks) ← First!
    └── 4B: AI detection (2 weeks)
    ↓
Phase 5: Multi-Track (5-7 weeks)
    ├── 5A: Manual comparison (3-4 weeks) ← First!
    └── 5B: AI suggestions (2-3 weeks)
    ↓
Phase 6: Content Export (4-6 weeks)
    ├── 6A: Manual templates (1-2 weeks) ← First!
    └── 6B: AI transformation (3-4 weeks)
```

**Total:** 18-23 weeks

---

## Architecture

All AI features share common infrastructure:

```
Feature Modules
      ↓
AI Feature Service (shared)
      ↓
Provider Adapters (OpenAI, Ollama, etc.)
```

See [Architecture Document](architecture/ai-features-unified.md) for details.

---

*Last Updated: January 1, 2026*

