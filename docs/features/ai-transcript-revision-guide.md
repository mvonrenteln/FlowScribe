# AI Transcript Revision – User Guide
*Last Updated: January 1, 2026*

> NOTE: This user guide consolidates and replaces content previously found in the following internal documents: `ai-transcript-revision.md`, `ai-transcript-revision-todo.md`, and `prompt-system-refactoring.md`. All user-facing guidance, workflows, keyboard shortcuts, examples and troubleshooting tips from those sources have been reviewed and integrated here.

---

## Overview

**AI Transcript Revision** uses large language models (LLMs) to intelligently revise, correct, and improve transcript segments. Unlike manual editing, the AI can fix grammar, improve clarity, remove filler words, and adapt style — all while understanding the context of your transcript.

This feature integrates seamlessly into the FlowScribe UI:
- **Inline AI button** on each segment for quick revisions
- **Batch processing** through the filter panel for bulk operations
- **Customizable prompts** for your specific workflows

---

## Key Features

### ✨ Single Segment Revision
Click the AI sparkle icon on any segment to instantly improve it with one of your configured prompts.

### 📋 Batch Processing
Filter segments by speaker, confidence, or spelling issues, then revise them all at once.

### 🎯 Prompt System: Custom First
Start with three built-in prompts, then create your own for your specific needs:
- **Transcript Cleanup**: Fix spelling, remove filler words, correct grammar
- **Improve Clarity**: Better phrasing, improved readability
- **Formalize**: Convert informal speech to professional language

### 📊 Side-by-Side Diff View
Review changes with a clear visual comparison showing what was removed and what was added.

---

## Getting Started

### Prerequisites

Before using AI Transcript Revision, you need:
1. **An AI provider configured** in Settings → AI Providers
2. **At least one revision prompt** (built-in prompts are available by default)

### Quick Start

1. **Load a transcript** into FlowScribe
2. **Click the ✨ icon** on any segment
3. **Select a prompt** from the quick-access menu
4. **Review the changes** in the side-by-side diff view
5. **Accept or reject** the revision

---

## Single Segment Revision

### Using the AI Button

Each transcript segment has an AI revision button (✨) in its header:

```
┌─────────────────────────────────────────────────────────────┐
│ [00:15.30] SPEAKER_01                        [⋮] [✨] [✓]  │
├─────────────────────────────────────────────────────────────┤
│ The player says that he wants to attack the dragon with    │
│ his sword and hopes that he hits.                          │
└─────────────────────────────────────────────────────────────┘
```

### Quick-Access Menu

Clicking the AI button opens a popover with your configured quick-access prompts:

```
┌────────────────────────────────┐
│ ✨ Transcript Cleanup          │ ← Quick-access prompts
│ 📝 Improve Clarity             │   (configured in Settings)
│ 🎭 RPG Style (Custom)          │
│ ─────────────────────────────  │
│ ⋯ More prompts...            │ ← All other prompts
└────────────────────────────────┘
```

### Keyboard Shortcut

Press **Alt+R** (Windows/Linux) or **Option+R** (Mac) to instantly execute your **default prompt** on the selected segment — no menu required!

### Processing States

The AI button shows the current status:

| Icon | State |
|------|-------|
| ✨ | Ready for revision |
| 🔄 | Processing... |
| ✓ | Suggestion available |
| − | No changes needed |
| ⚠ | Error occurred |

---

## Reviewing Changes

### Side-by-Side Diff View

When a revision is ready, the segment displays a side-by-side comparison:

```
┌─────────────────────────────────────────────────────────────────────────┐
│                                          [Show compact] [✗ Reject] [✓] │
├──────────────────────────────────┬──────────────────────────────────────┤
│ ORIGINAL                         │ REVISED                              │
├──────────────────────────────────┼──────────────────────────────────────┤
│ The player says [that] he wants  │ The player says he wants to attack  │
│ to attack the dragon with his    │ the dragon with his sword and hopes │
│ sword and hopes [that] he hits.  │ to hit.                             │
└──────────────────────────────────┴──────────────────────────────────────┘
```

**Color Coding:**
- 🟥 **Red with strikethrough**: Text that was removed/changed
- 🟩 **Green highlight**: New or modified text

### Compact View

Click "Show compact" to see just the revised text with a change summary:

