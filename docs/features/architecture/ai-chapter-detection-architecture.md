# AI Chapter Detection – Architecture

*Last Updated: January 23, 2026*  
*Status:* Design locked (pending implementation)

---

## Problem Space

Users want to organize long transcripts into logical chapters for:
1. Navigation (jump to sections)
2. Batch processing (summarize per chapter, not per fixed segment count)
3. Export (with chapter structure preserved)

**Constraint:** Chapters can be created manually anytime, or AI-suggested in batches. Both must coexist cleanly.

**Design decisions (stable):**
- Chapter meta uses `summary`, `notes`, and `tags` (no `description` field).
- Chapter meta is hidden by default in the timeline via a Collapsible chapter header (title + tags collapsed; summary/notes expanded).
- Downstream AI context is minimal and explicit: include previous `summary` values only; exclude `notes` by default (`contextChapterCount = 2`, `includeEditorNotes = false`).

**Design Decision:** Separate store slices:
- `chapterSlice`: General chapter storage (manual + AI-accepted)
- `aiChapterDetectionSlice`: AI-specific state (isProcessing, results, batching context)

---

## 1. Data Model & Types

### 1.1 Chapter (General)

```typescript
interface Chapter {
  id: string;              // Unique ID (UUID)
  title: string;           // Chapter title
  summary?: string;        // Optional: 1 sentence, content-focused
  notes?: string;          // Optional: open-ended editorial notes (excluded from AI context by default)
  tags?: string[];         // Optional: Tag IDs (shown as compact badges)
  startSegmentId: string;  // First segment ID in chapter
  endSegmentId: string;    // Last segment ID in chapter
  segmentCount: number;    // Calculated: number of segments
  createdAt: number;       // Timestamp (manual or AI-accepted)
  source: "manual" | "ai"; // Origin
}
```

**Invariants:**
- `startSegmentId` and `endSegmentId` must be valid segment IDs in current transcript
- No chapter overlaps (validated on add/update)
- Chapters ordered by startSegmentId
- `summary` and `notes` are semantically distinct; `summary` is the only chapter meta used for downstream AI context by default
- Chapter header is Collapsible; meta is hidden by default in the timeline

### 1.2 AI Chapter Detection State

```typescript
interface AIChapterDetectionState {
  // Processing state
  isProcessing: boolean;
  processedBatches: number;
  totalBatches: number;
  error: string | null;
  
  // Current results (AI suggestions)
  suggestions: ChapterSuggestion[];
  
  // Configuration
  config: ChapterDetectionConfig;
  
  // Batch context (for overlap logic)
  lastProcessedBatchIndex: number;
  lastBatchChapters: Chapter[];  // For overlap to next batch
}

// Note: AI detection state is in-memory only (no persistence to browser storage).
// Only accepted chapters are persisted via the main chapter slice.

interface ChapterSuggestion extends Chapter {
  acceptanceStatus: "pending" | "accepted" | "rejected";
}

interface ChapterDetectionConfig {
  batchSize: number;           // 50–200
  minChapterLength: number;    // Min segments per chapter
  maxChapterLength: number;    // Max segments per chapter
  tagIds: string[];            // Which tags can be suggested/used
  selectedProviderId?: string; // AI provider override
  selectedModel?: string;      // Model override
  activePromptId?: string;     // Reference to prompt template stored in AI prompts store
}
```

### 1.3 AI Response Schema

```typescript
interface ChapterDetectionResponse {
  chapters: {
    title: string;
    summary?: string;
    tags?: string[];                // Tag IDs (must be validated)
    start: number;                  // Synthetic SimpleID (1..n) from the batch mapping
    end: number;                    // Synthetic SimpleID (1..n) from the batch mapping
  }[];
  
  // Overlap info for next batch
  chapterContinuation?: {
    lastChapterTitle: string;       // Human-readable; no opaque IDs sent to AI
    endsAtSimpleId: number;         // Synthetic short ID in current batch
    continuesIntoNextBatch: boolean;
  };
}
```

---

## 2. Store Architecture

### 2.1 Chapter Slice

