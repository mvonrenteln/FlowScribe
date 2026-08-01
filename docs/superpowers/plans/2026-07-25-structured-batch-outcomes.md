# Structured Batch Outcomes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make speaker classification, segment merge, and chapter detection return explicit `ok`, `empty`, or `error` outcomes, with valid empty results treated as terminal successes and every failure exposing its origin and retryability.

**Architecture:** Add an opt-in `responseFormat: "structured-batch"` flag to existing feature configs and extend `executeFeature` rather than creating a parallel API. One pure parser validates the discriminated envelope manually because `SimpleSchema` cannot represent status-dependent fields, literal `false`, `null`, or empty-versus-non-empty arrays; existing feature schemas continue validating `ok.data`.

**Tech Stack:** TypeScript strict mode, existing AI core/provider/parser layers, existing `SimpleSchema`, Vitest, Biome, npm 11, Node 24.

## Global Constraints

- Repository root: `/Users/marc.von-renteln/GitHub/FlowScribe`; all paths below are relative to it.
- Read the applicable DOX chain before editing: root, `client/`, `client/src/`, `client/src/lib/`, `client/src/lib/ai/`, `docs/`, and `docs/features/`.
- No new dependencies, UI, settings, translations, caching, XML cleanup, or text-only operation changes.
- Do not migrate chapter metadata; only speaker classification, segment merge, and chapter detection participate.
- Preserve the existing parse-attempt limit. Phase 1 adds no provider retry loop, model-error retry loop, or corrective retry messages.
- Do not remove lenient recovery globally. Skip it only for features configured as `structured-batch`.
- `empty` is a successful terminal outcome, has `retryable: false`, and counts as succeeded.
- Empty bodies, malformed/truncated JSON, and schema mismatches are parser failures, never `empty`.
- Model, provider, and parser failures remain distinguishable.
- Documentation and code comments must be English. Do not use `any`.
- Before each commit inspect `git status --short`, the task diff, `git log --oneline -10`, and `git diff --check`; stage only intended files.
- After each code task, run the full gate:

```bash
source ~/.nvm/nvm.sh && nvm use && npm run check
source ~/.nvm/nvm.sh && nvm use && npm run lint:fix
source ~/.nvm/nvm.sh && nvm use && npm run check
source ~/.nvm/nvm.sh && nvm use && npm test
```

If `lint:fix` changes files, rerun that task's focused test before the second `check`. Confirm explicit Vitest passed/failed counts.

## Exact File Map

### Create

- `client/src/lib/ai/parsing/structuredBatchResponse.ts`
- `client/src/lib/ai/__tests__/structuredBatchResponse.test.ts`

### Modify

- `client/src/lib/ai/core/types.ts:45-84,88-177`
- `client/src/lib/ai/core/errors.ts:208-309`
- `client/src/lib/ai/core/aiFeatureService.ts:62-296,539-665`
- `client/src/lib/ai/parsing/types.ts:46-109`
- `client/src/lib/ai/__tests__/errors.test.ts:148-212`
- `client/src/lib/ai/__tests__/aiFeatureService.test.ts:1-120`
- `client/src/lib/ai/features/speaker/config.ts:13-125`
- `client/src/lib/ai/features/speaker/service.ts:105-269`
- `client/src/lib/ai/__tests__/speakerService.test.ts:17-169`
- `client/src/lib/ai/features/segmentMerge/config.ts:13-197`
- `client/src/lib/ai/features/segmentMerge/service.ts:158-338`
- `client/src/lib/ai/features/segmentMerge/__tests__/config.test.ts:15-87`
- `client/src/lib/ai/features/segmentMerge/__tests__/service.test.ts:22-108`
- `client/src/lib/ai/features/chapterDetection/config.ts:12-117`
- `client/src/lib/ai/features/chapterDetection/types.ts:16-30`
- `client/src/lib/ai/features/chapterDetection/utils.ts:37-77`
- `client/src/lib/ai/features/chapterDetection/service.ts:148-345`
- `client/src/lib/ai/features/chapterDetection/__tests__/service.test.ts:31-92`
- `client/src/lib/ai/features/chapterDetection/__tests__/utils.test.ts`
- `docs/features/architecture/ai-features-unified.md:705-841,1575-1647`
- `client/src/lib/ai/AGENTS.md:15-30`

