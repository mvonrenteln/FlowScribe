# Corrective AI Retries Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add bounded corrective retries for structured batch features so parser failures receive actionable repair feedback, explicitly retryable model outcomes and transient provider failures are retried, and terminal or cancelled outcomes retain accurate status, diagnostics, logs, metadata, and ordering.

**Architecture:** Extend Plan 1's existing `executeFeature` loop with one shared attempt budget from `parseRetryCount`. Compile the immutable system/user prefix once, retain an attempt-local conversation, and append assistant/repair pairs only after invalid model responses. Reuse `isRetryableAIError` for provider decisions; do not introduce another executor, provider abstraction, or retry setting.

**Tech Stack:** TypeScript strict mode, existing AI core/provider/parsing layers, Zustand-backed settings storage, existing `SimpleSchema`, Vitest, Biome, npm 11, Node 24.

## Global Constraints

- Repository root: `/Users/marc.von-renteln/GitHub/FlowScribe`.
- Treat every contract and behavior from Plan 1 as implemented and stable, even if the working tree still shows its pre-Plan-1 form.
- Before editing, re-read the applicable DOX chain for root, `client/src/lib/ai`, and `docs/features`, plus `docs/agent-rules/coding-conventions.md`.
- Reuse Plan 1's `executeFeature`, `AIFeatureResult`, `RetryAttemptInfo`, `StructuredBatchParserFailure`, `errorSource`, `retryable`, and `isRetryableAIError`.
- Activate new model/provider/corrective behavior only when `config.responseFormat === "structured-batch"`. Preserve legacy parsing retries and text-only behavior.
- Use `settings.parseRetryCount` as one total retry budget across parser, model, and provider failures. Do not reset the budget by failure category.
- The configured value is retries after the initial request: `maxAttempts = maxRetries + 1`.
- A valid `empty` is terminal success and never retries.
- A validated model `error` retries only when its envelope has `retryable: true`; no repair messages are added because the response itself is valid.
- A parser failure retries with the invalid assistant response followed by a concise repair user message containing the exact parser code and each diagnostic field path/message.
- Repair instructions request a complete replacement matching the original contract, never a patch.
- Provider failures retry only when Plan 1's `isRetryableAIError` returns true: network interruption, timeout, HTTP 408/429/5xx. They add no model feedback.
- HTTP 400/401/403/422, authentication, configuration, unsupported model/options, cancellation, and unknown errors return immediately.
- Honor normalized `retryAfter` seconds from `AIRateLimitError`. Cap provider-controlled waits at 30 seconds; use `0ms` when no retry timing is exposed, preserving the existing immediate-retry behavior.
- User cancellation must interrupt both an in-flight request and a retry-after wait and must prevent further provider calls.
- Each request attempt gets a fresh `AbortController`, timeout, external-abort relay, and complete timer/listener cleanup.
- Preserve the original two-message system/user prefix byte-for-byte for every attempt. Never mutate feature config, custom prompts, base messages, or arrays passed by callers.
- Keep prior assistant/repair pairs when multiple corrective attempts occur, producing valid alternating conversation history.
- Preserve deterministic batch ordering, terminal raw response/error payloads, `retryAttempts`, `onRetry`, token metadata behavior, and existing progress callbacks.
- Do not add cache flags; Plan 3 owns OpenAI caching. Stable prefixes created here must remain cache-compatible.
- Do not add XML formatting; Plan 4 owns prompt cleanup.
- No dependencies, UI, settings, translations, provider request-shape changes, or lockfile changes.
- Documentation and code comments must be English. Do not use `any`, placeholders, TODO implementations, or broad refactors.
- Before each commit run `git status --short`, inspect the task-specific `git diff`, run `git diff --check`, and inspect `git log --oneline -10`. Stage only intended files.
- After every code task run:

```bash
source ~/.nvm/nvm.sh && nvm use && npm run check
source ~/.nvm/nvm.sh && nvm use && npm run lint:fix
source ~/.nvm/nvm.sh && nvm use && npm run check
source ~/.nvm/nvm.sh && nvm use && npm test
```

If `lint:fix` changes files, rerun the task's focused tests before the second `check`. Require explicit Vitest passed/failed counts.

## Exact File Map

### Modify

