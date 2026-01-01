# Multi-Track Transcript Merge – User Guide
*Last Updated: January 1, 2026*

---

## Overview

**Multi-Track Merge** helps you combine multiple transcript files (one per speaker/microphone) into a single, high-quality transcript. Compare tracks side-by-side, select the best segments, and merge them together.

> 💡 **Manual-First Design:** All selection and merging can be done manually. AI suggestions are optional and help speed up the process.

---

## When to Use

### Ideal Use Cases

- **Podcast recording:** Each host recorded separately
- **Interview:** Interviewer and interviewee on different mics
- **Remote recording:** Each participant recorded locally
- **Quality variation:** One track has better quality than others

### How It Helps

When recording multiple people separately, each microphone captures:
- Clear audio of the nearby speaker
- Lower quality audio of distant speakers

This means:
- **Track 1** has clear Host audio, muffled Guest audio
- **Track 2** has clear Guest audio, muffled Host audio

Multi-Track Merge lets you pick the best of each.

---

## Part A: Manual Multi-Track Merge

### Loading Tracks

**Step 1: Open Multi-Track Panel**
- Click "Multi-Track Merge" in toolbar
- Or press **Alt+T** (or **Option+T** on Mac)

**Step 2: Add Transcript Files**

```
┌─────────────────────────────────────────────────────────────┐
│ Multi-Track Merge                                           │
├─────────────────────────────────────────────────────────────┤
│ Load 2 or more transcript files to merge.                  │
│                                                             │
│ LOADED TRACKS                                               │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ 🎙️ Track 1: Host_Recording.json                         │ │
│ │    2,345 segments • 85:30 duration                       │ │
│ │    [Preview] [Remove]                                   │ │
│ └─────────────────────────────────────────────────────────┘ │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ 🎙️ Track 2: Guest_Recording.json                        │ │
│ │    2,289 segments • 84:45 duration                       │ │
│ │    [Preview] [Remove]                                   │ │
│ └─────────────────────────────────────────────────────────┘ │
│                                                             │
│ [+ Add Track]                                              │
│                                                             │
│ [Cancel] [Start Comparison →]                              │
└─────────────────────────────────────────────────────────────┘
```

### Side-by-Side Comparison

Once tracks are loaded, view them in parallel:

```
┌────────────────────────────────────────────────────────────────────────┐
│ Time: 00:10.00 - 00:15.80                             [← Prev] [Next →]│
├────────────────────────────────────────────────────────────────────────┤
│                                                                        │
│  Track 1: Host_Recording               Track 2: Guest_Recording      │
│ ┌────────────────────────────────┐   ┌────────────────────────────────┐│
│ │ ✓ SELECTED                    │   │                               ││
│ │                               │   │                               ││
│ │ "So what we're trying to      │   │ "So what were trying to       ││
│ │ achieve here is better        │   │ acheve here is beter          ││
│ │ performance and improved      │   │ performence and improoved     ││
│ │ user experience."             │   │ user experiance."             ││
│ │                               │   │                               ││
│ │ Confidence: 0.92              │   │ Confidence: 0.68              ││
│ │ [Select This]                 │   │ [Select This]                 ││
│ └────────────────────────────────┘   └────────────────────────────────┘│
│                                                                        │
│ Progress: ████████████░░░░░░░░░░░ 48% (120/250 slices)               │
└────────────────────────────────────────────────────────────────────────┘
```

### Making Selections

**Click to Select:**
- Click "Select This" on the track you prefer
- Selected track is highlighted with checkmark
- Move to next time slice automatically

**Keyboard Navigation:**
- **1-9** — Select track 1-9
- **→** — Next time slice
- **←** — Previous time slice
- **Space** — Confirm and next
- **P** — Play audio for this slice

### Selection Indicators

| Indicator | Meaning |
|-----------|---------|
| ✓ Selected | This track will be used for final merge |
| 🟢 Higher confidence | Better transcription quality |
| 🔴 Lower confidence | Potential quality issues |
| ⚠️ Mismatch | Tracks have different content |