### Intentionally Unchanged

- `parsing/validator.ts`: reuse it for `ok.data`; do not broaden its schema language.
- `parsing/responseParser.ts`: legacy parsing and recovery remain available to non-migrated features.
- `features/segmentMerge/responseProcessor.ts`: successful data still passes through it; failed structured results will no longer be sent to it.
- Text revision, rewrite, content transformation, providers, settings, UI, and translations.

## Interfaces

Add these contracts to existing type files:

```typescript
export type StructuredBatchStatus = "ok" | "empty" | "error";

export type StructuredBatchErrorSource = "model" | "provider" | "parser";

export type StructuredBatchModelErrorCode =
  | "MISSING_REQUIRED_INPUT"
  | "INVALID_INPUT_SHAPE"
  | "CONTRADICTORY_INPUT"
  | "UNSUPPORTED_TASK"
  | "OUTPUT_TRUNCATED"
  | "TEMPORARY_FAILURE";

export interface StructuredBatchModelError {
  code: StructuredBatchModelErrorCode;
  message: string;
}

export type StructuredBatchResponse<TItem> =
  | {
      status: "ok";
      retryable: false;
      data: TItem[];
      error: null;
    }
  | {
      status: "empty";
      retryable: false;
      data: [];
      error: null;
    }
  | {
      status: "error";
      retryable: boolean;
      data: [];
      error: StructuredBatchModelError;
    };

export interface StructuredBatchParserFailure {
  code: ParseErrorCode;
  message: string;
  diagnostics: ValidationError[];
}

export type StructuredBatchParseResult<TItem> =
  | {
      success: true;
      response: StructuredBatchResponse<TItem>;
    }
  | {
      success: false;
      error: StructuredBatchParserFailure;
    };

export function parseStructuredBatchResponse<TItem>(
  input: string,
  dataSchema: SimpleSchema,
): StructuredBatchParseResult<TItem>;
```

Extend existing core contracts without adding another executor:

```typescript
export interface AIFeatureConfig {
  // Existing fields remain unchanged.
  responseSchema?: ResponseSchema;
  responseFormat?: "structured-batch";
}

export interface AIFeatureResult<T> {
  success: boolean;
  data?: T;
  error?: string;
  errorCode?: string;
  rawResponse?: string;
  status?: StructuredBatchStatus;
  retryable?: boolean;
  errorSource?: StructuredBatchErrorSource;
  parserFailure?: StructuredBatchParserFailure;
  metadata: {
    featureId: AIFeatureType;
    providerId: string;
    model: string;
    durationMs: number;
    tokenUsage?: {
      prompt: number;
      completion: number;
      total: number;
    };
    retryAttempts?: number;
  };
}

export interface RetryAttemptInfo {
  attempt: number;
  maxAttempts: number;
  errorMessage: string;
  errorCode: ParseErrorCode;
  diagnostics: ValidationError[];
  attemptDurationMs: number;
}
```

`executeFeature<TOutput>` keeps its existing signature:

```typescript
export async function executeFeature<TOutput>(
  featureId: AIFeatureType,
  variables: PromptVariables,
  options?: AIFeatureOptions,
): Promise<AIFeatureResult<TOutput>>;
```

For migrated features, `TOutput` is the item array type. Runtime `status` is guaranteed by `responseFormat`, while optional fields preserve compatibility for existing text-only callers and test mocks.

## Retryability Contract

Use this exact model-code table in the parser:

```typescript
export const STRUCTURED_BATCH_MODEL_ERROR_RETRYABILITY = {
  MISSING_REQUIRED_INPUT: false,
  INVALID_INPUT_SHAPE: false,
  CONTRADICTORY_INPUT: false,
  UNSUPPORTED_TASK: false,
  OUTPUT_TRUNCATED: true,
  TEMPORARY_FAILURE: true,
} as const satisfies Readonly<Record<StructuredBatchModelErrorCode, boolean>>;
```

