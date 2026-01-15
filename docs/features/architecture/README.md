# AI Features Documentation

This directory contains architecture and implementation documentation for FlowScribe's features.

## Main Documentation

### 📘 [`ai-features-unified.md`](./ai-features-unified.md) ⭐ **START HERE**

Comprehensive guide to the unified AI architecture including:

- **Core Design Principles** - Manual-first philosophy, architecture patterns
- **Current Implementation** - File structure, module descriptions, test coverage
- **Developer APIs & Patterns** - Logging Service, Recovery Strategies, Validation Rules, Response Processing, Prompt Building
- **Implementation Examples** - How to implement new features using established patterns
- **Feature Matrix** - Overview of current and planned features
- **Roadmap** - Phase descriptions and timeline

All developer APIs, patterns, and implementation guidelines are documented there.

---

## Feature-Specific Architecture

### Tags System

📄 [`tags-implementation.md`](./tags-implementation.md)

Developer reference for the Tags feature including:

- Data model and store API
- Filter logic and predicate
- UI components and interactions
- Keyboard shortcuts (T+1–0)
- Testing strategy
- Integration with persistence and export
- Performance considerations

User guide available at [`../tags-system.md`](../tags-system.md).

### AI Segment Merge

📄 [`ai-segment-merge.md`](./ai-segment-merge.md)

Technical guide for segment merge feature including:

- Manual merge engine and AI analysis service
- Text smoothing system for fixing transcription artifacts
- Response parsing and validation
- State management and UI components
- Testing strategy and extensibility points
- Developer quick start

User guide available at [`../ai-segment-merge-suggestion.md`](../ai-segment-merge-suggestion.md).

### AI Text Revision

📄 [`ai-transcript-revision.md`](./ai-transcript-revision.md)

Technical architecture for text revision feature including:

- Prompt system design (built-in and custom)
- Provider/model abstraction
- Diff computation and timing alignment
- Batch processing workflows
- UI components and accessibility
- State management and testing

---

## Core Architecture

### Player-Transcript Synchronization

📄 [`player-transcript-sync.md`](./player-transcript-sync.md) ⚠️ **IMPORTANT**

Critical documentation for understanding how the WaveformPlayer and TranscriptEditor synchronize:

- State flow between components
- Seek operation types and their implementations
- Why `seekToTime` uses both `setCurrentTime` AND `requestSeek`
- The selection sync effect and why it works
- Common pitfalls that cause navigation bugs
- Performance considerations
- Testing strategy

**Read this before making any changes to seek or selection logic!**

---

## Other References

- **PR Segment Merge Implementation**: [`PR_segment_merge.md`](./PR_segment_merge.md) - Details of the segment merge feature implementation and integration
