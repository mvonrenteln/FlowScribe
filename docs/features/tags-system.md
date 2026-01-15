# Tags: Flexible Segment Annotations

Tags are optional, color-coded labels you can apply to transcript segments. Unlike speakers, tags are independent annotations—you can use them to organize segments by content type, editorial action, or any other organizational scheme that suits your workflow.

**Key Features:**
- Add, rename, or remove tags at any time
- Apply multiple tags to a single segment
- Filter transcript by tags (include, exclude, or show untagged-only)
- Tags persist when you save, export, and re-import
- Keyboard-first shortcuts for fast assignment

---

## Quick Start: Adding Tags

### Method 1: Keyboard Shortcuts (Fastest)

If you have up to 10 common tags, use **T + 1–0** shortcuts:

1. Select a segment (click on it or navigate with arrow keys)
2. Press **T**, then press **1–0** for tag #1–#10
   - Example: **T + 1** toggles tag #1 on the current segment
   - If the tag is already on the segment, it's removed; if not, it's added

### Method 2: Tag Picker (Visual)

1. Click the **+** button in a segment header
2. A dropdown or modal shows all available tags
3. Click a tag to add it to the segment
4. Click the **✕** on a tag badge to remove it
---

## Sidebar: Tag Management & Filtering

### Tag List

The **Tags** section in the left sidebar shows:

- **Tag name** with a colored circle (the tag's color)
- **Segment count** in parentheses (e.g., "OOC (4 seg)")
- **Edit icon** and **Delete icon** (right side) for management

### Create a New Tag

1. Scroll to the **Tags** section in the left sidebar
2. Click **+ Add Tag** at the bottom
3. Type the new tag name and press **Enter**
4. The tag appears in the list and is available for assignment

### Filter by Tag

**First click** a tag to show only segments with that tag:
- Visual indicator: tag becomes highlighted (no special marker)
- Transcript updates immediately to show matching segments

**Second click** on the same tag to hide segments with that tag:
- Visual indicator: tag shows an exclude/NOT marker (✕)
- Transcript updates to hide all segments with that tag

**Third click** returns to no filter (removes the tag from the filter)

### Tag Lifecycle: Three-Click Cycle

```
Neutral (no icon)  →  Include (highlighted)  →  Exclude (✕)  →  back to Neutral
 (not filtered)        (show only)            (hide all)        (not filtered)
```

### "No Tags" Filter

Below the tag list is a special filter called **"No Tags"**. Click it to show only segments that don't have any tags assigned.

### Manage Tags

Click the **Edit** or **Delete** icons next to a tag:

- **Edit** — Rename the tag (all segments keep the tag; only the name updates)
- **Delete** — Remove the tag from all segments and the tag list

---

## Tag Display on Segments

Each segment card shows:

```
┌─ Time | Speaker  [Tag1] [Tag2]  ...
│ Text goes here...
│ Tags: [Tag1]✕ [Tag2]✕ [+ Add]
└─
```

- **Tag badges** in the segment header show the tags assigned to this segment
- **✕ button** on each tag removes that tag from the segment
- **+ Add button** opens the tag picker to add new tags

---

## Filtering with Tags

### Single Tag Filter

- **First click "DirectSpeech"** → Show segments with the DirectSpeech tag
- **Second click "DirectSpeech"** → Hide segments with the DirectSpeech tag
- **Third click** → Reset; show all segments

### Multiple Tag Filters

- **Click "DirectSpeech", then "Summary"** → Show segments with DirectSpeech **OR** Summary (either tag)
- **Click "DirectSpeech" (twice), then "Summary"** → Show segments with Summary but NOT DirectSpeech

### Combining Tags & Speakers

- **Click speaker "Alice", then tag "DirectSpeech"** → Show Alice segments with DirectSpeech tag
- The speaker filter and tag filter work together: both must match

### Show Untagged Segments Only

- **First click "No Tags"** → Show only segments with no tags

---

## Export with Tags

### Export Dialog Options

When you export your transcript, you have two options:

1. **Export all segments** — Includes tags for all segments (default)
2. **Export visible segments only** — Exports only segments matching your current filters

If you're filtering by tags or speakers, check "Export visible segments only" to export just the filtered results.

### Tag Preservation

Tags are saved in the JSON export file. When you re-import, tags are restored so you don't lose your annotations.

---

## Common Workflows

### Workflow 1: Mark Merge Candidates & Duplicates

1. Create tags: "MergeCandidate" (for segments to combine), "StrikeCandidate" (for segments to remove)
2. As you listen, press **T + 1** or **T + 2** on segments needing action
3. After the first pass, click the "MergeCandidate" tag to see only those segments
4. Merge them in context, then remove the tag when done

### Workflow 2: Categorize by Content or Action

Create tags for different content types or editorial actions: "DirectSpeech" (direct dialogue), "Flashback", "Summary", "Editorial" (commentary), "MergeCandidate" (combine with next), "StrikeCandidate" (remove), etc.

1. Tag segments as you identify them
2. Use filters to isolate each section (e.g., click "Flashback" to review all flashback sections)
3. Export a subset by filtering (e.g., show only "DirectSpeech" + "Summary", then export visible for clean dialogue)

### Workflow 3: Quick Review with Exclusion

1. Filter by a speaker: click "Alice"
2. Exclude editorial content: click "Editorial" (twice) to exclude
3. Result: See only Alice's direct dialogue (no background commentary)

### Workflow 4: Export Specific Content Type

1. Tag direct dialogue: "DirectSpeech"
2. Tag editorial/background: "Editorial", "Clarification"
3. In export: click "DirectSpeech" to show only direct dialogue segments
4. Check "Export visible segments only" and export
5. Result: Clean dialogue transcript without editorial commentary or background info

---

## Tips & Tricks

### Keyboard Efficiency

- Use **T + 1–0** to assign your most common tags quickly
- For the 11th+ tag, use the **+ Add** button in the segment card (or sidebar)

### Tag Naming

- Keep tag names short (1 word) — they appear as badges, so brevity helps
- Use PascalCase for clarity (e.g., `DirectSpeech`, not `direct speech`)
- Examples: `DirectSpeech`, `Flashback`, `Summary`, `Editorial`, `MergeCandidate`, `StrikeCandidate`, `Clarification`

### Organize Your Tags

1. Start with 3–5 core tags
2. Add more as you discover patterns in your content
4. Rename tags if you want to refine your naming over time

### Filter Resets

- To clear all filters and see the full transcript: click the active filter tags a third time (or click "Speakers" to reset)
- If you've applied complex filters, just click each highlighted tag once to cycle back to neutral

---

## FAQ

**Q: Can I have multiple tags on one segment?**  
A: Yes! Assign as many as you need. Each tag appears as a separate badge.

**Q: Do tags export with the transcript?**  
A: Yes. Tags are included in the JSON export (the standard format). If you re-import that JSON, the tags come back.

**Q: Can I change a tag's color?**  
A: Not in this version. Tag colors are auto-assigned and serve as visual identifiers. If you'd like custom colors in the future, let us know.

**Q: What happens if I delete a tag?**  
A: The tag is removed from all segments. It's permanent and can't be undone from the sidebar—use **Undo** (Cmd/Ctrl + Z) if you change your mind right away.

---

## See Also

- [Usage Guide](usage.md) — Full FlowScribe editing workflow
- [Keyboard Shortcuts](../shortcuts.md) — Complete keyboard reference
- [Export Formats](../formats.md) — Supported export file types