Every migrated model prompt must explain the codes with these concrete examples:

| Model-observable situation | Code | Retryable |
| --- | --- | --- |
| The request contains no segments or another required input block is missing. | `MISSING_REQUIRED_INPUT` | No; the input must change. |
| A required input block exists but has the wrong shape, such as malformed segment records. | `INVALID_INPUT_SHAPE` | No; resending the same input cannot fix it. |
| Input facts or instructions contradict each other, so no valid result can be chosen. | `CONTRADICTORY_INPUT` | No; the contradiction must be resolved. |
| The requested task cannot be performed from the supplied content. | `UNSUPPORTED_TASK` | No; the task or input must change. |
| The model can determine that its generated output was cut off before the complete envelope was produced. | `OUTPUT_TRUNCATED` | Yes; a fresh generation may complete. |
| The model temporarily cannot complete otherwise valid input. | `TEMPORARY_FAILURE` | Yes; a fresh generation may succeed. |

The prompts must also state that authentication, network, rate-limit, timeout, and server failures are classified by the application because the model cannot observe them. A valid request with no matches is `empty`, not an `error`.

Add this existing-core helper in `core/errors.ts`:

```typescript
export function isRetryableAIError(error: AIError): boolean;
```

It must classify:

| Failure | Retryable |
| --- | --- |
| Empty body; malformed, truncated, or schema-invalid output | Yes |
| Network interruption or request timeout | Yes |
| HTTP 408, 429, or 5xx | Yes |
| HTTP 400, 401, 403, or 422 | No |
| Authentication failure | No |
| Unknown model or unsupported provider option | No |
| Missing local configuration | No |
| User cancellation | No |
| Unknown/unclassified failure | No |

The helper may use existing normalized classes/codes and `details.statusCode`; do not add retry state to every error subclass.

---

## Task 1: Add the Envelope Parser and Retryability Classifier

**Files:**
- Create `client/src/lib/ai/parsing/structuredBatchResponse.ts`
- Create `client/src/lib/ai/__tests__/structuredBatchResponse.test.ts`
- Modify `client/src/lib/ai/parsing/types.ts:46-109`
- Modify `client/src/lib/ai/core/errors.ts:208-309`
- Modify `client/src/lib/ai/__tests__/errors.test.ts:148-212`

- [ ] **Write failing parser tests**

Use an array schema containing required `{ id: string }` items. Cover:

- valid non-empty `ok`,
- valid empty,
- all six valid model error codes,
- empty body -> `EMPTY_RESPONSE`,
- malformed and truncated JSON -> `INVALID_JSON`,
- unknown status,
- `ok` with empty data, retryable true, or non-null error,
- `empty` with non-empty data, retryable true, or non-null error,
- `error` with non-empty data, null error, unknown code, empty message, or mismatched retryability,
- invalid `ok.data` producing `SCHEMA_MISMATCH` and field diagnostics,
- a top-level raw array being rejected.

- [ ] **Write failing runtime retryability tests**

In `errors.test.ts`, test network interruption, timeout `AbortError`, 408, 429, 500, and 503 as retryable. Test 400, 401, 403, 422, auth, configuration, cancellation, unknown model/request rejection, and generic unknown errors as non-retryable.

- [ ] **Run focused tests and confirm failure**

```bash
source ~/.nvm/nvm.sh && nvm use && npm test -- client/src/lib/ai/__tests__/structuredBatchResponse.test.ts client/src/lib/ai/__tests__/errors.test.ts
```

Expected failure: the parser module, structured types, and `isRetryableAIError` do not exist.

- [ ] **Implement the minimal parser**

Use `extractJSON` directly, then manually validate the envelope because `SimpleSchema` cannot express its discriminated union.

Rules:

1. Require a non-null, non-array object.
2. Require `status`, `retryable`, `data`, and `error`.
3. `ok`: retryable false, error null, non-empty array, and successful `validate(data, dataSchema, false)`.
4. `empty`: retryable false, error null, exactly `[]`.
5. `error`: exactly `[]`, known code, non-empty message, and retryability matching the code table.
6. Preserve extraction `ParseError` codes.
7. Return `SCHEMA_MISMATCH` with `ValidationError[]` for envelope or feature-data violations.

