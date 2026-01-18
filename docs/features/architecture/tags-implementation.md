# Tags System Implementation Reference

**Status:** ✅ Implemented  
**PR:** [PR-tags-implementation.md](../PR-tags-implementation.md) (completed implementation details)

---

## Quick Overview

The Tags System provides session-local, color-coded segment annotations. Tags are independent of speakers, support multiple tags per segment, and integrate with filtering and export.

**User documentation:** [Tags: Flexible Segment Annotations](../tags-system.md)

---

## Data Model

### Core Types

```typescript
// client/src/lib/store/types.ts

export interface Tag {
  id: string;        // UUID, stable identity
  name: string;      // User-visible, mutable
  color: string;     // CSS color
}

export interface Segment {
  // ... existing fields
  tags: string[];    // Array of Tag.id references
}

export interface FilterState {
  speakers: string[];      // Existing
  tags: string[];          // NEW: positive filter (include)
  tagsExcluded: string[];  // NEW: negative filter (exclude/NOT)
  showNoTags?: boolean;    // NEW: show only untagged segments
}

export interface PersistedSession {
  // ... existing fields
  tags: Tag[];   // NEW: session-local tag inventory
}
```

### Identity Design

- `Tag.id` is the canonical identity (UUID)
- `Tag.name` is display-only and mutable
- `Segment.tags` stores `Tag.id` references
- This decouples renaming from references, simplifying undo/redo and history

---

## Store API

### Tag CRUD

```typescript
// client/src/lib/store/tagsSlice.ts

export interface TagsSlice {
  tags: Tag[];

  // Create
  addTag: (name: string) => boolean;              // Returns success; validates name
  
  // Read
  getTag: (tagId: string) => Tag | undefined;
  selectAvailableTags: () => Tag[];
  
  // Update
  renameTag: (tagId: string, newName: string) => boolean;
  
  // Delete
  removeTag: (tagId: string) => void;             // Removes from all segments + tag list
  mergeTag: (fromTagId: string, toTagId: string) => void;  // Migrates segments, deletes source
}
```

### Tag Assignment

```typescript
export interface TagsSlice {
  // Assignment (operate on Tag.id)
  assignTagToSegment: (segmentId: string, tagId: string) => void;
  removeTagFromSegment: (segmentId: string, tagId: string) => void;
  toggleTagOnSegment: (segmentId: string, tagId: string) => void;
  
  // Batch operations
  assignTagToSegments: (segmentIds: string[], tagId: string) => void;
  removeTagFromSegments: (segmentIds: string[], tagId: string) => void;
}
```

### Validation Rules

**`addTag` and `renameTag` return `false` if:**

- Name is empty after trimming
- Name is whitespace-only
- Name (case-insensitive) already exists in session
- `tagId` doesn't exist (for rename)

**Success:** returns `true`, creates history snapshot

---

## Filter Logic

### Filter Predicate

```typescript
// From selectFilteredSegments selector
const displaySegment = (segment: Segment, filter: FilterState): boolean => {
  // Speaker filter (existing)
  if (filter.speakers.length > 0 && !filter.speakers.includes(segment.speaker)) {
    return false;
  }

  // Tag positive filter (include): segment must have at least one included tag
  if (filter.tags.length > 0 && !segment.tags.some(t => filter.tags.includes(t))) {
    return false;
  }

  // Tag negative filter (exclude/NOT): segment must not have any excluded tags
  if (segment.tags.some(t => filter.tagsExcluded.includes(t))) {
    return false;
  }

  // "No Tags" filter: segment must have no tags
  if (filter.showNoTags && segment.tags.length > 0) {
    return false;
  }

  return true;
};
```

### Filter Interaction

```
User Action        Filter State              Display
─────────────────────────────────────────────────────
Click "OOC"         tags: ["OOC"]             OOC segments (OR logic)
Click "OOC" + "FX"  tags: ["OOC", "FX"]       OOC or FX segments
Double-click "OOC"  tagsExcluded: ["OOC"]     NOT OOC
Click "OOC" + "FX"
  + exclude "OOC"   tags: ["FX"],
                    tagsExcluded: ["OOC"]    FX but not OOC
Click "No Tags"     showNoTags: true         Untagged only
```

---

## UI Components

### Sidebar Tag Section

**Component:** `client/src/components/SpeakerSidebar.tsx` (updated to include Tags)

- Lists tags with segment counts
- Single-click: toggle positive filter (include)
- Double-click/right-click: toggle negative filter (exclude/NOT)
- Context menu: Rename, Delete, Merge Into
- "+ Add Tag" button: create new tag with validation feedback

### Segment Card Tags Display

**Component:** `client/src/components/TranscriptSegment.tsx` (updated)

- Tag badges in segment header
- Each tag badge has an ✕ button to remove from segment
- "+ Add" button: open tag picker dropdown
- Inline visual feedback on filter state
- Tag header row, tag container, and tag badges keep consistent vertical padding/height via shared CSS utility classes in `client/src/index.css` to avoid segment frame shifts when tags are toggled (e.g., T+1 shortcuts). Tag buttons/badges align to a shared 32px height.

### Export Dialog

**Component:** `client/src/components/ExportDialog.tsx` (updated)

- Checkbox: "Export visible segments only"
- Respects active filters (speakers + tags)
- Tags preserved in JSON export

---

## Keyboard Shortcuts

### Tag Assignment (T + 1–0)

