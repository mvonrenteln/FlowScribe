# Segment Merge – User Guide
*Last Updated: January 4, 2026*

---

## Overview

**Segment Merge** helps you combine fragmented transcript segments into coherent units. Merge manually with a click, or let AI suggest which segments should be combined.

> 💡 **Manual-First Design:** Manual merging is fully functional and has been available since the beginning. AI suggestions are an optional enhancement.

### New: Text Smoothing 🆕

When merging segments, AI can optionally suggest **text smoothing** to fix common Whisper transcription artifacts:

- **Incorrect sentence breaks:** Whisper sometimes adds a period and capitalizes the next word mid-sentence
- **Fragmented punctuation:** Commas or periods at wrong positions
- **Grammatical inconsistencies:** When segments merge, the combined text may need minor adjustments

Text smoothing is optional and shows a preview before applying.

---

## Part A: Manual Segment Merge ✅

### When to Merge

Merge segments when:
- A sentence is split across multiple segments
- Same speaker continues after a brief pause
- Very short segments fragment the flow
- Whisper created artificial breaks

### How to Merge Manually

**Method 1: Select and Merge**
1. Click first segment
2. Shift+Click last segment (selects range)
3. Right-click → "Merge Segments"
4. Or press **Ctrl+M** (or **Cmd+M** on Mac)

**Method 2: Quick Merge**
1. Position cursor in a segment
2. Press **Alt+M** to merge with next segment
3. Repeat for multiple merges

**Method 3: Context Menu**
1. Right-click between two segments
2. Select "Merge with Previous" or "Merge with Next"

### Merge Preview

Before confirming, see the result:

```
┌─────────────────────────────────────────────────────────────┐
│ Merge Preview                                               │
├─────────────────────────────────────────────────────────────┤
│ BEFORE:                                                     │
│ [#12] [00:45.2] "So what we're trying to"                  │
│ [#13] [00:47.8] "achieve here is better performance."      │
│                                                             │
│ AFTER:                                                      │
│ [#12] [00:45.2 - 00:49.8]                                  │
│ "So what we're trying to achieve here is better            │
│ performance."                                               │
│                                                             │
│ [Cancel] [Merge]                                           │
└─────────────────────────────────────────────────────────────┘
```

### What Gets Merged

- **Text:** Combined with space (or configurable separator)
- **Time:** Start from first, end from last segment
- **Speaker:** Must be same speaker (or override)
- **Confidence:** Average of merged segments

### Undo Support

- **Ctrl+Z** (or **Cmd+Z**) to undo merge
- Merged segment splits back to original segments
- Full undo history preserved

### Keyboard Shortcuts (Manual)

| Shortcut | Action |
|----------|--------|
| **Ctrl+M** / **Cmd+M** | Merge selected segments |
| **Alt+M** | Quick merge with next segment |
| **Shift+Click** | Select range of segments |
| **Ctrl+Z** | Undo merge |

---

## Part B: AI Merge Suggestions 🔄

### Overview

AI analyzes your transcript and suggests segments that should be merged based on:

- **Same speaker** in consecutive segments
- **Incomplete sentences** spanning multiple segments
- **Short time gaps** (< configurable threshold)
- **Semantic coherence**
- **Text smoothing opportunities** (optional)

> ⚠️ **Requires:** Uses the same merge operation as manual. AI just identifies candidates.

### Running AI Analysis

**Step 1: Open AI Panel**
- Click "AI Merge Analysis" in toolbar
- Or press **Alt+Shift+M**

**Step 2: Configure Scope**

```
┌─────────────────────────────────────────────────────────────┐
│ AI Merge Analysis                                           │
├─────────────────────────────────────────────────────────────┤
│ Analyze transcript for merge candidates.                    │
│                                                             │
│ Scope:                                                      │
│ ● Entire transcript (2,450 segments)                       │
│ ○ Filtered segments (345 segments)                         │
│ ○ Selected segments (23 segments)                          │
│                                                             │
│ Options:                                                    │
│ Max time gap: [2.0] seconds                                │
│ Min confidence: [Medium ▼]                                 │
│ ☑ Same speaker only                                        │
│ ☐ Include low-confidence suggestions                       │
│                                                             │
│ Text Smoothing:                                            │
│ ☑ Enable text smoothing                                    │
│ ℹ AI will suggest grammatical fixes for merged text        │
│   (e.g., fix incorrect sentence breaks, punctuation)       │
│                                                             │
│ Provider: [OpenAI ▼]                                       │
│                                                             │
│ [    ✨ Analyze    ]                                       │
└─────────────────────────────────────────────────────────────┘
```