Do not recover partial arrays in this parser.

- [ ] **Implement `isRetryableAIError`**

Use normalized classes first, then status codes. Treat unknown errors conservatively as non-retryable. Keep `toAIError` behavior otherwise unchanged.

- [ ] **Run focused tests and the full gate**

```bash
source ~/.nvm/nvm.sh && nvm use && npm test -- client/src/lib/ai/__tests__/structuredBatchResponse.test.ts client/src/lib/ai/__tests__/errors.test.ts
```

Then run the global full gate.

- [ ] **Commit**

```bash
git add client/src/lib/ai/parsing/types.ts client/src/lib/ai/parsing/structuredBatchResponse.ts client/src/lib/ai/core/errors.ts client/src/lib/ai/__tests__/structuredBatchResponse.test.ts client/src/lib/ai/__tests__/errors.test.ts
git commit -m "feat(ai): add structured batch outcome parsing"
```

---

## Task 2: Teach `executeFeature` the Structured Result Contract

**Files:**
- Modify `client/src/lib/ai/core/types.ts:45-84,88-177`
- Modify `client/src/lib/ai/core/aiFeatureService.ts:62-296,539-665`
- Modify `client/src/lib/ai/__tests__/aiFeatureService.test.ts:1-120`

- [ ] **Write failing execution tests**

Add a programmable provider mock and register a test feature with:

```typescript
responseFormat: "structured-batch",
responseSchema: {
  type: "array",
  items: {
    type: "object",
    properties: {
      tag: { type: "string" },
    },
    required: ["tag"],
  },
},
```

Test:

1. `ok` returns unwrapped data, `success: true`, `status: "ok"`, `retryable: false`.
2. `empty` returns `success: true`, `status: "empty"`, `data: []`, and calls the provider once even when parse retries are configured.
3. Model error returns `success: false`, `status: "error"`, `errorSource: "model"`, stable code/message, and explicit retryability; it is not retried in Phase 1.
4. Empty, malformed, truncated, and schema-invalid responses end as retryable parser failures with diagnostics after existing parse attempts.
5. Structured parser failures never enter `tryLenientRecovery`.
6. Provider failures return `errorSource: "provider"` with `isRetryableAIError` classification.
7. `executeBatch` counts one `ok` and one `empty` as two successes.
8. Text revision still returns the legacy shape without `status`, `retryable`, or `errorSource`.

- [ ] **Run the focused test and confirm failure**

```bash
source ~/.nvm/nvm.sh && nvm use && npm test -- client/src/lib/ai/__tests__/aiFeatureService.test.ts
```

Expected failure: envelopes are currently validated as feature data, and no structured fields are returned.

- [ ] **Implement the structured branch inside `executeFeature`**

When `config.responseFormat === "structured-batch"`:

```typescript
const parsed = parseStructuredBatchResponse<unknown>(
  response.content,
  config.responseSchema,
);
```

Return `ok` and `empty` immediately:

```typescript
{
  success: true,
  status: parsed.response.status,
  retryable: false,
  data: parsed.response.data as TOutput,
  rawResponse: response.content,
  metadata,
}
```

For model `error`:

```typescript
{
  success: false,
  status: "error",
  retryable: parsed.response.retryable,
  errorSource: "model",
  error: parsed.response.error.message,
  errorCode: parsed.response.error.code,
  rawResponse: response.content,
  metadata,
}
```

For parser failure:

- retain current parse-attempt counting and callback,
- include parser code and diagnostics in `RetryAttemptInfo`,
- after attempts are exhausted return:

```typescript
{
  success: false,
  status: "error",
  retryable: true,
  errorSource: "parser",
  error: new AIParseError(parserFailure.message, response.content).toUserMessage(),
  errorCode: "PARSE_ERROR",
  parserFailure,
  rawResponse: response.content,
  metadata,
}
```

Guard existing lenient recovery:

```typescript
if (config.responseFormat !== "structured-batch") {
  const lenientResult = tryLenientRecovery<TOutput>(/* existing arguments */);
  if (lenientResult) return lenientResult;
}
```

