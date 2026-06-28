# Batch Rewrite Chapter Blueprint

This is the implementation blueprint for adding batch processing to the existing Chapter Rewrite feature. It is intentionally explicit so an implementation agent can follow it without guessing.

## Goal

Add a new **Rewrite** tab to the AI Command Panel. It rewrites all chapters top-to-bottom, creates pending rewrite drafts, shows batch progress and a batch log, supports cancellation, and reuses the existing full-screen `ChapterRewriteView` when clicking a batch item.

The batch must run sequentially. Do not add concurrency. The pending rewrite draft of the previous chapter must be used as context for the next chapter, even if the previous draft has not been accepted yet.

## Existing Files To Reuse

- `client/src/lib/ai/features/rewrite/service.ts`: reuse `rewriteChapter()`.
- `client/src/lib/store/slices/rewriteSlice.ts`: extend this slice.
- `client/src/components/rewrite/ChapterRewriteView.tsx`: reuse for side-by-side review.
- `client/src/components/AICommandPanel/AIBatchControlSection.tsx`: reuse for progress/start/stop.
- `client/src/components/AICommandPanel/AIConfigurationSection.tsx`: reuse for provider/model/prompt.
- `client/src/components/AICommandPanel/AIResultsSection.tsx`: reuse for result section.
- `client/src/components/AICommandPanel/ResultsList.tsx`: reuse for draft item list.
- `client/src/lib/ai/export/batchLogExport.ts`: extend for rewrite batch log export.

## Non-Goals

- Do not remove or rewrite the existing single-chapter rewrite flow.
- Do not create a second side-by-side view.
- Do not add per-chapter custom instructions in the batch UI.
- Do not add concurrency or a concurrency setting.
- Do not persist batch processing state.

## Store Changes

### File: `client/src/lib/store/slices/rewriteSlice.ts`

Add these exported types near `RewriteDraft`:

```ts
export type RewriteBatchItemStatus =
  | "pending"
  | "processing"
  | "done"
  | "failed"
  | "skipped"
  | "cancelled";

export interface RewriteBatchLogEntry {
  chapterId: string;
  chapterTitle: string;
  status: RewriteBatchItemStatus;
  loggedAt: number;
  durationMs?: number;
  error?: string;
  promptId?: string;
}
```

Extend the `RewriteSlice` interface:

```ts
batchRewriteIsProcessing: boolean;
batchRewriteIsCancelling: boolean;
batchRewriteProcessedCount: number;
batchRewriteTotalCount: number;
batchRewriteError: string | null;
batchRewriteAbortController: AbortController | null;
batchRewriteLog: RewriteBatchLogEntry[];

startBatchRewrite: (options: {
  promptId: string;
  customInstructions?: string;
  skipAlreadyRewritten?: boolean;
}) => void;
cancelBatchRewrite: () => void;
acceptAllBatchRewrites: () => void;
rejectAllBatchRewrites: () => void;
```

Extend `initialRewriteState`:

```ts
batchRewriteIsProcessing: false,
batchRewriteIsCancelling: false,
batchRewriteProcessedCount: 0,
batchRewriteTotalCount: 0,
batchRewriteError: null,
batchRewriteAbortController: null,
batchRewriteLog: [] as RewriteBatchLogEntry[],
```

Add this import:

```ts
import { buildSegmentIndexMap, sortChaptersByStart } from "../utils/chapters";
```

### File: `client/src/lib/store/types.ts`

In `InitialStoreState`, next to the existing rewrite fields, add:

```ts
batchRewriteIsProcessing: boolean;
batchRewriteIsCancelling: boolean;
batchRewriteProcessedCount: number;
batchRewriteTotalCount: number;
batchRewriteError: string | null;
batchRewriteAbortController: AbortController | null;
batchRewriteLog: import("./slices/rewriteSlice").RewriteBatchLogEntry[];
```

## `startBatchRewrite` Requirements

Implement `startBatchRewrite` inside `createRewriteSlice`.

Exact behavior:

1. If a previous `batchRewriteAbortController` exists, abort it first.
2. Find the selected prompt in `state.aiChapterDetectionConfig.prompts` by `promptId`.
3. If no prompt exists, set `batchRewriteError` to `t("aiBatch.errors.promptNotFound", { id: promptId })` and return.
4. If the prompt has empty `systemPrompt` or `userPromptTemplate`, set the same error and return.
5. Sort chapters in document order:

```ts
const indexMap = buildSegmentIndexMap(state.segments);
const sortedChapters = sortChaptersByStart(state.chapters, indexMap);
```

6. If `skipAlreadyRewritten` is true, exclude chapters where either `chapter.rewrittenText` exists or `state.rewriteDraftByChapterId[chapter.id]` exists.
7. If no chapters remain, set `batchRewriteError` to `t("rewriteBatch.errors.noChapters")` and return.
8. Create a new `AbortController`.
9. Set processing state:

```ts
set({
  batchRewriteIsProcessing: true,
  batchRewriteIsCancelling: false,
  batchRewriteProcessedCount: 0,
  batchRewriteTotalCount: chaptersToProcess.length,
  batchRewriteError: null,
  batchRewriteAbortController: abortController,
  batchRewriteLog: [],
});
```

10. Process chapters with a plain sequential `for` loop. Do not use `Promise.all`, `runConcurrentOrdered`, `runBatchCoordinator`, or any concurrency helper.
11. Before each request, add a `processing` log entry:

```ts
const processingEntry: RewriteBatchLogEntry = {
  chapterId: chapter.id,
  chapterTitle: chapter.title,
  status: "processing",
  loggedAt: Date.now(),
  promptId,
};
```

12. Get chapter segments with `get().selectSegmentsInChapter(chapter.id)`.
13. If no segments exist, replace the processing log entry with `skipped`, update processed count, and continue.
14. Before calling `rewriteChapter()`, build a temporary chapter list where pending drafts are exposed as `rewrittenText`:

```ts
const currentDrafts = get().rewriteDraftByChapterId;
const allChaptersWithDrafts = get().chapters.map((item) => {
  const draft = currentDrafts[item.id];
  return draft?.text ? { ...item, rewrittenText: draft.text } : item;
});
```

This is mandatory. `rewriteChapter()` already builds previous-chapter context from `chapter.rewrittenText`. Pending batch drafts are not accepted yet, so the batch must temporarily overlay draft text as `rewrittenText` only for this call.

15. Call `rewriteChapter()` like this:

```ts
const result = await rewriteChapter({
  chapter,
  segments,
  allChapters: allChaptersWithDrafts,
  prompt,
  providerId: get().aiChapterDetectionConfig.selectedProviderId,
  model: get().aiChapterDetectionConfig.selectedModel,
  signal: abortController.signal,
  includeContext: get().aiChapterDetectionConfig.includeContext,
  contextWordLimit: get().aiChapterDetectionConfig.contextWordLimit,
  customInstructions,
});
```

16. On success, store a draft only:

```ts
get().setRewriteDraft(chapter.id, {
  text: result.rewrittenText,
  promptId,
  providerId: get().aiChapterDetectionConfig.selectedProviderId,
  model: get().aiChapterDetectionConfig.selectedModel,
});
```

Do not call `setChapterRewrite()` here.

17. Replace the processing log entry with `done`, including `durationMs`, and update `batchRewriteProcessedCount`.
18. On non-abort errors, replace the processing log entry with `failed`, include `error`, update processed count, and continue with the next chapter.
19. On `AbortError` or `abortController.signal.aborted`, mark current and remaining chapters as `cancelled`, set processing/cancelling to false, clear the abort controller, and stop.
20. After the loop finishes, set:

```ts
set({
  batchRewriteIsProcessing: false,
  batchRewriteIsCancelling: false,
  batchRewriteAbortController: null,
  batchRewriteError: null,
});
```

## Other Store Actions

### `cancelBatchRewrite`

```ts
cancelBatchRewrite: () => {
  const state = get();
  state.batchRewriteAbortController?.abort();
  set({ batchRewriteIsCancelling: true });
},
```

### `acceptAllBatchRewrites`

Iterate over `rewriteDraftByChapterId`. For every existing draft:

```ts
state.setChapterRewrite(chapterId, draft.text, {
  promptId: draft.promptId,
  providerId: draft.providerId,
  model: draft.model,
});
state.clearRewriteDraft(chapterId);
state.setChapterDisplayMode(chapterId, "rewritten");
```