**Step 3: Review Suggestions**

```
┌─────────────────────────────────────────────────────────────┐
│ Merge Suggestions (12 found)                               │
│ [Accept All High] [Reject All] [Review Each]              │
├─────────────────────────────────────────────────────────────┤
│ 🟢 HIGH CONFIDENCE (8)                                      │
│                                                             │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ Segments #12 + #13                    [00:45.2-00:49.8] │ │
│ │ Speaker: Host                                           │ │
│ │ Reason: Incomplete sentence, 0.3s gap                   │ │
│ │                                                         │ │
│ │ BEFORE:                                                 │ │
│ │ "So what we're trying to."                             │ │
│ │ + "Achieve here is better performance."                │ │
│ │                                                         │ │
│ │ AFTER (with smoothing):                                │ │
│ │ "So what we're trying to achieve here is better        │ │
│ │ performance."                                          │ │
│ │                                                         │ │
│ │ 💡 Smoothing: Removed incorrect period, fixed casing   │ │
│ │                                                         │ │
│ │ [✗ Reject] [✓ Accept]                                  │ │
│ └─────────────────────────────────────────────────────────┘ │
│                                                             │
│ 🟡 MEDIUM CONFIDENCE (3)                                    │
│ ...                                                         │
│                                                             │
│ 🔴 LOW CONFIDENCE (1)                                       │
│ ...                                                         │
└─────────────────────────────────────────────────────────────┘
```

### Confidence Levels

| Level | Meaning | Action |
|-------|---------|--------|
| 🟢 **High** | Very likely should merge | Usually accept |
| 🟡 **Medium** | Possibly should merge | Review carefully |
| 🔴 **Low** | Uncertain | Usually reject |

### Text Smoothing Details

When text smoothing is enabled, the AI will:

1. **Detect transcription artifacts:**
   - Mid-sentence periods followed by capital letters
   - Incorrect comma placement
   - Sentence fragments

2. **Suggest corrections:**
   - Remove incorrect punctuation
   - Fix capitalization
   - Ensure grammatical flow after merge

3. **Show before/after preview:**
   - Original concatenated text
   - Smoothed merged text
   - Explanation of changes

### Batch Actions

- **Accept All High:** Apply all high-confidence suggestions
- **Accept All:** Apply all suggestions (use with caution)
- **Reject All:** Dismiss all suggestions
- **Review Each:** Step through one by one

### Inline Indicators

After analysis, segments show merge hints:

```
┌─────────────────────────────────────────────────────────────┐
│ [00:45.20] Host                                [🔗] [⋮]    │
├─────────────────────────────────────────────────────────────┤
│ So what we're trying to                                     │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ 🔗 Merge suggested (High confidence)                    │ │
│ │ Reason: Incomplete sentence                             │ │
│ │ [Accept] [Reject]                                       │ │
│ └─────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

### Keyboard Shortcuts (AI Mode)

| Shortcut | Action |
|----------|--------|
| **Alt+Shift+M** | Open AI merge analysis |
| **Enter** | Accept current suggestion |
| **Delete** | Reject current suggestion |
| **↑/↓** | Navigate suggestions |
| **H** | Accept all high-confidence |
| **Escape** | Close panel |

---

## Merge Criteria

### When AI Suggests Merge

1. **Same Speaker**
   - Consecutive segments from same speaker
   - Never suggests cross-speaker merge

2. **Incomplete Sentence**
   - First segment ends without punctuation
   - First segment ends with conjunction
   - Text clearly continues in next segment
   - **New:** Detects incorrect sentence breaks (period + capital mid-sentence)

3. **Time Gap**
   - Gap between segments < threshold (default 2s)
   - Smaller gap = higher confidence

4. **Semantic Connection**
   - Related content
   - Logical flow from one to next

5. **Smoothing Opportunities** (when enabled)
   - Detects patterns like "word. Next" that should be "word next"
   - Identifies fragmented sentences that need joining

### When AI Does NOT Suggest Merge

- Different speakers
- Time gap > threshold
- Both segments are complete sentences
- Topic clearly changes

---

## Best Practices

### Manual Merging

1. **Listen first:** Play audio to verify segments belong together
2. **Check speaker:** Ensure same speaker before merging
3. **Preview result:** Review merged text before confirming
4. **Preserve meaning:** Don't merge if it changes meaning

### AI Suggestions

1. **Start with high confidence:** Accept these first
2. **Review medium carefully:** Read both segments
3. **Skip low confidence:** Usually better not to merge
4. **Verify with audio:** When unsure, listen
5. **Check smoothing previews:** Ensure suggested text changes are correct

### General Tips

- **Don't over-merge:** Keep segments readable
- **Sentence boundaries:** Good place for segment breaks
- **Speaker turns:** Never merge across speakers
- **Time coherence:** Merged segment shouldn't span too long

---

## Troubleshooting

### AI Suggests Too Many Merges
- Increase "Min confidence" to High
- Decrease "Max time gap"
- Review instead of bulk accept

### AI Misses Obvious Merges
- Check if segments are same speaker
- Verify time gap is below threshold
- Try analyzing specific selection

### Merged Text Looks Wrong
- Use Ctrl+Z to undo
- Check original segment text
- May need manual text editing
- Disable smoothing if changes are unwanted

### Smoothing Changes Too Much
- Review smoothing previews carefully
- Disable smoothing for conservative merging
- Apply merge without smoothing, then edit manually

### Performance Issues
- Analyze smaller selection
- Reduce scope to filtered segments
- Wait for batch to complete

---

## Settings

Access via Settings → Editor → Segment Merge:

```
┌─────────────────────────────────────────────────────────────┐
│ Segment Merge Settings                                      │
├─────────────────────────────────────────────────────────────┤
│ Text Separator: [ ] (space by default)                     │
│ ☑ Show merge preview before confirming                     │
│ ☑ Allow cross-speaker merge (with warning)                 │
│                                                             │
│ AI Merge Analysis:                                          │
│ Default max time gap: [2.0] seconds                        │
│ Default min confidence: [Medium ▼]                         │
│ ☑ Show inline merge hints after analysis                   │
│ ☑ Enable text smoothing by default                         │
└─────────────────────────────────────────────────────────────┘
```

---

## Examples

### Example 1: Sentence Fragment with Smoothing (High Confidence)

**Before:**
```
[#12] "So what we're trying to."
[#13] "Achieve here is better performance."
```

**AI Analysis:**
- Detected: Incorrect sentence break (mid-sentence period + capital)
- Smoothing: Remove period, lowercase "Achieve"

**After merge (with smoothing):**
```
[#12] "So what we're trying to achieve here is better performance."
```

✅ Same speaker, incomplete sentence, 0.3s gap, smoothing applied

### Example 2: Simple Merge Without Smoothing (High Confidence)

**Before:**
```
[#12] "So what we're trying to"
[#13] "achieve here is better performance."
```

**After merge:**
```
[#12] "So what we're trying to achieve here is better performance."
```

✅ Same speaker, incomplete sentence, 0.3s gap, no smoothing needed

### Example 3: Related Thoughts (Medium Confidence)

**Before:**
```
[#45] "That's an excellent point."
[#46] "We should consider that in our next meeting."
```

**After merge:**
```
[#45] "That's an excellent point. We should consider that in our next meeting."
```

🟡 Same speaker, complete sentences, but related

### Example 4: Don't Merge (Low Confidence)

**Segments:**
```
[#78] "Let me think about that."
[#79] "Okay, here's what I propose."
```

❌ 3.5s gap suggests deliberate pause — keep separate

---

## Privacy & Data

### What's Sent to AI
- Segment text for analysis
- Speaker labels
- Timestamps (for gap calculation)

### What Stays Local
- Audio files
- Your accept/reject decisions
- Final merged result

### Privacy Option
Use Ollama for fully local AI processing.

---

*For technical details, see [Architecture](architecture/ai-features-unified.md).*