- [ ] **Normalize structured provider failures**

In provider resolution and chat catches, add structured fields only for opted-in configs:

```typescript
status: "error",
retryable: isRetryableAIError(aiError),
errorSource: "provider",
```

Do not retry provider errors. Preserve existing non-structured behavior.

- [ ] **Keep batch counting status-independent**

Continue counting `result.success`; do not inspect array length. Ensure caught structured failures retain status/source/retryability.

- [ ] **Run focused tests and the full gate**

```bash
source ~/.nvm/nvm.sh && nvm use && npm test -- client/src/lib/ai/__tests__/aiFeatureService.test.ts client/src/lib/ai/core/__tests__/aiFeatureService.timeout.test.ts client/src/lib/ai/core/__tests__/aiFeatureService.temperature.test.ts
```

Then run the global full gate.

- [ ] **Commit**

```bash
git add client/src/lib/ai/core/types.ts client/src/lib/ai/core/aiFeatureService.ts client/src/lib/ai/__tests__/aiFeatureService.test.ts
git commit -m "feat(ai): expose structured outcomes from feature execution"
```

---

## Task 3: Migrate Speaker Classification

**Files:**
- Modify `client/src/lib/ai/features/speaker/config.ts:13-125`
- Modify `client/src/lib/ai/features/speaker/service.ts:105-269`
- Modify `client/src/lib/ai/__tests__/speakerService.test.ts:17-169`

- [ ] **Write failing tests**

Test that:

- config uses `responseFormat: "structured-batch"`,
- prompt contains concrete `ok`, `empty`, and `error` envelopes and all six model codes,
- an empty result returns no suggestions without throwing,
- an empty batch counts segments as unchanged, not failed,
- model/parser failures preserve `errorSource`, `retryable`, and parser diagnostics in thrown error details and batch issue context.

- [ ] **Run the focused test and confirm failure**

```bash
source ~/.nvm/nvm.sh && nvm use && npm test -- client/src/lib/ai/__tests__/speakerService.test.ts
```

Expected failure: the config still requests a raw array and the service does not distinguish empty from error.

- [ ] **Update the prompt and config**

Set:

```typescript
responseFormat: "structured-batch",
```

Change output instructions to concrete envelopes. `ok.data` contains speaker suggestions; `empty.data` is `[]`. List only the six model-observable error codes. Do not mention provider-layer authentication, network, rate-limit, timeout, or server classification.

Keep `speakerResponseSchema` as the `ok.data` array schema.

- [ ] **Handle explicit states**

Continue calling `executeFeature<SpeakerSuggestion[]>`.

```typescript
if (result.status === "empty") {
  return [];
}

if (!result.success || !result.data) {
  throw new AIError(result.error ?? "Speaker classification failed", result.errorCode ?? "UNKNOWN_ERROR", {
    responsePayload: formatResponsePayload(result.rawResponse, result.error),
    rawResponse: result.rawResponse,
    errorSource: result.errorSource,
    retryable: result.retryable,
    parserFailure: result.parserFailure,
  });
}
```

Add the same structured failure fields to batch issue context. Do not change UI or translations.

- [ ] **Run focused tests and the full gate**

```bash
source ~/.nvm/nvm.sh && nvm use && npm test -- client/src/lib/ai/__tests__/speakerService.test.ts
```

Then run the global full gate.

- [ ] **Commit**

```bash
git add client/src/lib/ai/features/speaker/config.ts client/src/lib/ai/features/speaker/service.ts client/src/lib/ai/__tests__/speakerService.test.ts
git commit -m "feat(ai): migrate speaker batches to outcome envelopes"
```

---

## Task 4: Migrate Segment Merge Without Failed-Output Recovery

**Files:**
- Modify `client/src/lib/ai/features/segmentMerge/config.ts:13-197`
- Modify `client/src/lib/ai/features/segmentMerge/service.ts:158-338`
- Modify `client/src/lib/ai/features/segmentMerge/__tests__/config.test.ts:15-87`
- Modify `client/src/lib/ai/features/segmentMerge/__tests__/service.test.ts:22-108`

