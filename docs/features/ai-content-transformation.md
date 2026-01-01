# Content Transformation – User Guide
*Last Updated: January 1, 2026*

---

## Overview

**Content Transformation** helps you export and transform your transcript into different formats: summaries, articles, meeting notes, and more. Start with basic manual exports, or use AI for intelligent transformations.

> 💡 **Manual-First Design:** Basic export templates work without AI. AI transformations are optional enhancements for more sophisticated outputs.

---

## Part A: Manual Export Templates ✅

### Available Formats

| Format | Description | AI Required |
|--------|-------------|-------------|
| **Plain Text** | Clean transcript text | No |
| **Markdown** | Formatted with speakers | No |
| **SRT/VTT** | Subtitle formats | No |
| **JSON** | Full transcript data | No |
| **Summary Template** | Fill-in-the-blank summary | No |
| **AI Summary** | Generated summary | Yes |
| **AI Article** | Blog post format | Yes |
| **AI Q&A** | Question-answer format | Yes |

### Basic Export

**Step 1: Open Export Dialog**
- Click "Export" in toolbar
- Or press **Ctrl+E** (or **Cmd+E** on Mac)

**Step 2: Choose Format**

```
┌─────────────────────────────────────────────────────────────┐
│ Export Transcript                                           │
├─────────────────────────────────────────────────────────────┤
│ Format:                                                     │
│ ● Plain Text                                                │
│ ○ Markdown                                                  │
│ ○ SRT Subtitles                                            │
│ ○ VTT Subtitles                                            │
│ ○ JSON (full data)                                         │
│                                                             │
│ Options:                                                    │
│ ☑ Include speaker labels                                   │
│ ☑ Include timestamps                                       │
│ ☐ Include confidence scores                                │
│                                                             │
│ Scope:                                                      │
│ ● Entire transcript                                         │
│ ○ Selected segments                                         │
│ ○ Chapters: [All ▼]                                        │
│                                                             │
│ [Cancel] [Preview] [Export]                                │
└─────────────────────────────────────────────────────────────┘
```

### Export Formats

**Plain Text:**
```
[00:00.00] Host: Welcome to the show. Today we're discussing AI.

[00:05.30] Guest: Thanks for having me. I'm excited to be here.
```

**Markdown:**
```markdown
# Transcript: AI Discussion

## Participants
- Host
- Guest

---

**[00:00.00] Host:**
Welcome to the show. Today we're discussing AI.

**[00:05.30] Guest:**
Thanks for having me. I'm excited to be here.
```

**SRT Subtitles:**
```
1
00:00:00,000 --> 00:00:05,300
Welcome to the show. Today we're discussing AI.

2
00:00:05,300 --> 00:00:10,500
Thanks for having me. I'm excited to be here.
```

### Manual Summary Template

Create summaries without AI using a fill-in template:

```
┌─────────────────────────────────────────────────────────────┐
│ Manual Summary                                              │
├─────────────────────────────────────────────────────────────┤
│ Title: [____________________________________]              │
│                                                             │
│ Date: [2026-01-01]  Duration: [85 minutes]                │
│                                                             │
│ Participants:                                               │
│ [Auto-filled from transcript]                              │
│ - Host                                                      │
│ - Guest: Dr. Sarah Chen                                    │
│                                                             │
│ Main Topics: (add your notes)                              │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ 1. Introduction to AI in healthcare                    │ │
│ │ 2. Current challenges                                  │ │
│ │ 3. Future predictions                                  │ │
│ └─────────────────────────────────────────────────────────┘ │
│                                                             │
│ Key Takeaways: (add your notes)                            │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ •                                                       │ │
│ │ •                                                       │ │
│ └─────────────────────────────────────────────────────────┘ │
│                                                             │
│ [Cancel] [Export as Markdown]                              │
└─────────────────────────────────────────────────────────────┘
```

### Keyboard Shortcuts (Manual)

| Shortcut | Action |
|----------|--------|
| **Ctrl+E** / **Cmd+E** | Open export dialog |
| **Ctrl+Shift+E** | Quick export (last format) |

---

## Part B: AI Content Transformation 🔄

### Overview

AI can transform your transcript into various formats:

- **Summarization:** Condense to key points
- **Article:** Blog post or news article
- **Meeting Notes:** Action items and decisions
- **Q&A Format:** Question-answer pairs
- **Creative:** Story, screenplay, etc.

> ⚠️ **Requires:** AI provider configured. Uses transcript content to generate new text.

### Using AI Transformation

**Step 1: Open AI Transform Panel**
- Click "AI Transform" in toolbar
- Or press **Alt+E** (or **Option+E** on Mac)

**Step 2: Choose Transformation Type**