- `client/src/lib/ai/core/types.ts`: extend Plan 1's `RetryAttemptInfo`.
- `client/src/lib/ai/core/aiFeatureService.ts`: extend the Plan 1 structured execution loop and request helpers.
- `client/src/lib/ai/__tests__/aiFeatureService.test.ts`: add structured model, parser, and provider retry tests.
- `client/src/lib/ai/core/__tests__/aiFeatureService.timeout.test.ts:1-58`: add timeout retry and cleanup coverage.
- `client/src/lib/ai/features/segmentMerge/service.ts:170-210`: enrich the existing retry logger.
- `client/src/lib/ai/features/segmentMerge/__tests__/service.test.ts`: cover retry log categories.
- `client/src/lib/ai/features/chapterDetection/service.ts:169-199`: enrich the existing retry logger.
- `client/src/lib/ai/features/chapterDetection/__tests__/service.test.ts`: cover retry log categories.
- `docs/features/architecture/ai-features-unified.md`: document corrective retry behavior.
- `client/src/lib/ai/AGENTS.md:15-30`: record the durable retry contract.

### Intentionally Unchanged

- `client/src/lib/settings/settingsStorage.ts`: continue using `parseRetryCount`; do not rename it or add another setting.
- `client/src/lib/ai/core/errors.ts`: reuse Plan 1's `isRetryableAIError` and existing normalized `details.statusCode`/`details.retryAfter`.
- `client/src/lib/ai/providers/openai.ts`: it already exposes integer `retry-after` seconds for normalized 429 errors.
- `client/src/lib/ai/providers/ollama.ts`: HTTP status and network failures are already normalized.
- Structured parser files: reuse `StructuredBatchParserFailure`; do not change parsing rules.
- Feature prompts/configs: corrective feedback is runtime conversation state, not prompt-template content.
- Settings components, translations, package files, provider request bodies, caching, and XML prompt structure.

## Interface Delta

Keep `executeFeature` and `AIFeatureResult` exactly as established by Plan 1. Extend, not replace, `RetryAttemptInfo` so the existing callback can describe all structured retry categories:

```typescript
export interface RetryAttemptInfo {
  attempt: number;
  maxAttempts: number;
  errorMessage: string;
  errorCode: string;
  errorSource: StructuredBatchErrorSource;
  diagnostics: ValidationError[];
  attemptDurationMs: number;
}
```

- `attempt` remains the 1-based ordinal of the failed request, preserving Plan 1 semantics.
- Widening `errorCode` from `ParseErrorCode` to `string` retains every parser code while allowing stable model and normalized provider codes.
- Parser retries pass `parserFailure.diagnostics`.
- Model and provider retries pass `diagnostics: []`.
- `errorSource` is `"parser"`, `"model"`, or `"provider"`.
- Do not create another retry-info type.

Use these unexported helpers inside `aiFeatureService.ts`:

```typescript
function buildCorrectiveRepairMessage(
  failure: StructuredBatchParserFailure,
): string;

async function requestChatAttempt(
  provider: AIProviderService,
  messages: readonly ChatMessage[],
  chatOptions: ChatOptions,
  externalSignal: AbortSignal | undefined,
  requestTimeoutMs: number,
): Promise<ChatResponse>;

function getProviderRetryDelayMs(error: AIError): number;

async function waitForRetryDelay(
  delayMs: number,
  signal?: AbortSignal,
): Promise<void>;
```

`buildCorrectiveRepairMessage` must produce plain text equivalent to:

```text
The previous response could not be accepted.
Parser code: SCHEMA_MISMATCH
Problems:
- data[0].tag: Expected string, got number
Return a complete replacement response matching the original response contract. Do not return a patch or commentary.
```

When diagnostics are empty, include `failure.message` as the problem. Preserve diagnostic order and exact `path` and `message`; omit `actual` values and unrelated implementation details.

---

## Task 1: Add Parser Feedback and Explicit Model Retries

**Files:**
- Modify `client/src/lib/ai/core/types.ts` after Plan 1.
- Modify `client/src/lib/ai/core/aiFeatureService.ts:62-340` after Plan 1.
- Modify `client/src/lib/ai/__tests__/aiFeatureService.test.ts` after Plan 1.

- [ ] **Write failing structured retry tests**

Using Plan 1's programmable provider and structured test feature, cover:

1. A valid `empty` returns after one request even with retries configured.
2. A non-retryable model `error` returns after one request with its original code, message, `rawResponse`, `errorSource: "model"`, and `retryable: false`.
3. A retryable `TEMPORARY_FAILURE` followed by `ok` makes two requests, keeps both requests at the original two-message prefix, adds no repair messages, and returns `metadata.retryAttempts: 1`.
4. A retryable model error exhausting the budget returns the last envelope and `retryAttempts === maxRetries`.
5. A schema parser failure followed by `ok` sends the original system and user messages, the invalid assistant response, and a repair user message with exact parser code and diagnostic path/message.
6. Malformed or truncated JSON with no field diagnostics includes the parser code and parser message in the repair instruction.
7. Two parser failures followed by success produce `system, user, assistant-invalid-1, user-repair-1, assistant-invalid-2, user-repair-2`.
8. Each retry request preserves the exact original prefix; captured earlier request arrays do not change after later attempts.
9. A parser failure followed by a retryable model error and then success retains earlier corrective history but does not append the valid model-error envelope.
10. `onRetry` fires once per actual retry with source/code/diagnostics, the failed request ordinal, `maxAttempts`, and failed-attempt duration.
11. Terminal results report actual provider requests after the first as `metadata.retryAttempts`; first-attempt terminal outcomes omit or report zero consistently with Plan 1.
12. Legacy schema parsing and text-only execution preserve their existing message and retry behavior.

- [ ] **Run the focused test and confirm failure**

```bash
source ~/.nvm/nvm.sh && nvm use && npm test -- client/src/lib/ai/__tests__/aiFeatureService.test.ts
```

Expected failure: Plan 1 repeats the original messages for parser failures, returns model errors immediately, and `RetryAttemptInfo` cannot identify model/parser origin consistently.

- [ ] **Extend `RetryAttemptInfo` without replacing it**

Add `errorSource`, retain mandatory diagnostics, and widen `errorCode` to `string`. Update its JSDoc so `onRetry` applies to retryable structured failures rather than parse failures only.

Do not alter `AIFeatureOptions.onRetry`, `executeFeature`, or `AIFeatureResult` signatures.

- [ ] **Compile and preserve the immutable prefix once**

Inside `executeFeature`:

1. Compile system and user prompts once.
2. Store the two base messages without mutating them.
3. Initialize structured conversation history from that prefix.
4. Pass a fresh array to each provider call.
5. Add new messages through array replacement, never `push` on base/config/shared arrays.

- [ ] **Implement parser corrective history**

For structured parser failures with budget remaining:

1. Log the existing parser failure.
2. Build the concise repair message from `StructuredBatchParserFailure`.
3. Replace conversation history with `[..., { role: "assistant", content: response.content }, { role: "user", content: repair }]`.
4. Notify `onRetry` with `errorSource: "parser"`, exact parser code and diagnostics, and parser message.
5. Continue within the same shared attempt loop.

Do not call lenient recovery and do not reinterpret empty bodies as valid `empty`.

- [ ] **Implement explicit model-error decisions**

- If `retryable` is false or no budget remains, return Plan 1's terminal model failure immediately.
- If true and budget remains, keep conversation history unchanged, log and notify a model retry with `diagnostics: []`, then continue.
- Never append a validated model-error envelope as corrective feedback.
- Return `ok` and `empty` immediately regardless of remaining budget.

- [ ] **Keep one shared budget and accurate terminal metadata**

Every provider request increments one attempt counter. Parser and model failures consume the same budget. Build terminal metadata from `attempt - 1`, including successful outcomes after retry and failures after exhaustion.

- [ ] **Run focused regression tests**

```bash
source ~/.nvm/nvm.sh && nvm use && npm test -- client/src/lib/ai/__tests__/aiFeatureService.test.ts client/src/lib/ai/__tests__/structuredBatchResponse.test.ts
```

Expected: all parser feedback, model decision, stable-prefix, callback, and Plan 1 parser tests pass.

- [ ] **Run the full repository gate**

Use the Global Constraints command sequence and confirm explicit passing counts.

- [ ] **Inspect and commit**

```bash
git status --short
git diff -- client/src/lib/ai/core/types.ts client/src/lib/ai/core/aiFeatureService.ts client/src/lib/ai/__tests__/aiFeatureService.test.ts
git diff --check
git log --oneline -10
git add client/src/lib/ai/core/types.ts client/src/lib/ai/core/aiFeatureService.ts client/src/lib/ai/__tests__/aiFeatureService.test.ts
git commit -m "feat(ai): add corrective structured retries"
```

---

## Task 2: Retry Transient Provider Failures Safely

