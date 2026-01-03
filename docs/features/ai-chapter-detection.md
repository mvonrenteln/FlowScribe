# Chapters Feature – User Guide
*Last Updated: January 1, 2026*

---

## Overview

The **Chapters Feature** helps you organize long transcripts into logical sections. Create chapters manually or let AI detect them automatically. Either way, chapters make navigation, editing, and exporting much easier.

> 💡 **Manual-First Design:** You can create, edit, and manage chapters entirely without AI. The AI enhancement is optional and builds on the manual feature.

---

## Part A: Manual Chapters ✅

### What You Can Do

- **Create chapters** at any point in the transcript
- **Edit chapter metadata:** title, summary, key points
- **Adjust boundaries:** move chapter start/end times
- **Navigate:** jump to any chapter instantly
- **Export:** YouTube chapters, Markdown, JSON

### Creating a Chapter

**Method 1: Context Menu**
1. Right-click on any segment
2. Select "Create Chapter Here"
3. Enter chapter title

**Method 2: Timeline**
1. Click the "+" button in the chapter timeline
2. Drag to position
3. Enter chapter title

**Method 3: Keyboard**
1. Position cursor at desired segment
2. Press **Alt+Shift+C** (or **Option+Shift+C** on Mac)
3. Enter chapter title

### Editing Chapters

Click any chapter to edit:

```
┌─────────────────────────────────────────────────────────────┐
│ Edit Chapter                                                │
├─────────────────────────────────────────────────────────────┤
│ Title:                                                      │
│ [Introduction to Machine Learning________________]         │
│                                                             │
│ Summary: (optional)                                         │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ Overview of ML fundamentals and why it matters...      │ │
│ └─────────────────────────────────────────────────────────┘ │
│                                                             │
│ Key Points: (optional, one per line)                       │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ What is machine learning                               │ │
│ │ Supervised vs unsupervised                             │ │
│ │ Real-world applications                                │ │
│ └─────────────────────────────────────────────────────────┘ │
│                                                             │
│ Time Range:                                                 │
│ Start: [00:00:00] End: [00:10:15]                         │
│                                                             │
│ [Delete Chapter] [Cancel] [Save]                          │
└─────────────────────────────────────────────────────────────┘
```

### Chapter Timeline View

```
┌─────────────────────────────────────────────────────────────┐
│ Chapters (4)                                   [+ Add] [⚙] │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│ 00:00 ████████████████ 1. Introduction                     │
│ 10:15 ████████████████████ 2. Core Concepts                │
│ 25:30 ████████████████████████ 3. Practical Examples      │
│ 45:00 ████████████ 4. Q&A and Wrap-up                     │
│                                                             │
│ Click chapter to edit • Drag edges to adjust              │
└─────────────────────────────────────────────────────────────┘
```

### Inline Chapter Markers

Chapters appear as dividers in the transcript:

```
═══════════════════════════════════════════════════════════════
📖 CHAPTER 2: Core Concepts
10:15 - 25:30 • 68 segments
[Jump to Start] [Edit] [⋮]
═══════════════════════════════════════════════════════════════

[10:15.00] Host                                         [⋮]
Now let's dive into the core concepts of machine learning.
```

### Chapter Navigation

- **Chapter List Panel:** Click any chapter to jump to it
- **Keyboard:** Press **[** for previous chapter, **]** for next
- **Jump Dialog:** Press **Ctrl+J** to open chapter selector
- **Minimap:** Chapters shown as colored regions

### Export Formats

**YouTube Chapters:**
```
0:00 Introduction
10:15 Core Concepts
25:30 Practical Examples
45:00 Q&A and Wrap-up
```

**Markdown:**
```markdown
## Table of Contents

### Chapter 1: Introduction (0:00 - 10:15)
Overview of ML fundamentals...

**Key Points:**
- What is machine learning
- Why it matters
```

**JSON:**
```json
{
  "chapters": [
    {
      "title": "Introduction",
      "startTime": 0.0,
      "endTime": 615.0,
      "summary": "...",
      "keyPoints": ["..."]
    }
  ]
}
```

### Keyboard Shortcuts (Manual Chapters)

| Shortcut | Action |
|----------|--------|
| **Alt+Shift+C** | Create chapter at cursor |
| **[** | Jump to previous chapter |
| **]** | Jump to next chapter |
| **Ctrl+J** | Open chapter jump dialog |
| **E** (in chapter panel) | Edit selected chapter |
| **Delete** (in chapter panel) | Delete selected chapter |

---

## Part B: AI Chapter Detection 🔄

### Overview

AI Chapter Detection automatically identifies logical sections in your transcript based on:

- Topic shifts
- Speaker changes
- Content structure
- Semantic coherence

> ⚠️ **Requires:** Manual chapter feature as foundation. AI suggestions use the same chapter data structure and become manual chapters once accepted.

### Using AI Detection

**Step 1: Open AI Panel**
- Click "AI Detect Chapters" button, or
- Press **Alt+C** (or **Option+C** on Mac)

**Step 2: Configure Options**