### `rejectAllBatchRewrites`

Iterate over `Object.keys(state.rewriteDraftByChapterId)` and call `state.clearRewriteDraft(chapterId)`. Do not call `setChapterRewrite()`.

## Batch Log Export

### File: `client/src/lib/ai/export/batchLogExport.ts`

Extend `BatchLogExportFeatureType`:

```ts
export type BatchLogExportFeatureType =
  | "speaker-classification"
  | "segment-merge"
  | "chapter-detection"
  | "revision"
  | "chapter-rewrite";
```

Add:

```ts
import type { RewriteBatchLogEntry } from "@/lib/store/slices/rewriteSlice";

export interface RewriteBatchLogExportRow {
  chapterId: string;
  chapterTitle: string;
  status: string;
  loggedAt: number;
  durationMs?: number;
  error?: string;
  promptId?: string;
}

export function mapRewriteBatchLogEntryToExport(
  entry: RewriteBatchLogEntry,
): RewriteBatchLogExportRow {
  return {
    chapterId: entry.chapterId,
    chapterTitle: entry.chapterTitle,
    status: entry.status,
    loggedAt: entry.loggedAt,
    durationMs: entry.durationMs,
    error: entry.error,
    promptId: entry.promptId,
  };
}

export function exportRewriteBatchLog(rows: RewriteBatchLogEntry[], filename: string): void {
  const payload = buildBatchLogExport("chapter-rewrite", rows.map(mapRewriteBatchLogEntryToExport));
  downloadAsJson(payload, filename);
}
```

## UI: New Rewrite Panel

### New File: `client/src/components/AICommandPanel/RewritePanel.tsx`

Create a new component `RewritePanel` with props:

```ts
interface RewritePanelProps {
  onOpenSettings: () => void;
}
```

Use these store selectors:

- `chapters`
- `segments`
- `aiChapterDetectionConfig`
- `rewriteDraftByChapterId`
- `batchRewriteIsProcessing`
- `batchRewriteIsCancelling`
- `batchRewriteProcessedCount`
- `batchRewriteTotalCount`
- `batchRewriteError`
- `batchRewriteLog`
- `startBatchRewrite`
- `cancelBatchRewrite`
- `acceptAllBatchRewrites`
- `rejectAllBatchRewrites`

Use `useAiSettingsSelection()` exactly like `ChapterPanel` does.

Local state:

```ts
const [selectedPromptId, setSelectedPromptId] = useState(() => rewritePrompts[0]?.id ?? "");
const [customInstructions, setCustomInstructions] = useState("");
const [skipAlreadyRewritten, setSkipAlreadyRewritten] = useState(false);
const [activeViewChapterId, setActiveViewChapterId] = useState<string | null>(null);
const [isLogOpen, setIsLogOpen] = useState(false);
```

Prompt options must be:

```ts
const rewritePrompts = config.prompts.filter((prompt) => prompt.operation === "rewrite");
```

Chapter order must be:

```ts
const indexMap = buildSegmentIndexMap(segments);
const sortedChapters = sortChaptersByStart(chapters, indexMap);
```

Draft list:

```ts
const draftsWithChapters = sortedChapters.filter(
  (chapter) => !!rewriteDraftByChapterId[chapter.id],
);
```

Start handler:

```ts
startBatchRewrite({
  promptId: selectedPromptId,
  customInstructions: customInstructions.trim() || undefined,
  skipAlreadyRewritten,
});
```

Render sections in this order:

1. Scope section with chapter count and skip checkbox.
2. `AIConfigurationSection` with provider/model/prompt only. Do not pass `batchSize` or `onBatchSizeChange`.
3. `Textarea` for custom instructions.
4. `AIBatchControlSection` with processed/total counts and stop/start actions.
5. Batch log drawer or drawer-like inline log with export.
6. `AIResultsSection` with `ResultsList` for `draftsWithChapters`.
7. Accept All and Reject All buttons when drafts exist.
8. Conditional `ChapterRewriteView`:

```tsx
{activeViewChapterId && (
  <ChapterRewriteView
    chapterId={activeViewChapterId}
    onClose={() => setActiveViewChapterId(null)}
  />
)}
```

Clicking a result item must call `setActiveViewChapterId(chapter.id)`.

## UI: AI Command Panel Tab

### File: `client/src/components/AICommandPanel/AICommandPanel.tsx`

Add import:

```ts
import { useTranslation } from "react-i18next";
import { RewritePanel } from "./RewritePanel";
```

Extend tab type:

```ts
export type AICommandPanelTab = "revision" | "speaker" | "merge" | "chapters" | "rewrite";
```

Inside the component:

```ts
const { t } = useTranslation();
```

Add tab:

```ts
{ id: "rewrite", label: t("rewriteBatch.tabLabel") }
```

Add panel rendering:

```tsx
{activeTab === "rewrite" && <RewritePanel onOpenSettings={onOpenSettings} />}
```

While touching this file, replace existing hardcoded user-facing tab labels and panel title/close label with i18n if feasible. At minimum, the new Rewrite tab must use i18n.

## i18n

### File: `client/src/translations/en.json`

Add `rewrite.view.close`:

```json
"close": "Close"
```

Add top-level `rewriteBatch`:

```json
"rewriteBatch": {
  "tabLabel": "Rewrite",
  "scopeTitle": "Scope",
  "chaptersCount": "{{count}} chapter",
  "chaptersCount_plural": "{{count}} chapters",
  "skipAlreadyRewritten": "Skip already rewritten chapters",
  "skipAlreadyRewrittenHelp": "Skip chapters that already have an accepted or pending rewrite",
  "customInstructions": {
    "label": "Additional instructions (optional)",
    "placeholder": "Additional notes to include in the prompt for all chapters"
  },
  "batchLogTitle": "Rewrite Log",
  "batchLogDescription": "Per-chapter batch rewrite status.",
  "batchLogTriggerLabel": "Rewrite Log",
  "status": {
    "pending": "Pending",
    "processing": "Processing",
    "done": "Done",
    "failed": "Failed",
    "skipped": "Skipped",
    "cancelled": "Cancelled"
  },
  "results": {
    "draftsTitle": "Drafts ({{count}} pending)"
  },
  "errors": {
    "noChapters": "No chapters to rewrite"
  },
  "noChaptersInTranscript": "No chapters in transcript. Add chapters first."
}
```

### File: `client/src/translations/de.json`

Add `rewrite.view.close`:

```json
"close": "Schließen"
```

Add top-level `rewriteBatch`:

```json
"rewriteBatch": {
  "tabLabel": "Rewrite",
  "scopeTitle": "Bereich",
  "chaptersCount": "{{count}} Kapitel",
  "chaptersCount_plural": "{{count}} Kapitel",
  "skipAlreadyRewritten": "Bereits umgeschriebene Kapitel überspringen",
  "skipAlreadyRewrittenHelp": "Kapitel überspringen, die bereits einen angenommenen oder ausstehenden Rewrite haben",
  "customInstructions": {
    "label": "Zusätzliche Anweisungen (optional)",
    "placeholder": "Zusätzliche Hinweise für alle Kapitel im Prompt"
  },
  "batchLogTitle": "Rewrite-Log",
  "batchLogDescription": "Status des Batch-Rewrites pro Kapitel.",
  "batchLogTriggerLabel": "Rewrite-Log",
  "status": {
    "pending": "Ausstehend",
    "processing": "Wird verarbeitet",
    "done": "Fertig",
    "failed": "Fehlgeschlagen",
    "skipped": "Übersprungen",
    "cancelled": "Abgebrochen"
  },
  "results": {
    "draftsTitle": "Entwürfe ({{count}} ausstehend)"
  },
  "errors": {
    "noChapters": "Keine Kapitel zum Umschreiben vorhanden"
  },
  "noChaptersInTranscript": "Kein Kapitel im Transkript vorhanden. Bitte zuerst Kapitel hinzufügen."
}
```

### File: `client/src/components/rewrite/ChapterRewriteView.tsx`

Change:

```tsx
aria-label={t("rewrite.view.close", { defaultValue: "Schließen" })}
```

to:

```tsx
aria-label={t("rewrite.view.close")}
```

