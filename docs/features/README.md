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
| **Segment Merge** | ✅ Click to merge | ✅ AI Suggestions | Complete |
| **Chapters** | ✅ Manual creation | ✅ AI Detection + Reformulation | Complete |
| **Multi-Track** | 📋 Manual comparison | 📋 AI Selection | Planned |
| **Export** | 📋 Manual templates | 📋 AI Transformation | Planned |

---

## Documentation

### User Features
- [**Tags: Flexible Segment Annotations**](tags-system.md) — Color-coded labels for organizing segments

### AI Features Overview
- [**AI Features Overview**](ai-features-overview.md) — Complete feature guide with Manual-First design

### Implemented Features
- [Speaker Classification](ai-speaker-classification.md) — AI-assisted speaker identification
- [Transcript Revision](ai-transcript-revision-guide.md) — AI text correction and improvement
- [Segment Merge](ai-segment-merge-suggestion.md) — Manual merge + AI suggestions
- [**Chapter Reformulation**](ai-chapter-reformulation.md) — Transform transcripts into publication-ready text

### Designed Features (Development Pending)
- [**AI Chapter Detection**](ai-chapter-detection.md) — Manual chapters + AI batch detection
  - [Architecture Details](architecture/ai-chapter-detection-architecture.md)
  - [Implementation TODO](ai-chapter-detection-TODO.md)

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
| Create chapters | Segment menu → Start Chapter Here |
| Compare tracks | Load + manual selection (planned) |
| Export | Ctrl+E, choose format |

### With AI (Optional Enhancement)

| Task | How |
|------|-----|
| Auto-fix text | AI Revision panel |
| Identify speakers | AI Speaker Classification |
| Find merge candidates | AI Merge Analysis |
| Detect chapters | AI Chapter Detection |
| Reformulate chapters | AI Chapter Reformulation |
| Best track selection | AI Track Recommendations |
| Generate summary | AI Content Transformation |

---

*Last Updated: February 3, 2026*