**Files:**
- Modify `client/src/lib/ai/core/aiFeatureService.ts:62-340` and its helper area after Plan 1.
- Modify `client/src/lib/ai/__tests__/aiFeatureService.test.ts` structured execution cases.
- Modify `client/src/lib/ai/core/__tests__/aiFeatureService.timeout.test.ts:1-58`.

- [ ] **Write failing provider retry tests**

Cover observable behavior:

1. Network interruption followed by success retries immediately and sends identical messages.
2. HTTP 408 and representative 5xx failures retry according to `isRetryableAIError`.
3. A normalized 429 with `retryAfter: 2` does not make the second request before 2,000ms and does so at 2,000ms using fake timers.
4. A very large normalized `retryAfter` is capped at 30,000ms.
5. Retryable provider failures add no assistant or repair messages, including when they occur after an earlier parser correction.
6. HTTP 400, authentication, configuration, cancellation, and an unknown error each return after one provider request.
7. Provider retry exhaustion returns the final normalized provider code/message, `errorSource: "provider"`, `retryable: true`, provider error payload, and accurate retry count.
8. A provider failure after an earlier invalid assistant response must not expose that stale assistant response as the terminal provider `rawResponse`.
9. `onRetry` reports provider source/code, empty diagnostics, and fires only when another request will occur.
10. Cancelling during a retry-after wait returns `CANCELLED`, `retryable: false`, performs no next provider request, leaves no timer, and does not report a retry that never started.
11. Cancelling during an in-flight request stops retries.
12. Every attempt receives a distinct signal; external abort listeners and timeout timers are removed after success, failure, timeout, and cancellation.
13. An internal request timeout normalizes to a retryable connection/timeout error for structured features.
14. Text revision retains its current single-attempt provider-failure behavior.
15. `executeBatch` retains input ordering and summary counts when one structured item retries internally.

Use Plan 1's exhaustive `isRetryableAIError` tests for the complete status matrix rather than duplicating every classifier branch here.

- [ ] **Run focused tests and confirm failure**

```bash
source ~/.nvm/nvm.sh && nvm use && npm test -- client/src/lib/ai/__tests__/aiFeatureService.test.ts client/src/lib/ai/core/__tests__/aiFeatureService.timeout.test.ts client/src/lib/ai/__tests__/errors.test.ts
```

Expected failure: Plan 1 classifies provider retryability but returns provider failures without another request; retry-after waits and complete per-attempt cleanup do not exist.

- [ ] **Extract one internal request-attempt helper**

Move the existing per-request controller/timeout mechanics into unexported `requestChatAttempt`; this is not a second feature executor.

It must:

1. Reject a pre-aborted external signal before calling the provider.
2. Create a fresh request controller.
3. Attach a named external abort relay before starting `provider.chat`.
4. Pass a fresh messages array and the attempt controller's signal.
5. Start a per-attempt timeout.
6. Represent timeout with an `AbortError` whose message contains `timed out` so existing `isCancellationError`/`toAIError` distinguish timeout from cancellation.
7. Abort the provider request on timeout.
8. In `finally`, clear the timeout, remove the external listener, and consume a late provider rejection after a timeout race.
9. Never reuse an aborted controller for a later attempt.

- [ ] **Implement provider retry decisions in the existing loop**

After `toAIError(error)`:

```typescript
const canRetry =
  config.responseFormat === "structured-batch" &&
  isRetryableAIError(aiError) &&
  attempt <= maxRetries;
```

- Cancellation is checked first and never retries.
- Missing provider/config resolution remains terminal because no provider request can be made.
- If `canRetry` is false, return Plan 1's structured provider result unchanged except for accurate terminal raw error payload and retry count.
- If true, preserve the current conversation exactly, wait as required, notify/log the retry, and continue the same loop.

- [ ] **Implement bounded retry timing**

`getProviderRetryDelayMs` reads numeric `aiError.details?.retryAfter`, interpreted as seconds:

```typescript
const MAX_PROVIDER_RETRY_DELAY_MS = 30_000;
```

- Valid positive value: `Math.min(retryAfter * 1000, 30_000)`.
- Missing, invalid, negative, or non-finite value: `0`.
- Do not add exponential backoff or another setting.

`waitForRetryDelay` must be abortable and remove its timer/listener on resolve or reject. Check cancellation again after the wait and before calling `onRetry` or starting another request.

- [ ] **Preserve accurate provider error payloads**

For a terminal provider failure, derive `rawResponse` from normalized string details such as `originalError` or `causeMessage`. Do not substitute the last malformed model response for a provider failure that produced no response.

Do not expose provider config or credentials in logs.