```typescript
// State
export interface ChapterState {
  chapters: Chapter[];
  selectedChapterId?: string;
}

// Actions
startChapter(title: string, startSegmentId: string, tags?: string[]);
updateChapter(id: string, updates: Partial<Chapter>);
deleteChapter(id: string);
selectChapter(id: string);
clearChapters();

// Selectors
selectAllChapters(): Chapter[];
selectChapterById(id: string): Chapter | undefined;
selectChapterForSegment(segmentId: string): Chapter | undefined;
selectSegmentsInChapter(chapterId: string): Segment[];
```

### 2.2 AI Chapter Detection Slice

```typescript
// State
export interface AIChapterDetectionState {
  isProcessing: boolean;
  processedBatches: number;
  totalBatches: number;
  error: string | null;
  suggestions: ChapterSuggestion[];
  config: ChapterDetectionConfig;
  lastProcessedBatchIndex: number;
  lastBatchChapters: Chapter[];
}

// Actions
startDetection(options: ChapterDetectionConfig);
updateProcessingProgress(processed: number, total: number);
setSuggestions(suggestions: ChapterSuggestion[]);
acceptSuggestion(suggestionId: string);
rejectSuggestion(suggestionId: string);
acceptAllSuggestions();  // Atomic: all → chapterSlice at once
cancelDetection();
setError(error: string | null);
clearSuggestions();
updateConfig(config: Partial<ChapterDetectionConfig>);

// Selectors
selectPendingSuggestions(): ChapterSuggestion[];
selectAcceptedSuggestions(): ChapterSuggestion[];
selectRejectedSuggestions(): ChapterSuggestion[];
selectProcessingProgress(): { processed: number; total: number };
```

---

## 3. Batch Processing Logic

### 3.1 Batch Creation

```
Input: Segments[], batchSize=100

Step 1: Calculate batch count
  totalBatches = ceil(segments.length / batchSize)

Step 2: Create batches with overlap context
  For batch i (0-based):
    startIndex = i * batchSize
    endIndex = min((i+1) * batchSize, segments.length)
    
    if i > 0:
      // Include last chapter from previous batch for context
      contextChapters = lastBatchChapters
      contextSegments = segmentsInChapters(contextChapters)
      batch = contextSegments + segments[startIndex:endIndex]
    else:
      batch = segments[0:batchSize]
      
Step 3: Create SimpleID mapping for AI
  batch.segments → [1, 2, 3, ..., n] (for prompt clarity)
  Create reverse mapping: simpleId ↔ realId (reuse ai/core batch mapping utilities)
  Only SimpleIDs are exposed to the AI; real segment IDs stay client-side
```

### 3.2 Processing Loop

```
For each batch:
  1. Create SimpleID context (ID mapping)
  2. Build prompt:
     - Variable substitution: `maxBatchSize`, `minChapterLength`, etc.
     - Segment texts with SimpleIDs
     - If not first batch: include last chapter content + instruction:
       "The previous batch ended with Chapter X: [content]
        Determine if this chapter continues or new chapters begin.
        You can respond: 'Chapter X continues to segment Y, then new chapter Z begins at Y+1'"
  
  3. Execute AI call (through unified aiFeatureService)
  4. Parse response:
     - Extract chapters array
     - Parse SimpleID references back to real IDs via shared ai/core mapping helpers
     - Validate: all chapters within batch bounds
     - Handle chapter continuation logic
     - Normalize start/end SimpleIDs to real segment IDs via shared mapping
     - If a batch mapping fails, fall back to global SimpleID mapping for resilience
  
  5. Store results:
     - Add to suggestions[]
     - Update processedBatches, totalBatches
     - Store last batch chapters for next iteration
  
  6. Error handling:
     - If parse error: recovery strategy (lenient parsing)
     - If chapter invalid: skip or attempt reconstruction
     - If API error: cancel, show error, allow retry
```

### 3.3 Chapter Continuation Logic

**Scenario 1: Chapter ends in batch, new begins**
```
Previous batch final chapter: "Chapter 3: Conclusion" (segments 145–150)
Current batch: segments 151–250
AI response: "Chapter 3 ends at 150. Chapter 4 starts at 151."
→ Chapter 3 boundary kept. Chapter 4 created starting 151.
```

**Scenario 2: Chapter continues across batches**
```
Previous batch: Chapter 5 (segments 300–400)
Current batch: segments 401–500
Context sent: "Chapter 5: [full text from 300-400]"
AI response: "Chapter 5 continues to segment 420. Chapter 6 starts at 421."
→ Chapter 5 extended to 420. Chapter 6 created at 421.
```