## Tests

### New File: `client/src/lib/store/slices/__tests__/rewriteSlice.batch.test.ts`

Base it on `rewriteSlice.test.ts`. Mock the service:

```ts
vi.mock("@/lib/ai/features/rewrite/service", () => ({
  rewriteChapter: vi.fn(),
  rewriteParagraph: vi.fn(),
}));
```

Required tests:

- Initial batch state is idle.
- `startBatchRewrite` processes chapters sequentially and sets drafts.
- Pending draft from chapter N is passed to chapter N+1 via `allChapters[].rewrittenText`.
- `skipAlreadyRewritten=true` skips chapters with accepted `rewrittenText`.
- `skipAlreadyRewritten=true` skips chapters with pending drafts.
- `skipAlreadyRewritten=false` processes chapters even when they already have `rewrittenText`.
- A failed chapter is logged as `failed` and the next chapter still runs.
- Empty chapter segments are logged as `skipped`.
- After completion, `batchRewriteIsProcessing` is false and `batchRewriteAbortController` is null.
- `cancelBatchRewrite` aborts the controller and sets `batchRewriteIsCancelling=true`.
- Abort marks current/remaining chapters as `cancelled`.
- Invalid prompt sets `batchRewriteError` and does not call `rewriteChapter`.
- No chapters to process sets `batchRewriteError`.
- `acceptAllBatchRewrites` calls `setChapterRewrite`, clears drafts, and sets display mode to `rewritten`.
- `rejectAllBatchRewrites` clears drafts and never calls `setChapterRewrite`.

The most important test is draft-as-context:

```ts
const chapter2Call = (rewriteChapter as ReturnType<typeof vi.fn>).mock.calls[1][0];
const previous = chapter2Call.allChapters.find((chapter) => chapter.id === "chapter-1");
expect(previous.rewrittenText).toBe("Draft text for chapter 1");
```

### New File: `client/src/components/AICommandPanel/__tests__/RewritePanel.test.tsx`

Base it on `ChapterPanel.test.tsx` and use `renderWithI18n`.

Required tests:

- Shows chapter count.
- Shows empty-state text when no chapters exist.
- Start button is disabled when there is no rewrite prompt.
- Start button is disabled when no chapters can be processed.
- Clicking Start calls `startBatchRewrite` with `promptId`, `customInstructions`, and `skipAlreadyRewritten`.
- Checking skip checkbox passes `skipAlreadyRewritten: true`.
- Draft list appears when `rewriteDraftByChapterId` contains drafts.
- Clicking a draft item opens `ChapterRewriteView`.
- Accept All calls `acceptAllBatchRewrites`.
- Reject All calls `rejectAllBatchRewrites`.
- Batch log trigger appears when `batchRewriteLog` has entries.

## Documentation Updates

### File: `docs/features/ai-chapter-rewrite.md`

Replace the existing “Coming Soon” batch rewrite note with a real section:

```md
## Batch Rewrite

The Batch Rewrite feature processes all chapters sequentially from top to bottom and creates a pending rewrite draft for each chapter.

Open the AI Command Panel and select the Rewrite tab. Choose provider, model, prompt, optional additional instructions, and whether already rewritten chapters should be skipped.

Processing is intentionally sequential. Each chapter can use the previous chapter's rewritten text as context. If the previous chapter only has a pending draft, that draft is used as context.

Click any item in the Drafts list to open the standard side-by-side review. Accept or reject individually, or use Accept All / Reject All for bulk handling.

Failed chapters can be retried by opening the item and using Regenerate in the review view.
```

### File: `docs/features/architecture/README.md`

Add a reference to this document under feature-specific architecture.

## Verification

After implementation, run the full required loop:

```bash
source ~/.nvm/nvm.sh && nvm use && npm run check
source ~/.nvm/nvm.sh && nvm use && npm run lint:fix
source ~/.nvm/nvm.sh && nvm use && npm test
```

If `lint:fix` changes files, run `npm run check` and `npm test` again.

## Commit Message Suggestion

```text
feat(rewrite): add batch chapter rewrite blueprint

Documents the batch rewrite architecture, store extensions, UI requirements,
draft-as-context behavior, test plan, and verification steps.
```
