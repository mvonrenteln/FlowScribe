# AI Chapter Rewrite

*Last Updated: February 3, 2026*

## Overview

**Chapter Rewrite** transforms raw transcript segments into polished, publication-ready text. The AI rewrites chapter content while preserving meaning, improving flow, removing filler words, and formatting for readability. Original transcripts remain unchanged — rewritten text is stored separately and can be viewed, edited, or discarded at any time.

This feature is perfect for creating blog posts, articles, documentation, or any content where you need readable prose instead of verbatim speech transcripts.

---

## Manual-First Design

- **Always optional**: Chapters work fully without rewrite — view and export original transcripts anytime
- **Per-chapter control**: Rewrite individual chapters or skip entirely
- **Easy reversal**: Toggle between original and rewritten views instantly; clear rewrites without affecting transcripts
- **Manual editing**: Edit rewritten text directly in the side-by-side view before accepting

---

## How It Works

### 1. Starting a Rewrite

1. Open the chapter **AI menu** (sparkles icon) in the chapter header
2. Choose a rewrite style from the prompt library:
   - **Blog Post**: Conversational, engaging tone with natural paragraphs
   - **Article**: Structured, professional formatting with clear sections
   - **Documentation**: Technical, precise language with examples highlighted
   - **Custom**: Create your own prompts in Settings
3. Click **"Rewrite Chapter"**

The AI processes the chapter in the background while you continue working.
Active transcript filters (including tag filters and search) are respected, so only visible segments are sent.

### 2. Reviewing Results

The rewrite view opens automatically when processing completes:

- **Side-by-side comparison**: Original transcript (left) vs. rewritten text (right)
- **Live editing**: Click any paragraph to edit rewritten text directly
- **Search highlighting**: Your search terms highlight in both versions
- **Metadata**: See word count, model used, and timestamp

### 3. Accepting or Discarding

- **Accept**: Saves rewritten text to the chapter; toggle display mode in transcript view
- **Discard**: Closes view without saving; original transcript remains
- **Re-rewrite**: Run again with the same prompt; this replaces the previous rewrite

---

## Display Modes

After accepting a rewrite, chapters can display in two modes:

### Original Mode (Default)

- Shows word-by-word transcript segments as usual
- All editing, playback, and timing features work normally
- Rewritten text is hidden but preserved

### Rewritten Mode

- Displays polished text as continuous paragraphs
- Hides individual transcript segments (except chapter header)
- Search, bookmarks, and navigation still work
- Click chapter to toggle back to original

**Toggle via the chapter header rewrite toggle** or use the transcript view switcher.

---

## Rewrite Context

To improve coherence across chapter boundaries, the AI can include context:

- **Previous chapter summary**: Last ~500 words for narrative flow
- **Chapter metadata**: Title, summary, tags (if set)
- **Contextual continuity**: AI maintains consistent tone and style

Configure context settings in **Settings → AI Features → Chapter Rewrite**.

---

## Editing Rewritten Text

### In the Review View (Before Accepting)

1. Click any paragraph in the rewritten column
2. Edit text inline with full Markdown support
3. Changes save automatically when you click outside
4. **Undo/Redo**: Standard shortcuts work (Cmd+Z / Ctrl+Z)

### After Accepting

1. Open chapter header menu → **"Edit Rewrite"**
2. Side-by-side view reopens with accepted text
3. Edit paragraphs as before
4. Click **"Update"** to save changes

---

## Exporting Rewritten Chapters

When exporting transcripts:

1. Open **Export Dialog** (Cmd+E / Ctrl+E)
2. Choose **"Include Rewritten Text"** option
3. Select export format:
   - **Markdown**: Chapters as headings with rewritten paragraphs
   - **Plain Text**: Continuous rewritten prose
   - **JSON**: Both original segments and rewritten text in metadata

Chapters without rewrites export original transcripts automatically.

---

## Rewrite Prompts

### Built-in Prompts

FlowScribe includes three default styles optimized for different use cases:

| Prompt | Best For | Style |
| -------- | ---------- | ------- |
| **Blog Post** | Personal blogs, newsletters | Conversational, engaging, first-person friendly |
| **Article** | Publications, medium.com | Structured sections, professional tone |
| **Documentation** | Tutorials, how-tos, guides | Clear instructions, code examples formatted |