- [ ] **Add structured retry logs**

For every actual retry, emit one structured warning containing `featureId`, failed `attempt`, `maxAttempts`, `errorSource`, `errorCode`, `corrective: errorSource === "parser"`, and provider `delayMs` when applicable. Do not log API keys, complete provider configs, or new raw provider data.

- [ ] **Run focused regression tests**

```bash
source ~/.nvm/nvm.sh && nvm use && npm test -- client/src/lib/ai/__tests__/aiFeatureService.test.ts client/src/lib/ai/core/__tests__/aiFeatureService.timeout.test.ts client/src/lib/ai/core/__tests__/aiFeatureService.temperature.test.ts client/src/lib/ai/__tests__/errors.test.ts client/src/lib/ai/__tests__/batch.test.ts
```

Expected: retry classification, delays, cancellation, cleanup, stable conversations, ordering, temperature, and timeout tests pass.

- [ ] **Run the full repository gate**

Use the Global Constraints command sequence and confirm explicit passing counts.

- [ ] **Inspect and commit**

```bash
git status --short
git diff -- client/src/lib/ai/core/aiFeatureService.ts client/src/lib/ai/__tests__/aiFeatureService.test.ts client/src/lib/ai/core/__tests__/aiFeatureService.timeout.test.ts
git diff --check
git log --oneline -10
git add client/src/lib/ai/core/aiFeatureService.ts client/src/lib/ai/__tests__/aiFeatureService.test.ts client/src/lib/ai/core/__tests__/aiFeatureService.timeout.test.ts
git commit -m "feat(ai): retry transient provider failures"
```

---

## Task 3: Preserve Retry Categories in Feature Batch Logs

**Files:**
- Modify `client/src/lib/ai/features/segmentMerge/service.ts:170-210`.
- Modify `client/src/lib/ai/features/segmentMerge/__tests__/service.test.ts` after Plan 1.
- Modify `client/src/lib/ai/features/chapterDetection/service.ts:169-199`.
- Modify `client/src/lib/ai/features/chapterDetection/__tests__/service.test.ts` after Plan 1.

- [ ] **Write failing feature log tests**

Mock `executeFeature` so it invokes the supplied `onRetry` with parser, model, and provider examples before returning a valid structured outcome.

For both segment merge and chapter detection, assert:

1. One nonfatal batch log is emitted per retry callback.
2. Its issue message identifies attempt, source, code, and concise error message.
3. Its issue context contains `errorSource`, `errorCode`, `diagnostics`, and `corrective: true` only for parser retries.
4. Exact parser field paths/messages remain available in diagnostics.
5. Provider/model retries carry `diagnostics: []`.
6. Existing original request payload logging remains unchanged.
7. Final response payload, batch ordering, progress, suggestion ordering, and terminal failure context from Plan 1 remain unchanged.
8. Empty outcomes create no retry log.

- [ ] **Run focused tests and confirm failure**

```bash
source ~/.nvm/nvm.sh && nvm use && npm test -- client/src/lib/ai/features/segmentMerge/__tests__/service.test.ts client/src/lib/ai/features/chapterDetection/__tests__/service.test.ts
```

Expected failure: existing retry log messages contain only attempt/message and omit source, code, diagnostics, and corrective intent.

- [ ] **Enrich existing retry log entries only**

Update each existing callback; do not introduce another logger or callback.

```typescript
`Retry ${retryInfo.attempt} [${retryInfo.errorSource}/${retryInfo.errorCode}] - ${retryInfo.errorMessage}`
```

Add issue context:

```typescript
context: {
  errorSource: retryInfo.errorSource,
  errorCode: retryInfo.errorCode,
  diagnostics: retryInfo.diagnostics,
  corrective: retryInfo.errorSource === "parser",
}
```

Preserve existing durations, batch indices, request payloads, progress counts, and fatal flags. Speaker classification has no retry-log callback surface; do not add a new logging subsystem for it.

- [ ] **Run focused regression tests**

```bash
source ~/.nvm/nvm.sh && nvm use && npm test -- client/src/lib/ai/features/segmentMerge/__tests__/service.test.ts client/src/lib/ai/features/chapterDetection/__tests__/service.test.ts client/src/lib/ai/__tests__/speakerService.test.ts
```

Expected: enriched retry logs and all Plan 1 empty/error behavior pass.

- [ ] **Run the full repository gate**

Use the Global Constraints command sequence and confirm explicit passing counts.

- [ ] **Inspect and commit**