```
┌─────────────────────────────────────────────────────────────┐
│ AI Content Transformation                                   │
├─────────────────────────────────────────────────────────────┤
│ Transform your transcript into:                            │
│                                                             │
│ SUMMARIZATION                                               │
│ ○ Brief summary (1-2 paragraphs)                           │
│ ○ Detailed summary (500+ words)                            │
│ ○ Key points only (bullet list)                            │
│                                                             │
│ STRUCTURED FORMATS                                          │
│ ○ Meeting notes (decisions + actions)                      │
│ ○ Q&A format                                                │
│ ○ Article/Blog post                                        │
│ ○ Show notes (podcast)                                     │
│                                                             │
│ EXTRACTION                                                  │
│ ○ Action items only                                        │
│ ○ Key quotes                                                │
│ ○ Facts and figures                                        │
│                                                             │
│ CREATIVE                                                    │
│ ○ Narrative story                                          │
│ ○ Social media posts                                       │
│                                                             │
│ Provider: [OpenAI ▼]                                       │
│                                                             │
│ [Cancel] [Generate]                                        │
└─────────────────────────────────────────────────────────────┘
```

**Step 3: Configure Options (varies by type)**

```
┌─────────────────────────────────────────────────────────────┐
│ Article Options                                             │
├─────────────────────────────────────────────────────────────┤
│ Length: ○ Short (500 words) ● Medium (1000) ○ Long (2000) │
│ Style: ○ Journalistic ● Conversational ○ Academic         │
│                                                             │
│ Include:                                                    │
│ ☑ Quotes from speakers                                     │
│ ☑ Section headings                                         │
│ ☐ SEO metadata                                             │
│                                                             │
│ [Back] [Generate]                                          │
└─────────────────────────────────────────────────────────────┘
```

**Step 4: Review and Edit**

```
┌─────────────────────────────────────────────────────────────┐
│ Generated Content                         [Copy] [Export]  │
├─────────────────────────────────────────────────────────────┤
│ # The Future of AI in Healthcare                           │
│                                                             │
│ In a recent conversation, Dr. Sarah Chen shared her        │
│ insights on the rapidly evolving landscape of artificial   │
│ intelligence in medical settings...                        │
│                                                             │
│ ## Key Breakthroughs                                       │
│                                                             │
│ "We've reached an inflection point," Dr. Chen explains.    │
│ "AI diagnostic systems are no longer just research         │
│ projects—they're deployed in clinical settings,            │
│ improving patient outcomes every day."                     │
│                                                             │
│ [... content continues ...]                                │
│                                                             │
│ ──────────────────────────────────────────────────────────│
│ Generated in 8.2 seconds • 1,024 words                    │
│ [Regenerate] [Edit] [Export]                              │
└─────────────────────────────────────────────────────────────┘
```

### Transformation Types

#### Summarization

| Type | Output | Best For |
|------|--------|----------|
| **Brief** | 1-2 paragraphs | Quick overview, social sharing |
| **Detailed** | 500+ words | Documentation, archives |
| **Key Points** | Bullet list | Scanning, action items |

#### Structured Formats

**Meeting Notes:**
```markdown
# Meeting Notes: Project Review
Date: 2026-01-01 | Duration: 45 min

## Decisions Made
- ✓ Proceed with Phase 2 implementation
- ✓ Increase Q1 budget by 15%

## Action Items
- [ ] Sarah: Prepare detailed plan by Feb 15
- [ ] Mike: Schedule follow-up meeting

## Key Discussion Points
- Phase 1 results exceeded expectations
- Risk assessment needed for expansion
```

**Q&A Format:**
```markdown
**Q: What's the biggest challenge in AI healthcare?**

A: The biggest challenge is data privacy. As Dr. Chen noted,
"We're asking patients to trust us with their most sensitive
information, and we must ensure absolute protection."

**Q: When will AI-assisted surgery become common?**

A: Within 5 years, according to current projections...
```

#### Extraction

**Action Items:**
```markdown
## Action Items Extracted

### High Priority
- [ ] Prepare implementation plan (Owner: Sarah, Due: Feb 15)
- [ ] Secure IRB approval (Owner: Mike)

### Follow-up
- [ ] Schedule Q3 review meeting
- [ ] Circulate meeting notes to stakeholders
```

**Key Quotes:**
```markdown
## Notable Quotes

> "We've reached an inflection point where AI systems are
> no longer research projects—they're deployed in clinical
> settings." — Dr. Sarah Chen (12:30)

> "The hybrid approach is most promising: AI handles data
> analysis while humans provide judgment and empathy."
> — Dr. Chen (45:20)
```

### Custom Prompts

For advanced users, create custom transformations:

```
┌─────────────────────────────────────────────────────────────┐
│ Custom Transformation                                       │
├─────────────────────────────────────────────────────────────┤
│ Prompt:                                                     │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ Analyze this transcript and create a SWOT analysis     │ │
│ │ (Strengths, Weaknesses, Opportunities, Threats) for    │ │
│ │ the project being discussed. Format as markdown.       │ │
│ └─────────────────────────────────────────────────────────┘ │
│                                                             │
│ [Save as Template] [Generate]                              │
└─────────────────────────────────────────────────────────────┘
```

### Keyboard Shortcuts (AI)

| Shortcut | Action |
|----------|--------|
| **Alt+E** | Open AI transformation panel |
| **Ctrl+Enter** | Generate with current settings |
| **Ctrl+C** | Copy result |
| **Ctrl+R** | Regenerate |

---

## Comparison: Manual vs AI

| Task | Manual Approach | AI Approach |
|------|-----------------|-------------|
| **Summary** | Fill template with your notes | AI generates from content |
| **Article** | Export + extensive editing | AI generates draft |
| **Meeting Notes** | Use template, add notes | AI extracts decisions/actions |
| **Key Points** | Manually list as you review | AI identifies automatically |

**When to use Manual:**
- You know exactly what you want
- AI would miss context-specific details
- No AI access available
- Critical content requiring human judgment

**When to use AI:**
- First draft is good enough
- Large amount of content
- Standard formats (summaries, articles)
- Time is limited

---

## Best Practices

### For Manual Export

1. **Choose right format:** Match export to use case
2. **Configure options:** Include only needed elements
3. **Preview first:** Check output before saving
4. **Use templates:** Create reusable configurations

### For AI Transformation

1. **Review all output:** AI may miss nuances
2. **Edit the result:** Treat as first draft
3. **Verify quotes:** Check against original transcript
4. **Try different options:** Length, style affect quality
5. **Save good prompts:** Reuse effective custom prompts

---

## Troubleshooting

### AI Output Too Short/Long
- Adjust length setting
- Try different model (GPT-4 often more thorough)
- Use detailed vs brief option

### AI Missing Important Content
- Check transcript quality
- Try different transformation type
- Use custom prompt to focus on specifics

### Export Format Issues
- Verify format options
- Check character encoding
- Try different export format

### Slow Generation
- Use smaller model for quick results
- Reduce scope (select specific chapters)
- Check API rate limits

---

## Privacy & Data

### What's Sent to AI
- Transcript text (for transformation)
- Transformation type and options

### What Stays Local
- Audio files
- Generated content (after creation)
- Your edits to generated content

### Privacy Option
Use Ollama for fully local AI processing.

---

## Examples

### Example 1: Podcast Show Notes

**Input:** 60-minute podcast transcript

**Transformation:** Show Notes format

**Output:**
```markdown
# Episode 42: AI in Healthcare with Dr. Sarah Chen

## Episode Summary
In this episode, we explore the future of AI in healthcare
with renowned researcher Dr. Sarah Chen...

## Topics Covered
- 00:00 - Introduction
- 05:15 - Current state of AI diagnostics
- 18:30 - Ethical considerations
- 35:00 - Future predictions
- 52:00 - Rapid-fire questions

## Key Takeaways
1. AI diagnostic accuracy now matches human experts
2. Privacy remains the biggest challenge
3. Hybrid AI-human approach is most promising

## Resources Mentioned
- Dr. Chen's research paper (link)
- AI diagnostic platform demo (link)

## Connect with Guest
- Twitter: @drsarahchen
- Website: sarahchen.ai
```

### Example 2: Meeting Summary

**Input:** 45-minute team meeting transcript

**Transformation:** Meeting Notes

**Output:**
```markdown
# Project Status Meeting
January 1, 2026 | 45 minutes

## Attendees
- Sarah (Project Lead)
- Mike (Engineering)
- Lisa (Marketing)

## Key Decisions
1. ✓ Launch Phase 2 on February 15
2. ✓ Increase development budget by 15%
3. ✓ Weekly status meetings instead of bi-weekly

## Action Items
| Item | Owner | Due |
|------|-------|-----|
| Implementation plan | Sarah | Feb 1 |
| Team hiring | Mike | Feb 10 |
| Press release draft | Lisa | Feb 5 |

## Notes
- Phase 1 exceeded expectations (+20% vs target)
- Risk: Timeline aggressive but achievable
- Next meeting: January 8, 2026
```

---

## What's Next?

Planned improvements:
- Template library with community contributions
- Multi-language transformation
- Automated regular exports
- Integration with external tools (Notion, etc.)
- Custom output formats

---

*For technical details, see [Architecture](architecture/ai-features-unified.md).*