```typescript
// client/src/hooks/useKeyboardShortcuts.ts (or equivalent)

// When user presses T + 1...0
const handleTagShortcut = (tagNumber: 1 | 2 | 3 | ... | 10) => {
  const tagId = store.tags[tagNumber - 1]?.id;
  if (!tagId) return;
  
  // Single selection
  if (currentSelection.type === 'segment') {
    store.toggleTagOnSegment(currentSelection.segmentId, tagId);
  }
  
  // Range selection: toggle independently on each segment
  if (currentSelection.type === 'range') {
    currentSelection.segmentIds.forEach(segId => {
      store.toggleTagOnSegment(segId, tagId);
    });
  }
};
```

**Behavior:**
- Toggle: if segment has tag, remove; if not, add
- Works on single segment and range selections
- Each segment in range toggles independently
- Creates history snapshot

---

## Testing Strategy

### Unit Tests

**Store (`tagsSlice.test.ts`):**
- CRUD: create, rename, delete, merge
- Validation: empty names, duplicates, case-insensitive
- Assignment: idempotent toggle, batch operations
- History: mutations create snapshots

**Filter Predicates (`selectFilteredSegments.test.ts`):**
- Positive filter (include): OR logic
- Negative filter (exclude/NOT): correct negation
- Combined speaker + tags: AND logic
- "No Tags": correct empty detection
- Edge cases: mixed filters, no filters

**Keyboard Shortcuts (`useKeyboardShortcuts.test.ts`):**
- T+1...0 toggles correct tag
- Range selection: each segment toggles independently
- Single selection: tag assignment works

### Integration Tests

**Store Integration:**
- Undo/redo: tag operations reverse correctly
- Persistence: tags survive session reload
- Import: tags deduplicate on collision

**Component Tests:**
- Sidebar: tag list renders with counts
- Filter toggles: update displayed segments
- Context menu: rename/delete/merge work
- Segment badges: inline removal works

**Coverage Target:** >80% branch coverage on tag logic

---

## Common Patterns

### Adding a New Tag

```typescript
const store = useStore();

// Validate and create
if (!store.addTag("MY_TAG")) {
  // Show validation error (empty, duplicate, etc.)
  showError("Tag name already exists or is empty");
  return;
}

// Tag is created and added to store.tags
// History snapshot created automatically
```

### Assigning Tags to Segment(s)

```typescript
const store = useStore();
const tagId = store.tags[0]?.id;

if (!tagId) return; // No tags available

// Single segment
store.assignTagToSegment(segmentId, tagId);

// Multiple segments
store.assignTagToSegments(segmentIds, tagId);
```

### Filtering by Tag

```typescript
// Update filter state
store.setFilter({
  ...store.filter,
  tags: [...store.filter.tags, tagId], // Add include filter
});

// OR
store.setFilter({
  ...store.filter,
  tagsExcluded: [...store.filter.tagsExcluded, tagId], // Add exclude filter
});

// Selector automatically updates displayed segments
const displayed = store.selectFilteredSegments();
```

---

## Integration with Other Systems

### History & Undo/Redo

All tag mutations automatically create history snapshots:
- `addTag` → history entry
- `removeTag` → history entry
- `assignTagToSegment` → history entry
- Undo/redo: full state reversal works correctly

### Export & Import

**Export:**
- Tags included in JSON output (Whisper-X compatible)
- Export dialog respects active tag filters (visible-only option)

**Import:**
- Tags loaded from JSON transcript
- Duplicate tag names deduplicated (keep-first rule)

### Player-Transcript Sync

No special considerations. Tags don't affect playback or seeking logic.

---

## Performance Considerations

### Rendering

- Tag sidebar section is separate scroll container (doesn't push speaker list)
- Tag badge rendering is memoized in segment cards
- Filter predicate is pure and memoized

### Memory

- Tags stored in session (no global state)
- Tag assignments are arrays of IDs (lightweight)
- No redundant storage of tag objects in segments

### Large Datasets

- Tested with 100+ tags, 10k+ segments
- Filter predicate scales linearly
- No performance degradation observed

---

## Migration & Backward Compatibility

### Loading Existing Sessions

- Sessions without `tags` field: auto-initialize with empty array
- Segments without `tags` field: auto-initialize with `[]`
- Backward compatible: no breaking changes

### Deduplication on Import

If imported transcript has duplicate tag names:
1. Keep first occurrence
2. Remap segments to surviving Tag.id
3. Remove duplicate Tag objects

---

## Known Limitations & Future Work

### Current Scope

- Session-local tags (not global)
- Fixed color assignment (from palette)
- Keyboard shortcut limit: 10 tags (T+1...0)

### Future Enhancements

- **Custom tag colors** — Let users pick per-tag color
- **Tag templates** — Save/load common tag presets
- **AI tag suggestions** — Recommend tags based on segment content
- **Hierarchical tags** — Prefix-based namespaces (e.g., `OOC:INTRO`)
- **Tag aliases** — Allow multiple names for same tag

---

## References

- **User Guide:** [Tags: Flexible Segment Annotations](../tags-system.md)
- **Implementation PR:** [PR-tags-implementation.md](../PR-tags-implementation.md)
- **Keyboard Shortcuts:** [docs/shortcuts.md](../../shortcuts.md)
- **Store Patterns:** `client/src/lib/store/` (examples from `speakersSlice`)
- **Filter Patterns:** `client/src/lib/store/selectors.ts` (examples from speaker filters)