- [ ] **Write failing tests**

Test:

- structured response format and all three prompt states,
- no-merge instructions use `empty`, not a raw top-level array,
- empty batches produce zero suggestions, no error issue, and a nonfatal batch log,
- a failed result containing parseable raw JSON is not recovered,
- model/parser failure context includes source, retryability, code, and diagnostics,
- existing successful ID mapping, smoothing, ordering, and request/response logs remain intact.

Replace the existing recovery test with an assertion that failed raw output produces no suggestion.

- [ ] **Run focused tests and confirm failure**

```bash
source ~/.nvm/nvm.sh && nvm use && npm test -- client/src/lib/ai/features/segmentMerge/__tests__/config.test.ts client/src/lib/ai/features/segmentMerge/__tests__/service.test.ts
```

Expected failure: the prompt still accepts `[]`, and service failure handling still calls `processAIResponse` recovery.

- [ ] **Update the prompt and config**

Set `responseFormat: "structured-batch"` and place merge suggestions inside `ok.data`. Add concrete `empty` and model `error` examples with the approved codes. Keep `mergeResponseSchema` unchanged as the data schema, including numeric-ID coercion.

- [ ] **Handle empty before failure**

Continue calling `executeFeature<RawMergeSuggestion[]>`.

For empty, return a successful internal batch outcome:

```typescript
{
  status: "success" as const,
  plan,
  processed: {
    suggestions: [],
    issues: [],
    rawItemCount: 0,
    normalizedCount: 0,
  },
  batchDurationMs: Date.now() - batchStart,
  responsePayload,
}
```

For failure, do not call `processAIResponse`. Return the failed outcome directly with:

```typescript
context: {
  errorCode: result.errorCode,
  errorSource: result.errorSource,
  retryable: result.retryable,
  parserFailure: result.parserFailure,
}
```

Call `processAIResponse` only for `status === "ok"` successful data. This leaves general recovery utilities untouched while ensuring migrated structured output remains a parser failure.

- [ ] **Run focused tests and the full gate**

```bash
source ~/.nvm/nvm.sh && nvm use && npm test -- client/src/lib/ai/features/segmentMerge/__tests__/config.test.ts client/src/lib/ai/features/segmentMerge/__tests__/service.test.ts client/src/lib/ai/features/segmentMerge/__tests__/responseProcessor.test.ts
```

Then run the global full gate.

- [ ] **Commit**

```bash
git add client/src/lib/ai/features/segmentMerge/config.ts client/src/lib/ai/features/segmentMerge/service.ts client/src/lib/ai/features/segmentMerge/__tests__/config.test.ts client/src/lib/ai/features/segmentMerge/__tests__/service.test.ts
git commit -m "feat(ai): migrate merge batches to outcome envelopes"
```

---

## Task 5: Migrate Chapter Detection

**Files:**
- Modify `client/src/lib/ai/features/chapterDetection/config.ts:12-117`
- Modify `client/src/lib/ai/features/chapterDetection/types.ts:16-30`
- Modify `client/src/lib/ai/features/chapterDetection/utils.ts:37-77`
- Modify `client/src/lib/ai/features/chapterDetection/service.ts:148-345`
- Modify `client/src/lib/ai/features/chapterDetection/__tests__/service.test.ts:31-92`
- Modify `client/src/lib/ai/features/chapterDetection/__tests__/utils.test.ts`

- [ ] **Write failing tests**

Test:

- config opts into structured outcomes,
- response schema is an array item schema,
- prompt uses chapter items in `ok.data` and includes a valid `empty`,
- mapping accepts chapter item arrays rather than `{ chapters: [...] }`,
- sequential previous-chapter context still works,
- empty batches advance progress, call batch completion with `[]`, log zero items, and remain nonfatal,
- model/parser failures remain fatal with structured context.

- [ ] **Run focused tests and confirm failure**

```bash
source ~/.nvm/nvm.sh && nvm use && npm test -- client/src/lib/ai/features/chapterDetection/__tests__/service.test.ts client/src/lib/ai/features/chapterDetection/__tests__/utils.test.ts
```