```
┌─────────────────────────────────────────────────────────────────────────┐
│ The player says he wants to attack the dragon with his sword and hopes │
│ to hit.                                                                 │
│                                                                         │
│ 💡 2 changes: Removed filler words, simplified ending                   │
└─────────────────────────────────────────────────────────────────────────┘
```

### Accept or Reject

- **Accept (✓)**: Applies the revision to your transcript (can be undone with Ctrl+Z)
- **Reject (✗)**: Discards the suggestion and keeps the original text

---

## Batch Processing

### Overview

Process multiple segments at once using the **AI Batch Revision** section in the filter panel.

### Step-by-Step

1. **Set your filters** in the sidebar to select segments:
   - Filter by speaker
   - Only low confidence segments
   - Only segments with spelling issues
   - Only unconfirmed segments

2. **Expand the AI Batch Revision section** (collapsed by default)

3. **Configure the batch operation**:
   - Select provider and model (optional, uses defaults)
   - Choose a prompt
   - See how many segments will be processed

4. **Click "Start"** to begin processing

5. **Review results** as they appear in the transcript

### Batch Controls

```
┌─────────────────────────────────┐
│ ▼ AI Batch Revision             │
│   ┌─────────────────────────────│
│   │ Provider: [OpenAI      ▼]   │
│   │ Model:    [gpt-4       ▼]   │
│   │ Prompt: [Cleanup     ▼]   │
│   │                             │
│   │ 23 segments (filtered)      │
│   │                             │
│   │ [    ✨ Start    ]          │
│   └─────────────────────────────│
└─────────────────────────────────┘
```

### Progress Tracking

During processing:
- Progress bar shows completion percentage
- Count shows "X / Y segments processed"
- Cancel button stops further processing

### Batch Results

After processing:
```
Revisions: 18 pending, 3 accepted, 2 rejected

[Reject all] [Accept all]

[Clear results]
```

Use **Accept all** or **Reject all** for quick batch decisions, or review each segment individually.

---

## Prompt System

### Philosophy: Custom First

Everyone has unique workflows. While FlowScribe provides sensible defaults, the prompt system is designed for **your specific needs**.

### Built-in Prompts

Three built-in prompts are always available (can be edited but not deleted):

| Prompt | Purpose |
|----------|---------|
| **Transcript Cleanup** | Fix spelling, grammar, remove filler words |
| **Improve Clarity** | Better phrasing, improved readability |
| **Formalize** | Convert casual speech to professional language |

### Creating Custom Prompts

1. Go to **Settings → AI Prompts**
2. Click **"Create new prompt"**
3. Configure your prompt:

```
Prompt Name: [RPG Session Cleanup]
System Prompt: [You are editing a tabletop RPG session transcript. Fix speech errors but preserve character voices and in-game terminology. Keep dice roll references.]
User Prompt Template: [Revise the following transcript segment: {{text}}]
Available placeholders: {{text}}, {{speaker}}
```

### Prompt Configuration

In Settings → AI Prompts, you can configure:

**Hotkey Default (Alt+R)**
Select which prompt executes immediately when you press the hotkey.

**Quick-Access Menu**
Check which prompts appear in the segment's quick-access popover (the first click menu).

**All other prompts** appear under "More prompts..." in the popover.

---

## Settings Configuration

### Accessing Settings

- Click the **⚙️ gear icon** in the toolbar
- Or press **Cmd/Ctrl + ,**
- Navigate to **"AI Prompts"**

### Prompt Management

```
┌─────────────────────────────────────────────────────────────┐
│ AI Revision Prompts                                       │
│ Manage your prompt templates for AI text revision.          │
│ Default prompts can be edited but not deleted.            │
├─────────────────────────────────────────────────────────────┤
│ Hotkey Default (Alt+R):                                     │
│ [▼ Transcript Cleanup                                    ]  │
│ This prompt runs when you press Alt+R.                    │
├─────────────────────────────────────────────────────────────┤
│ DEFAULT PROMPTS                                           │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ ✨ Transcript Cleanup              [Default] [Hotkey]   │ │
│ │ ☑ Show in quick-access menu                      [Edit] │ │
│ └─────────────────────────────────────────────────────────┘ │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ 📝 Improve Clarity                           [Default]  │ │
│ │ ☑ Show in quick-access menu                      [Edit] │ │
│ └─────────────────────────────────────────────────────────┘ │
│ ...                                                         │
├─────────────────────────────────────────────────────────────┤
│ CUSTOM PROMPTS                                            │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ 🎭 RPG Session Cleanup                                  │ │
│ │ ☑ Show in quick-access menu          [Edit] [Delete]   │ │
│ └─────────────────────────────────────────────────────────┘ │
│                                                             │
│ [+ Create new prompt]                                     │
└─────────────────────────────────────────────────────────────┘
```