### Custom Prompts

Create your own rewrite styles in **Settings → AI Features → Rewrite**:

1. Click **"Add Custom Prompt"**
2. Name your style (e.g., "Press Release", "Social Media")
3. Write instructions for the AI:
   - Specify tone, format, and structure
   - Include examples or templates
   - Request specific formatting (lists, headings, etc.)
4. Save and select from the rewrite dialog

**Quick Access**: Pin frequently-used prompts to appear in the rewrite dialog dropdown.

---

## Settings Reference

### Context Settings

- **Include context**: Enable/disable previous chapter context (default: enabled)
- **Context word limit**: Max words from previous chapter (default: 500)

### Provider Settings

- **Default provider**: Choose AI service (OpenAI, Anthropic, etc.)
- **Default model**: Select model for rewrite (e.g., GPT-4, Claude Sonnet)
- Override per rewrite in the dialog

### Prompt Management

- **Prompt selection**: Choose a prompt in the rewrite dialog when you start a rewrite
- **Quick access**: Pin frequently-used prompts to appear at the top of the dialog
- **Custom prompts**: Add, edit, or delete your own styles

---

## Performance Notes

- **Processing time**: Typically 5-15 seconds per chapter depending on length and model
- **Background processing**: Continue editing while AI works
- **Cancellation**: Click "Cancel" in the status indicator to abort mid-processing
- **Rate limits**: FlowScribe respects API rate limits; large batches may queue

---

## Tips & Best Practices

### Before Reformulating

- **Clean up speakers**: Assign correct speakers for better context
- **Fix major errors**: Rewrite improves flow but doesn't fix misheard words
- **Set chapter boundaries**: Logical chapters produce better rewrites

### Choosing Prompts

- **Blog Post**: Best for conversational content with personal stories
- **Article**: Choose when you need section headings and formal structure
- **Documentation**: Use for technical content with code or step-by-step instructions

### Editing Rewrites

- **Fix factual errors**: AI may rephrase incorrectly — verify technical details
- **Adjust tone**: Edit paragraphs to match your voice
- **Add transitions**: Insert connective phrases between paragraphs if needed

### Exporting

- **Review first**: Check rewritten text before exporting to final format
- **Toggle views**: Compare original vs. rewritten to ensure accuracy
- **Mix modes**: Export some chapters rewritten, others original

---

## Keyboard Shortcuts

| Action | macOS | Windows/Linux |
| -------- | ------- | --------------- |
| Export transcript | `Cmd+E` | `Ctrl+E` |
| Close rewrite view | `Esc` | `Esc` |
| Save paragraph edit | Click outside or `Cmd+Enter` | Click outside or `Ctrl+Enter` |

---

## Troubleshooting

### Rewrite is too verbose

- Try a different prompt (e.g., switch from Blog to Article)
- Edit custom prompt to request "concise" or "brief" output
- Manually trim paragraphs in the edit view

### Lost context between chapters

- Enable context in Settings if disabled
- Increase context word limit (up to 1000 words)
- Add chapter summaries manually for better AI continuity

### Rewrite doesn't match my style

- Create a custom prompt with examples of your preferred style
- Edit rewritten text paragraph-by-paragraph
- Use "voice" keywords in prompts (e.g., "technical but friendly")

### Processing stuck or slow

- Check AI provider status (API may be experiencing issues)
- Try a faster model (e.g., GPT-3.5 instead of GPT-4)
- Cancel and retry if processing exceeds 30 seconds

---

## Data & Privacy

- **Original transcripts**: Never modified or overwritten by rewrite
- **Rewritten text**: Stored locally in browser storage alongside chapters
- **API requests**: Chapter text sent to chosen AI provider (see provider privacy policies)
- **Context data**: Only adjacent chapter summaries sent; full transcript never uploaded at once

---

## Coming Soon

- **Batch rewrite**: Process all chapters at once with progress tracking
- **Style templates**: Import/export custom prompt libraries
- **Diff view**: Highlight what changed between original and rewritten
- **Version history**: Keep multiple rewrite versions per chapter

---

*Last Updated: February 3, 2026*