### Merge Progress

```
┌─────────────────────────────────────────────────────────────┐
│ Merge Progress                                              │
├─────────────────────────────────────────────────────────────┤
│ Reviewed: 250 / 250 time slices ✓                         │
│                                                             │
│ Selections:                                                 │
│ • Track 1 (Host): 185 segments (74%)                       │
│ • Track 2 (Guest): 65 segments (26%)                       │
│                                                             │
│ Ready to merge!                                            │
│                                                             │
│ [Back to Review] [Merge Transcripts]                       │
└─────────────────────────────────────────────────────────────┘
```

### Completing the Merge

1. Review all time slices
2. Click "Merge Transcripts"
3. New merged transcript opens in editor
4. Original tracks remain unchanged

### Keyboard Shortcuts (Manual)

| Shortcut | Action |
|----------|--------|
| **Alt+T** | Open multi-track panel |
| **1-9** | Select track 1-9 |
| **→** / **←** | Navigate time slices |
| **Space** | Confirm and next |
| **Enter** | Confirm selection |
| **P** | Play audio for current slice |
| **Home** | Jump to beginning |
| **End** | Jump to end |

---

## Part B: AI-Assisted Merge 🔄

### Overview

AI can help by:
- Detecting which track has the **primary speaker** (best overall quality)
- Recommending the **best segment** for each time slice
- Providing **quality indicators** to guide selection

> ⚠️ **Requires:** Manual multi-track feature as foundation. AI suggestions use the same selection mechanism.

### Primary Speaker Detection

AI analyzes each track and recommends which is the "primary" track:

```
┌─────────────────────────────────────────────────────────────┐
│ AI Analysis Complete                                        │
├─────────────────────────────────────────────────────────────┤
│ 🏆 Recommended Primary Track: Track 1 (Host_Recording)     │
│                                                             │
│ Analysis:                                                   │
│ • Highest average confidence: 0.89                         │
│ • Most complete segments: 2,345                            │
│ • Fewest gaps: 12                                          │
│                                                             │
│ Track 2 (Guest_Recording):                                 │
│ • Average confidence: 0.72                                 │
│ • Segments: 2,289                                          │
│ • Gaps: 45                                                 │
│                                                             │
│ [Use Manual Selection] [Accept AI Recommendations]         │
└─────────────────────────────────────────────────────────────┘
```

### AI Recommendations per Slice

When reviewing time slices, AI provides recommendations:

```
┌────────────────────────────────────────────────────────────────────────┐
│ Time: 00:10.00 - 00:15.80                    AI Recommends: Track 1   │
│                                              Confidence: 🟢 High       │
├────────────────────────────────────────────────────────────────────────┤
│                                                                        │
│  Track 1: 🏆 RECOMMENDED              Track 2:                        │
│ ┌────────────────────────────────┐   ┌────────────────────────────────┐│
│ │ "So what we're trying to      │   │ "So what were trying to       ││
│ │ achieve here is better..."    │   │ acheve here is beter..."      ││
│ │                               │   │                               ││
│ │ ✓ Correct spelling            │   │ ⚠ Spelling errors (5)         ││
│ │ ✓ High confidence (0.92)      │   │ ⚠ Lower confidence (0.68)     ││
│ └────────────────────────────────┘   └────────────────────────────────┘│
└────────────────────────────────────────────────────────────────────────┘
```

### Auto-Select Mode

For fast processing:
1. Click "Accept AI Recommendations"
2. AI selects best track for all time slices
3. Review the summary
4. Spot-check specific slices if needed
5. Merge

### Selection Modes

| Mode | Speed | Control | Best For |
|------|-------|---------|----------|
| **Fully Manual** | Slow | Complete | Critical content |
| **AI Assisted** | Medium | Per-slice | Most use cases |
| **Auto-Select** | Fast | Review only | Trusted quality |

### Keyboard Shortcuts (AI Mode)