---

## Best Practices

### Prompt Design

1. **Be specific** in your system prompt about what to change and what to preserve
2. **Include examples** if the AI struggles with your content type
3. **Test on a few segments** before running batch operations
4. **Keep prompts concise** — longer isn't always better

### Workflow Tips

1. **Start with filters** — batch process similar segments together
2. **Review before accepting all** — spot-check a few revisions first
3. **Use Undo freely** — all changes can be reverted with Ctrl+Z
4. **Combine with spellcheck** — let AI handle what spellcheck flags

### Performance

1. **Smaller batches** for long segments (5-8 segments)
2. **Larger batches** for short segments (15-20 segments)
3. **Local models (Ollama)** for privacy and no rate limits
4. **Cloud models (OpenAI)** for highest quality

---

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| **Alt+R** / **Option+R** | Execute default prompt on selected segment |
| **Alt+Shift+R** / **Option+Shift+R** | Open prompt menu |
| **Escape** | Cancel current revision or close popover |
| **Tab** | Navigate between Accept/Reject buttons |
| **Enter** | Activate focused button |

---

## Troubleshooting

### AI Returns Identical Text

**Possible Causes:**
- The text is already correct
- The prompt doesn't clearly specify what to change
- The model doesn't understand the task

**Solutions:**
- Check your prompt's system prompt
- Be more specific about desired changes
- Try a different model or provider

### Revisions Are Too Aggressive

**Problem:** AI changes too much, losing the speaker's voice

**Solutions:**
- Add "preserve the speaker's style" to your system prompt
- Use "Improve Clarity" instead of "Formalize"
- Create a custom prompt with specific constraints

### Small Models & Prompt Language

**Tip:** Small models often follow the prompt language, not the transcript language. Translate your prompts to match your transcript language for best results.

### Slow Processing

**Possible Causes:**
- Large batch size
- Slow AI provider
- Rate limiting

**Solutions:**
- Reduce batch size in Settings
- Use a local Ollama model
- Wait for rate limits to reset

### Connection Errors

**Solutions:**
- Verify your AI provider is configured correctly
- Check API keys are valid
- Test connection in Settings → AI Providers
- For Ollama: ensure `ollama serve` is running

---

## Privacy & Data

### What Gets Sent to AI

- **Transcript text** of selected segments
- **Speaker labels** for context
- **Your prompt template**

### What Stays Local

- **Audio files** — never transmitted
- **Timing information** — not included
- **Other settings** — remain on your device

### Provider Choice

- **Ollama**: All processing happens on your machine
- **OpenAI/Cloud**: Data sent to provider per their privacy policy
- **Custom**: Depends on your configured endpoint

---

## Examples

### Example 1: Podcast Cleanup

**Original:**
> "So, um, basically what we're saying is that, you know, the market is really, really volatile right now and, uh, investors should probably be careful."

**After "Transcript Cleanup":**
> "What we're saying is that the market is very volatile right now, and investors should be careful."

### Example 2: Interview Formalization

**Original:**
> "Yeah I think the project went pretty well we hit most of our goals and stuff."

**After "Formalize":**
> "Yes, I believe the project went well. We achieved most of our objectives."

### Example 3: RPG Session (Custom Template)

**Original:**
> "I'm gonna roll for initiative, nat 20! The goblin doesn't stand a change against my paladin."

**After "RPG Session Cleanup":**
> "I'm going to roll for initiative—natural 20! The goblin doesn't stand a chance against my paladin."

---

## What's Next?

Planned enhancements for future versions:

- **Confidence scoring**: AI rates how confident it is in each change
- **Word-level timing updates**: Automatically adjust timing when text changes
- **Prompt history**: Quick access to recently used custom prompts
- **Context window**: Send surrounding segments for better understanding
- **Revision suggestions**: AI proactively suggests segments to revise

---

*For technical details and implementation, see the [Technical Architecture Document](architecture/ai-transcript-revision.md).*