```
┌─────────────────────────────────────────────────────────────┐
│ AI Chapter Detection                                        │
├─────────────────────────────────────────────────────────────┤
│ Analyze transcript to identify chapter boundaries.          │
│                                                             │
│ Granularity:                                                │
│ ○ Coarse (3-5 chapters per hour)                           │
│ ● Medium (6-10 chapters per hour)                          │
│ ○ Fine (10+ chapters per hour)                             │
│                                                             │
│ Options:                                                    │
│ ☑ Generate summaries for each chapter                      │
│ ☑ Extract key points                                        │
│ ☐ Keep existing chapters (merge mode)                      │
│                                                             │
│ Provider: [OpenAI          ▼]                              │
│ Model:    [gpt-4           ▼]                              │
│                                                             │
│ [    ✨ Detect Chapters    ]                              │
└─────────────────────────────────────────────────────────────┘
```

**Step 3: Review AI Suggestions**

```
┌─────────────────────────────────────────────────────────────┐
│ Detected Chapters (7)                    [Accept All]      │
├─────────────────────────────────────────────────────────────┤
│ ☑ 1. Introduction (00:00 - 10:15)                         │
│   "Overview of today's topic..."                           │
│                                                             │
│ ☑ 2. Core Concepts (10:15 - 25:30)                        │
│   "Deep dive into fundamentals..."                         │
│   [Edit] [Reject]                                          │
│                                                             │
│ ☑ 3. Practical Examples (25:30 - 45:00)                   │
│   ...                                                       │
│                                                             │
│ [Cancel] [Accept Selected]                                 │
└─────────────────────────────────────────────────────────────┘
```

**Step 4: Accept and Edit**
- Accepted chapters become regular manual chapters
- Edit titles, summaries, boundaries as needed
- Add or remove chapters manually

### Granularity Options

| Level | Chapters/Hour | Best For |
|-------|---------------|----------|
| **Coarse** | 3-5 | High-level overview, short content |
| **Medium** | 6-10 | Balanced navigation, podcasts |
| **Fine** | 10+ | Detailed breakdown, lectures, tutorials |

### Keyboard Shortcuts (AI Detection)

| Shortcut | Action |
|----------|--------|
| **Alt+C** | Open AI chapter detection panel |
| **Enter** | Accept all suggestions |
| **Space** | Toggle current suggestion |
| **E** | Edit current suggestion |
| **Escape** | Cancel/close panel |

---

## Best Practices

### For Manual Chapters

1. **Start with outline:** If you know the structure, create chapters first
2. **Use meaningful titles:** Keep titles short but descriptive (3-6 words)
3. **Add summaries later:** Titles first, summaries when reviewing
4. **Check boundaries:** Ensure chapters start at natural breaks

### For AI Detection

1. **Clean transcript first:** Fix major errors before detection
2. **Start with Medium:** Adjust granularity based on results
3. **Review all:** AI is a starting point, not final
4. **Edit titles:** AI titles may be generic, personalize them
5. **Combine approaches:** AI detect, then manual refinement

### General Tips

- **Long content needs chapters:** Anything > 20 minutes benefits
- **Export early:** Verify chapters make sense by previewing exports
- **Consistent style:** Use similar title formats throughout

---

## Troubleshooting

### AI Detects Too Many Chapters
- Switch to "Coarse" granularity
- Increase minimum chapter duration in settings
- Merge closely related chapters manually

### AI Detects Too Few Chapters
- Switch to "Fine" granularity
- Check if transcript has clear topic shifts
- Add manual chapters where AI missed

### Chapters Don't Align with Content
- Adjust chapter boundaries by dragging in timeline
- AI uses text content, not audio analysis
- Manual fine-tuning is expected

### Export Shows Wrong Times
- Check that chapter start times match segment times
- Verify no overlapping chapters
- Round times to nearest second for YouTube

---

## Privacy & Data

### What's Sent to AI
- Transcript text (for analysis)
- Metadata: timestamps, segment count
- Configuration: granularity setting

### What Stays Local
- Audio files (never sent)
- Your edits to chapter metadata
- Export files

### Privacy Option
Use Ollama for fully local AI processing.

---

## Examples

### Example 1: Podcast Episode

**Before:** 85 minutes of continuous transcript

**After (AI Detected, Medium):**
1. 🎬 Cold Open (0:00 - 1:30)
2. 👋 Introduction (1:30 - 5:15)
3. 🎯 Main Topic: AI in Healthcare (5:15 - 32:00)
4. 💬 Interview with Dr. Smith (32:00 - 58:30)
5. 🤔 Discussion & Analysis (58:30 - 72:15)
6. 📧 Listener Questions (72:15 - 80:00)
7. 👋 Wrap-up & Next Week (80:00 - 85:00)

### Example 2: Technical Lecture

**Manually Created:**
1. Course Overview
2. Previous Lecture Review
3. New Topic: Sorting Algorithms
4. Bubble Sort Deep Dive
5. Quick Sort vs Merge Sort
6. Performance Comparison
7. Practice Problems
8. Homework Assignment

---

## What's Next?

Planned improvements:
- Chapter templates (recurring chapter structures)
- Thumbnail extraction for chapters
- Chapter search and filtering
- Nested chapters (sub-sections)
- Chapter-based transcript selection

---

*For technical details, see [Architecture](architecture/ai-features-unified.md).*