**Implementation:**
- Store `lastBatchChapters` (chapters from previous batch)
- Prompt sends only the previous chapter title + text snippet; no opaque IDs
- For each chapter in `lastBatchChapters`:
  - Check AI response for continuation (matching by title)
  - If continuing: map `endsAtSimpleId` → real segment ID via simpleId mapping and extend endSegmentId
  - If new chapter starts: create new Chapter, keep extended previous

---

## 4. UI Components

### 4.1 ChaptersOutlinePanel

**Location:** Floating beside transcript (right side, desktop)

**Props:**
```typescript
interface ChaptersOutlinePanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  chapters: Chapter[];
  segments: Segment[];
  selectedChapterId: string | null;
  onJumpToChapter: (id: string) => void;
}
```

**Renders:**
- List of chapters with title, segment range
- Click to select & scroll to segment
- No edit/delete actions (orientation only)
- Non-modal: no backdrop, no blur, no focus trap
- Stays open until toggled or Esc
- Keyboard: toggle the Chapter Outline Panel (Outline / TOC)
  - macOS: `Cmd+Shift+O`
  - Windows/Linux: `Ctrl+Shift+O`

### 4.2 ChapterHeader

**Location:** Inline between segments in the transcript list (just like before, between the segment that starts the chapter and the next segment).

**Props:**
```typescript
interface ChapterHeaderProps {
  chapter: Chapter;
  tags: Tag[];
  isSelected: boolean;
  onOpen: () => void; // Selects chapter
  onUpdateChapter: (id: string, updates: ChapterUpdate) => void;
  onDeleteChapter: (id: string) => void;
  /** Auto-focus requests originate from Start Chapter Here */
  autoFocus?: boolean;
  onAutoFocusHandled?: () => void;
}
```

**Behavior:**
- The header renders as a Radix `Collapsible`. Collapsed state shows only the title + tag chips, while expanded state reveals `summary` first and `notes` second, in a low-visibility panel.
- Title editing happens inline: click the title while `document.body.dataset.transcriptEditing === "true"` or when a focus request is issued (e.g., after Start Chapter Here). An `<Input>` replaces the label; Enter/blur commits with trimmed text, Esc cancels.
- Summary and notes each become inline `<Textarea>` editors when clicked (also limited to Edit Mode). The textareas auto-save on blur/Enter and keep metadata hidden when collapsed.
- Tags render as compact `<Badge>` chips. While in edit mode, chips expose a remove control and a `+` trigger opens a local dropdown selector (mirroring the segment tag picker) to add tags.
- A delete icon (ghost button with `Trash2`) is visible only while editing, letting you drop the chapter without a confirmation modal; the rest of the content remains untouched.
- Auto-focus requests satisfy the `autoFocus` prop: the header switches to title edit state, selects the placeholder, and then calls `onAutoFocusHandled` to clear the request. This keeps “Start Chapter Here” behavior immediate and modal-free.

**Canonical behavior:**
- Chapters stay visually quiet: metadata is tucked behind the collapsible, edit controls appear only when Edit Mode is activated, and structural actions (create/delete/tag) happen through explicit buttons next to the header.

### 4.3 ChapterDetectionPanel

**Location:** New tab in AICommandPanel  
**UX:** Must follow the standardized AI Command Panel layout and behaviors (see `docs/features/architecture/ai-command-panel.md`).

**Panel Structure (no custom layout):**
1. **Scope** (standard): segment count + filters  
2. **AI Configuration** (standard): Provider + Model + Batch Size  
3. **Feature Settings** (chapter-specific): Prompt Template, Min/Max Chapter Length, Tags  
4. **Start / Progress / Stop** (standard controls)  
5. **Results Summary** (standard): pending suggestions + quick navigation

**Scope Behavior:**
- Scope filters are applied before batching; only scoped segments are sent to chapter detection.

**Rendering Rules:**
- Detailed suggestions render inline in the Transcript (not in the panel).
- The panel only shows summary items and batch controls, identical to other AI batch features.
- Keyboard navigation uses the shared AI panel bindings (`N`, `P`, `A`, `R`, `ESC`).

---

## 5. Integration Points

### 5.1 Manual Chapter Creation (Segment Menu)