| Shortcut | Action |
|----------|--------|
| **A** | Accept AI recommendation for current slice |
| **Shift+A** | Accept AI for all remaining slices |
| **R** | Reject AI, select other track |
| **Tab** | Toggle between tracks |

---

## Time Alignment

### How It Works

Tracks may have slightly different start times. Multi-Track Merge automatically aligns tracks based on:
- First segment timestamps
- Content similarity
- Configurable offset

### Manual Alignment

If automatic alignment fails:

```
┌─────────────────────────────────────────────────────────────┐
│ Track Alignment                                             │
├─────────────────────────────────────────────────────────────┤
│ Track 1 starts at: [00:00.00]                              │
│ Track 2 starts at: [00:00.00] [Adjust: +0.5s ▼]           │
│                                                             │
│ Preview:                                                    │
│ Track 1: "Welcome to the show..."                          │
│ Track 2: "Welcome to the show..."                          │
│                                                             │
│ [Auto-Align] [Apply]                                       │
└─────────────────────────────────────────────────────────────┘
```

---

## Edge Cases

### Overlapping Speech

When both people speak simultaneously:

- Both tracks show segment with "⚠️ Overlap" indicator
- You can:
  - Select one track (prioritize one speaker)
  - Mark for manual edit later
  - Keep both (creates overlapping segments)

### Missing Segments

When one track has no content:

- Gap shown in comparison view
- Other track auto-selected
- No review needed for these slices

### Very Different Durations

If tracks have significantly different lengths:

- Longer track continues alone after shorter ends
- Warning shown in loading panel
- Consider if tracks are actually from same recording

---

## Best Practices

### Before Merging

1. **Verify same recording:** Ensure tracks are from the same session
2. **Check time sync:** Listen to both to verify alignment
3. **Clean up individually:** Fix obvious errors in each track first

### During Review

1. **Trust quality indicators:** Higher confidence usually means better
2. **Listen when unsure:** Play audio to verify selection
3. **Focus on differences:** Skip identical segments quickly
4. **Mark uncertainties:** Flag slices for later review

### After Merging

1. **Full playthrough:** Listen to merged result
2. **Check transitions:** Ensure smooth flow between selections
3. **Final edits:** Use standard editing tools for cleanup
4. **Keep originals:** Don't delete source tracks immediately

---

## Troubleshooting

### Tracks Won't Load
- Verify files are valid JSON transcripts
- Check file format matches FlowScribe export
- Ensure files aren't corrupted

### Alignment Issues
- Manually adjust offset in alignment panel
- Check if tracks have dead air at start
- Verify tracks are from same recording

### AI Recommendations Seem Wrong
- AI uses confidence scores, not content understanding
- Manual review recommended for critical content
- Consider if quality differences are real

### Merged Result Has Gaps
- Check for missing segments in source tracks
- Verify time alignment is correct
- Fill gaps with manual editing

---

## Privacy & Data

### What's Sent to AI
- Segment text from all tracks
- Confidence scores
- Timestamps for alignment

### What Stays Local
- Audio files (never sent)
- Your selection decisions
- Merged result

### Privacy Option
Use Ollama for fully local AI processing.

---

## Example Workflow

### Scenario: 2-Person Podcast

**Step 1:** Load both host and guest recordings

**Step 2:** AI analysis shows:
- Track 1 (Host): Primary speaker, 0.89 avg confidence
- Track 2 (Guest): Secondary, 0.72 avg confidence

**Step 3:** Use AI recommendations with review:
- 250 time slices total
- 210 auto-selected (AI confident)
- 40 reviewed manually

**Step 4:** Results:
- Track 1: 74% of final transcript
- Track 2: 26% of final transcript

**Step 5:** Merge and final edit:
- Single transcript with best of both tracks
- Quick cleanup for any issues

**Time Spent:** ~15 minutes for 85-minute podcast

---

## What's Next?

Planned improvements:
- 3+ track support (multiple guests)
- Audio playback comparison
- Waveform visualization
- Batch processing (multiple episodes)
- Track quality scoring visualization

---

*For technical details, see [Architecture](architecture/ai-features-unified.md).*