```bash
git status --short
git diff -- client/src/lib/ai/features/segmentMerge/service.ts client/src/lib/ai/features/segmentMerge/__tests__/service.test.ts client/src/lib/ai/features/chapterDetection/service.ts client/src/lib/ai/features/chapterDetection/__tests__/service.test.ts
git diff --check
git log --oneline -10
git add client/src/lib/ai/features/segmentMerge/service.ts client/src/lib/ai/features/segmentMerge/__tests__/service.test.ts client/src/lib/ai/features/chapterDetection/service.ts client/src/lib/ai/features/chapterDetection/__tests__/service.test.ts
git commit -m "feat(ai): classify structured retry logs"
```

---

## Task 4: Document Corrective Retries, Complete DOX, and Verify Scope

**Files:**
- Modify `docs/features/architecture/ai-features-unified.md` after Plan 1.
- Modify `client/src/lib/ai/AGENTS.md:15-30`.

- [ ] **Update the architecture source of truth**

Document:

- scope through the existing structured `executeFeature` path,
- one shared retry budget from `parseRetryCount`,
- `empty` and non-retryable model errors returning immediately,
- retryable model errors retrying without repair feedback,
- parser failures appending the invalid response and concise complete-replacement instruction,
- exact conversation sequence for multiple corrective attempts,
- immutable original system/user prefix for future Plan 3 cacheability,
- provider retry matrix from Plan 1 and `isRetryableAIError` as authoritative,
- `retry-after` handling, 30-second cap, and immediate retry when no timing is available,
- fresh timeout/controller/listener cleanup per attempt,
- cancellation during requests or waits stopping all retries,
- retry info, logs, raw error payloads, retry counts, and ordered results,
- unchanged legacy/text-only behavior,
- no cache flags until Plan 3 and no XML cleanup until Plan 4.

Replace stale generic claims of unconditional exponential backoff or lenient structured-output recovery with the shipped behavior.

- [ ] **Update the nearest AI DOX contract**

Add concise durable rules:

```markdown
- Structured retries share the configured retry budget across parser, model, and provider failures.
- Parser retries preserve the immutable original prompt prefix and append invalid assistant output plus concise complete-replacement feedback.
- Valid `empty`, non-retryable model errors, cancellation, and non-retryable provider failures are terminal.
- Retryable provider failures add no model feedback and must preserve per-attempt timeout and abort cleanup.
```

- [ ] **Perform the DOX pass**

Re-read the applicable AGENTS chain. Leave parent files unchanged because ownership, hierarchy, workflows, and child indexes did not change.

- [ ] **Run targeted AI regression tests**

```bash
source ~/.nvm/nvm.sh && nvm use && npm test -- client/src/lib/ai/__tests__/aiFeatureService.test.ts client/src/lib/ai/core/__tests__/aiFeatureService.timeout.test.ts client/src/lib/ai/__tests__/errors.test.ts client/src/lib/ai/__tests__/structuredBatchResponse.test.ts client/src/lib/ai/features/segmentMerge/__tests__/service.test.ts client/src/lib/ai/features/chapterDetection/__tests__/service.test.ts client/src/lib/ai/__tests__/speakerService.test.ts
```

Expected: explicit passing counts with parser, model, provider, cancellation, ordering, empty, and feature-log coverage.

- [ ] **Run final repository verification**

```bash
source ~/.nvm/nvm.sh && nvm use && npm run check
source ~/.nvm/nvm.sh && nvm use && npm run lint:fix
source ~/.nvm/nvm.sh && nvm use && npm run check
source ~/.nvm/nvm.sh && nvm use && npm test
```

Confirm successful TypeScript and Biome output plus explicit Vitest file/test passed counts.

- [ ] **Perform final consistency review**

Verify no second executor, retry setting, provider abstraction, dependency, cache field, XML cleanup, UI, settings, translations, package, lockfile, or provider request-shape change exists. Confirm one shared counter, immutable prefixes, exact diagnostics, provider-only classification, cancellation cleanup, deterministic ordering, and no `any`, placeholders, hardcoded UI strings, or commented-out code.

- [ ] **Inspect and commit**

```bash
git status --short
git diff -- docs/features/architecture/ai-features-unified.md client/src/lib/ai/AGENTS.md
git diff --check
git log --oneline -10
git add docs/features/architecture/ai-features-unified.md client/src/lib/ai/AGENTS.md
git commit -m "docs(ai): document corrective retry behavior"
```