**In TranscriptSegment context menu:**
```
Right-click segment:
  [...other options...]
  "Start Chapter Here" → triggers chapterSlice.startChapter()
```

**Shortcut policy:**
- The Chapter Outline Panel toggle uses `Cmd+Shift+O` / `Ctrl+Shift+O` (`O` = “Outline”).
- “Start Chapter Here” lives in the Segment Context Menu; no dedicated keyboard shortcut.

**Action handler:**
```typescript
onStartNewChapter = () => {
  const segmentId = this.props.segment.id;
  const chapterId = store.chapter.startChapter("New Chapter", segmentId);
  if (chapterId) {
    ui.requestChapterInlineFocus(chapterId); // header focuses inline title + selects placeholder
  }
};
```

### 5.2 TranscriptEditor Integration

**Rendering chapters between segments:**
```typescript
// In TranscriptEditor render loop:
segments.forEach((segment, idx) => {
  const chapter = chapterSlice.selectChapterForSegment(segment.id);
  if (chapter?.startSegmentId === segment.id) {
    <ChapterHeader chapter={chapter} onEdit={...} />
  }
  <TranscriptSegment {...} />
});
```

### 5.3 Export Integration

**Text Export:**
```typescript
// exportUtils.ts
exportToText(chapters: Chapter[], segments: Segment[], options: ExportOptions) {
  let text = "";
  let currentChapterIdx = 0;
  
  segments.forEach(segment => {
    const chapter = chapters[currentChapterIdx];
      if (chapter?.startSegmentId === segment.id) {
        text += `# ${chapter.title}\n`;
      if (options.includeChapterSummary && chapter.summary) text += `${chapter.summary}\n\n`;
      if (options.includeChapterNotes && chapter.notes) text += `${chapter.notes}\n\n`;
      if (options.includeChapterTags && chapter.tags?.length) {
        const labels = chapter.tags.map((id) => tagsStore.getTag(id)?.name ?? id);
        text += `${labels.map((l) => `[${l}]`).join(" ")}\n\n`;
      }
      currentChapterIdx++;
    }
    text += formatSegment(segment) + "\n";
  });
  
  return text;
}
```

**JSON Export:**
```typescript
// Option 1: Chapters as metadata in first segment
exportToJSON(chapters, segments, { chapterStructure: "metadata" }) {
  const result = { segments: [] };
  chapters.forEach((chapter, idx) => {
    const startSegmentIdx = segments.findIndex(s => s.id === chapter.startSegmentId);
    segments[startSegmentIdx]._chapterMetadata = {
      title: chapter.title,
      summary: chapter.summary,
      notes: chapter.notes,
      tags: chapter.tags,
      chapterIndex: idx,
    };
  });
  result.segments = segments;
  return result;
}