Expected failure: chapter detection still expects an object containing `chapters`.

- [ ] **Make chapter data array-based**

```typescript
export interface ChapterDetectionSuggestion {
  title: string;
  summary?: string;
  notes?: string;
  tags?: string[];
  start: number;
  end: number;
}

export type ChapterDetectionResponse = ChapterDetectionSuggestion[];
```

Remove the unused `chapterContinuation` response field. Change `chapterDetectionResponseSchema` to the existing nested chapter array schema and set `responseFormat: "structured-batch"`.

Update `mapResponseToRealSegmentIds` to iterate the response array directly.

- [ ] **Update prompt and service**

Use concrete envelope examples with chapter items in `ok.data`. Continue calling:

```typescript
executeFeature<ChapterDetectionResponse>("chapter-detection", variables, options);
```

Handle empty before failure, returning a successful batch outcome with `mapped: []`, `rawItemCount: 0`, and no issues. For `ok`, map `result.data` and use `result.data.length`. For failure, include source, retryability, code, and diagnostics in issue context.

Do not update previous-chapter context after an empty batch.

- [ ] **Run focused tests and the full gate**

```bash
source ~/.nvm/nvm.sh && nvm use && npm test -- client/src/lib/ai/features/chapterDetection/__tests__/service.test.ts client/src/lib/ai/features/chapterDetection/__tests__/utils.test.ts
```

Then run the global full gate.

- [ ] **Commit**

```bash
git add client/src/lib/ai/features/chapterDetection/config.ts client/src/lib/ai/features/chapterDetection/types.ts client/src/lib/ai/features/chapterDetection/utils.ts client/src/lib/ai/features/chapterDetection/service.ts client/src/lib/ai/features/chapterDetection/__tests__/service.test.ts client/src/lib/ai/features/chapterDetection/__tests__/utils.test.ts
git commit -m "feat(ai): migrate chapter batches to outcome envelopes"
```

---

## Task 6: Document, Update DOX, and Perform Final Verification

**Files:**
- Modify `docs/features/architecture/ai-features-unified.md:705-841,1575-1647`
- Modify `client/src/lib/ai/AGENTS.md:15-30`

- [ ] **Update architecture documentation**

Document:

- exact `ok`, `empty`, and `error` envelopes,
- scope limited to speaker, merge, and chapter detection,
- `empty` as terminal success counted as succeeded,
- stable model error codes and retryability,
- parser/provider/model failure origins,
- the complete provider retryability table,
- invalid structured output never using lenient recovery,
- text-only and chapter metadata behavior remaining unchanged,
- Phase 1 exposing retryability and diagnostics without provider retries or corrective messages,
- Phase 2 owning corrective retry construction,
- Phase 3 caching and Phase 4 selective XML cleanup remaining out of scope.

Remove stale claims that malformed structured responses are accepted through recovery.

- [ ] **Update the AI DOX contract**

Add concise local rules:

```markdown
- Structured batch features use the shared `ok` / `empty` / `error` envelope.
- `empty` is a successful terminal outcome; malformed or schema-invalid output remains a parser failure.
- Structured failures preserve `model`, `provider`, or `parser` origin plus explicit retryability.
```

Re-read the complete DOX chain. Leave parent files unchanged because ownership, hierarchy, and child indexes did not change.

- [ ] **Run final verification**

```bash
source ~/.nvm/nvm.sh && nvm use && npm run check
source ~/.nvm/nvm.sh && nvm use && npm run lint:fix
source ~/.nvm/nvm.sh && nvm use && npm run check
source ~/.nvm/nvm.sh && nvm use && npm test
```

Confirm explicit successful check/lint output and explicit Vitest passed/failed counts.

- [ ] **Inspect final scope**

Verify no dependency, lockfile, UI, settings, translation, provider request, cache, corrective-message, or XML-format changes. Verify no `any` in changed TypeScript.

- [ ] **Commit**

```bash
git add docs/features/architecture/ai-features-unified.md client/src/lib/ai/AGENTS.md
git commit -m "docs(ai): document structured batch outcomes"
```