// Option 2: Separate chapters structure
exportToJSON(chapters, segments, { chapterStructure: "separate" }) {
  return {
    chapters: chapters.map(ch => ({
      ...ch,
      segments: segments.filter(s => 
        chapterSlice.isSegmentInChapter(s.id, ch.id)
      ).map(s => s.id)
    })),
    segments: segments
  };
}
```

### 5.4 Tag System Integration

- Chapters use the existing `Tag` system.
- `Chapter.tags` stores a list of `Tag.id` values.
- UI shows tags as compact badges (collapsed chapter header) to avoid timeline clutter.
- Tag CRUD remains owned by the tag system; chapters only reference tags.

---

## 6. AI Feature Registration

**In `client/src/lib/ai/features/chapterDetection/config.ts`:**

```typescript
export const chapterDetectionConfig: AIFeatureConfig = {
  id: "chapter-detection",
  name: "Chapter Detection",
  category: "structural",
  systemPrompt: `You are an expert at analyzing transcripts and identifying natural chapter boundaries...`,
  userPromptTemplate: `
Analyze the following transcript segments and identify coherent chapters.

Variables:
- maxBatchSize: {{maxBatchSize}}
- minChapterLength: {{minChapterLength}} segments
- maxChapterLength: {{maxChapterLength}} segments
- tagsAvailable: {{tagsAvailable}}

Segments:
{{#each segments}}
{{this.simpleId}}. [{{this.speaker}}] {{this.text}}
{{/each}}

{{#if previousChapter}}
Note: The previous batch ended with:
Chapter: {{previousChapter.title}}
Content: {{previousChapter.text}}
Determine if this chapter continues or new chapters begin.
{{/if}}

Return JSON response with chapters array...
  `,
  batchable: true,
  streamable: false,
  defaultBatchSize: 100,
  requiresConfirmation: false,
  availablePlaceholders: [
    "maxBatchSize",
    "minChapterLength",
    "maxChapterLength",
    "tagsAvailable",
    "segments",
    "previousChapter"
  ],
  responseSchema: chapterDetectionResponseSchema
};
```

**Prompt Templates (Settings):**
- Templates are managed in Settings → AI Prompts (same system as other AI features).
- `activePromptId` selects the template; templates are persisted in the AI prompts store.

**Response Schema (Zod):**
```typescript
export const chapterDetectionResponseSchema = z.object({
  chapters: z.array(z.object({
    title: z.string(),
    summary: z.string().optional(),
    tags: z.array(z.string()).optional(),
    start: z.number(),
    end: z.number(),
  })),
  chapterContinuation: z.object({
    lastChapterTitle: z.string(),
    endsAtSimpleId: z.number(),
    continuesIntoNextBatch: z.boolean(),
  }).optional(),
});
```

---

## 7. Error Handling & Recovery

### 7.1 Validation Rules

```typescript
const chapterValidationRules: ValidationRule<ChapterSuggestion>[] = [
  {
    name: "no-overlaps",
    validate: (chapters) => {
      // Check chapters don't overlap
    }
  },
  {
    name: "valid-segment-ids",
    validate: (chapters) => {
      // Check all segment IDs exist
    }
  },
  {
    name: "min-length",
    validate: (chapters, config) => {
      // Check each chapter >= minChapterLength
    }
  },
  {
    name: "sequential",
    validate: (chapters) => {
      // Check chapters are in order (no backward references)
    }
  }
];
```

### 7.2 Recovery Strategies

**If AI returns invalid JSON:**
- Strategy: Lenient JSON extraction (get as much as possible)
- Fallback: Return empty chapters (user can retry)

**If chapters exceed batch bounds:**
- Strategy: Trim to batch bounds (ignore overflow)
- Log warning via logging service (debug-only)

**If segment IDs not found:**
- Strategy: Use array indices as fallback, map later
- Validate during acceptance

---

## 8. Invariants & Gotchas

✅ **No Overlapping Chapters:** Enforced on all add/update  
✅ **Batch Overlap Logic:** Last batch chapters sent to next batch for continuation detection  
✅ **Atomic Accept All:** Single store action, single undo entry  
✅ **Manual-First:** Chapters exist independent of AI  
✅ **Coexistence:** Manual chapters and AI proposals/accepted results can coexist; user chooses what to keep  
⚠️ **Manual vs. AI:** If conflict during acceptance, surface to user; do not silently overwrite manual chapters  
⚠️ **SimpleID Mapping:** Critical for batch processing — must roundtrip correctly

---

## 9. Testing Strategy

### Unit Tests
- **Batch utilities:** `createChapterDetectionBatch()`, overlap logic
- **Validation:** `chapterValidationRules`
- **Response parsing:** `parseChapterResponse()` with various inputs
- **Store actions:** `startChapter()`, `updateChapter()`, `deleteChapter()`

### Integration Tests
- **Full workflow:** Manual add → Edit → Delete
- **AI workflow:** Start detection → Accept/Reject → Verify chapters created
- **Batch processing:** Multi-batch detection with overlaps

### Coverage
- **Target:** >80% overall
- **Pure logic (batch, parsing):** 90%+
- **UI components:** 60%+ (focus on state logic)

---

## 10. Implementation Sequence

1. Define types & store slices (chapterSlice + aiChapterDetectionSlice)
2. Create Chapter management UI (ChaptersOutlinePanel, inline ChapterHeader, segment menu integration)
3. Implement manual chapter CRUD
4. Create ChapterDetectionPanel UI (configuration section)
5. Implement batch utility functions (slicing, mapping, overlap)
6. Create chapterDetection AI feature (config, prompt template, parsing)
7. Implement batch processing service
8. Integrate AI results → store → UI
9. Export integration (text + JSON)
10. Testing & validation
11. Documentation update

---

*For user-facing features, see [ai-chapter-detection.md](../ai-chapter-detection.md)*
