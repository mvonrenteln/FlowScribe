# Mandatory OpenAI Prompt Caching Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Automatically attach stable, privacy-safe OpenAI prompt-cache controls to every `OpenAIProvider` chat completion whose provider configuration has `type: "openai"`, while leaving custom OpenAI-compatible providers, Ollama, retries, settings, and result handling unchanged.

**Architecture:** Keep caching entirely inside `OpenAIProvider`. For built-in OpenAI configurations, derive a fixed-length SHA-256 cache key from the exact configured model and ordered system-message contents using browser Web Crypto, then send that key with `prompt_cache_retention: "in-memory"`. The provider continues to receive Plan 2's immutable conversation prefix; appended corrective history does not affect the key. Custom and Ollama request bodies receive no OpenAI-specific fields.

**Tech Stack:** TypeScript strict mode, OpenAI SDK 6.15.0, browser `crypto.subtle` and `TextEncoder`, existing AI provider/prompt layers, Vitest, Biome, npm 11, Node 24.

## Global Constraints

- Repository root: `/Users/marc.von-renteln/GitHub/FlowScribe`; paths below are relative to it.
- Treat Structured Batch Outcomes and Corrective AI Retries as implemented and stable.
- Before editing, re-read the applicable DOX chain for root, `client/src/lib/ai`, and `docs/features`.
- OpenAI caching is mandatory and automatic. Add no setting, feature flag, opt-out, provider-config property, UI control, translation, or environment variable.
- Apply cache fields only when `OpenAIProvider.config.type === "openai"`.
- `type: "custom"` uses `OpenAIProvider` but must preserve its existing request body because compatible endpoints may reject OpenAI-only fields.
- Ollama request bodies remain unchanged.
- Do not change `AIProviderConfig`, `AIProviderService`, `ChatOptions`, provider factory behavior, persisted settings, or feature execution options.
- Do not add a provider-wide caching interface, client-side response/result cache, IndexedDB cache, in-process cache map, or memoized result layer.
- Use only browser-standard capabilities: `TextEncoder`, `globalThis.crypto.subtle.digest`, and ordinary typed arrays. Add no dependency or SDK upgrade.
- OpenAI SDK 6.15.0 already types both fields in `ChatCompletionCreateParamsBase`: `prompt_cache_key?: string` and `prompt_cache_retention?: "in-memory" | "24h" | null`.
- The key must depend on the exact model string and exact ordered system-message contents. Do not trim, normalize, or include user/assistant messages.
- Encode the identity unambiguously with `JSON.stringify([model, systemContents])`, not delimiter concatenation.
- Hash with SHA-256 and encode as lowercase hexadecimal. The result is exactly 64 ASCII characters, avoiding raw prompt/model data and respecting the cache-key limit.
- Never place raw system prompts, transcript/user text, assistant responses, API keys, base URLs, provider IDs, or other sensitive values in the key.
- A byte-different custom system prompt produces a different key; an identical custom prompt is the same identity and may reuse the key.
- Calls without a system message still receive a key derived from the model and an empty system-message list.
- Preserve Plan 2's exact immutable system/user prefix and retry conversation behavior. Do not modify retry counters, corrective messages, error classification, delays, cancellation, or `aiFeatureService.ts`.
- Default structured feature system prompts for speaker classification, segment merge, and chapter detection must contain no template placeholders. Runtime transcript, batch, speaker, smoothing, chapter, and continuation values remain in user messages.
- Omit cached-token telemetry. The approved specification requires request controls, not reporting; correctness does not require widening `ChatResponse`, `AIFeatureResult`, or token metadata.
- Phase 4 XML cleanup is out of scope. Do not alter prompt wording, envelope semantics, placeholder names, or XML structure.
- Documentation and comments must be English. Keep strict TypeScript and use no `any`, placeholders, TODO implementations, broad refactors, or commented-out code.
- Before each commit inspect `git status --short`, the task-specific `git diff`, `git diff --check`, and `git log --oneline -10`; stage only intended files.
- After each code/test task run the complete gate:

```bash
source ~/.nvm/nvm.sh && nvm use && npm run check
source ~/.nvm/nvm.sh && nvm use && npm run lint:fix
source ~/.nvm/nvm.sh && nvm use && npm run check
source ~/.nvm/nvm.sh && nvm use && npm test
```

If `lint:fix` changes files, rerun the focused tests before the second `check`. Require explicit Vitest passed/failed counts.

## Exact File Map

### Create

- `client/src/lib/ai/__tests__/structuredPromptCacheability.test.ts`

### Modify

- `client/src/lib/ai/providers/openai.ts:10-50,71-108`
- `client/src/lib/ai/providers/__tests__/openaiProvider.test.ts:1-37`
- `client/src/lib/ai/__tests__/ollamaProvider.test.ts:42-67`
- `docs/features/architecture/ai-features-unified.md`
- `client/src/lib/ai/AGENTS.md:15-30`

### Intentionally Unchanged

- `client/src/lib/ai/providers/types.ts`: no cache properties in shared config/options/results.
- `client/src/lib/ai/providers/factory.ts`: custom continues to instantiate `OpenAIProvider`.
- `client/src/lib/ai/providers/ollama.ts`: no OpenAI fields or behavior changes.
- `client/src/lib/ai/core/aiFeatureService.ts` and core types: preserve Plan 2 retry construction and immutable prefix.
- Structured feature config files: their system prompts are already static after Plans 1 and 2; add regression coverage without rewriting prompts.
- Settings, translations, package files, SDK declarations, parsing, envelopes, services, logging, token telemetry, and Phase 4 XML work.

## Internal Interface and Request Shape

Add one unexported helper near the existing OpenAI provider helpers:

```typescript
async function buildPromptCacheKey(
  model: string,
  messages: readonly ChatMessage[],
): Promise<string>;
```

Its behavior is exact:

```typescript
const systemContents = messages
  .filter((message) => message.role === "system")
  .map((message) => message.content);

const identity = JSON.stringify([model, systemContents]);
const digest = await globalThis.crypto.subtle.digest(
  "SHA-256",
  new TextEncoder().encode(identity),
);

return Array.from(
  new Uint8Array(digest),
  (byte) => byte.toString(16).padStart(2, "0"),
).join("");
```

Inside `OpenAIProvider.chat`, construct cache fields only for built-in OpenAI:

```typescript
const promptCache =
  this.config.type === "openai"
    ? {
        prompt_cache_key: await buildPromptCacheKey(this.config.model, messages),
        prompt_cache_retention: "in-memory" as const,
      }
    : {};
```

Spread `promptCache` into the existing `chat.completions.create` body. Do not put it in SDK request options, `ChatOptions`, provider config, or caller messages.

---

## Task 1: Add and Test Mandatory OpenAI Request Controls

**Files:**
- Modify `client/src/lib/ai/providers/openai.ts:10-50,87-108`
- Modify `client/src/lib/ai/providers/__tests__/openaiProvider.test.ts`

- [ ] **Write failing SDK request-body tests first**

Mock the `openai` module with a hoisted typed `chat.completions.create` spy and a minimal successful completion. Preserve the existing temperature helper tests. Do not use `any` or mutate the provider's private client.

Add exact cases:

1. A `type: "openai"` provider sends the existing model, mapped messages, `max_tokens`, and temperature plus `prompt_cache_retention: "in-memory"` and a `prompt_cache_key` matching `/^[0-9a-f]{64}$/`.
2. Every captured built-in OpenAI request has both cache fields, including a direct user-only call with no system message.
3. Same exact model/system with different user transcript content yields the same key.
4. Same exact model/system with different assistant or repair messages yields the same key.
5. A byte-different system prompt yields a different key.
6. A different model with the same system prompt yields a different key.
7. A distinct custom system prompt passed as the system message yields a distinct key.
8. The key length is exactly 64 and contains none of the raw model, system prompt, transcript sentinel, repair response, API key, base URL, or provider ID.
9. For retry compatibility, use this explicit message progression:

```typescript
const basePrefix = [
  { role: "system", content: "Immutable system prompt" },
  { role: "user", content: "Immutable compiled batch input" },
] satisfies ChatMessage[];

const correctiveRetry = [
  ...basePrefix,
  { role: "assistant", content: "invalid response" },
  { role: "user", content: "return a complete replacement" },
] satisfies ChatMessage[];
```

Assert:

```typescript
expect(firstBody.messages).toEqual(basePrefix);
expect(secondBody.messages.slice(0, 2)).toEqual(basePrefix);
expect(basePrefix).toEqual([
  { role: "system", content: "Immutable system prompt" },
  { role: "user", content: "Immutable compiled batch input" },
]);
expect(secondBody.prompt_cache_key).toBe(firstBody.prompt_cache_key);
```

10. A `type: "custom"` provider sends exactly the pre-change body and has neither `prompt_cache_key` nor `prompt_cache_retention`.

- [ ] **Run the focused test and confirm failure**

```bash
source ~/.nvm/nvm.sh && nvm use && npm test -- client/src/lib/ai/providers/__tests__/openaiProvider.test.ts
```

Expected failure: built-in OpenAI request bodies do not contain cache fields. Existing temperature tests and the custom-body assertion remain valid.

- [ ] **Implement the smallest provider-local key helper**

In `openai.ts`, collect all system-message contents in original order, retain them byte-for-byte, serialize `[model, systemContents]`, hash with browser Web Crypto SHA-256, and return lowercase 64-character hexadecimal. Keep the helper unexported; do not cache the digest locally or add fallback hashing.

Mandatory behavior means unavailable or failing Web Crypto must not silently send an uncached built-in OpenAI request. Existing provider error normalization handles such a failure.

- [ ] **Add cache fields only to built-in OpenAI requests**

Compute and spread the cache object only when `this.config.type === "openai"`. Ensure the custom branch does not call the hash helper and does not serialize either field.

Do not cast the whole SDK request body. Let OpenAI 6.15.0's declarations type-check the fields and retention literal.

- [ ] **Run focused provider tests**

```bash
source ~/.nvm/nvm.sh && nvm use && npm test -- client/src/lib/ai/providers/__tests__/openaiProvider.test.ts client/src/lib/ai/__tests__/providerFactory.test.ts
```

Expected: explicit passing counts for OpenAI request fields, privacy, key stability/difference, custom behavior, and factory tests.

- [ ] **Run the full repository gate**

Use the Global Constraints command sequence.

- [ ] **Review and commit**

```bash
git add client/src/lib/ai/providers/openai.ts client/src/lib/ai/providers/__tests__/openaiProvider.test.ts
git commit -m "feat(ai): add mandatory OpenAI prompt caching"
```

---

## Task 2: Lock Structured Prompt and Cross-Provider Invariants

**Files:**
- Create `client/src/lib/ai/__tests__/structuredPromptCacheability.test.ts`
- Modify `client/src/lib/ai/__tests__/ollamaProvider.test.ts:42-67`

- [ ] **Add structured prompt cacheability assertions**

In the new test, import `extractPlaceholders`, `compileTemplate`, and the three structured feature configs/constants.

For speaker classification, segment merge, and chapter detection, assert exactly:

1. `extractPlaceholders(config.systemPrompt)` equals `[]`.
2. `config.systemPrompt` equals the feature's exported default system-prompt constant.
3. Compiling the system prompt with two materially different runtime variable maps returns identical strings.
4. None of `config.availablePlaceholders` occurs as `{{placeholder}}`, `{{#if placeholder}}`, or `{{#each placeholder}}` in the system prompt.
5. Runtime placeholders are present in the user template:
   - speaker: `speakers`, `segments`
   - merge: `segments`, `maxTimeGap`, `enableSmoothing`
   - chapter: `batchIndex`, `totalBatches`, `batchSize`, `minChapterLength`, `maxChapterLength`, `tagsAvailable`, `segments`, `previousChapter`
6. Both segment-merge user-template variants retain their runtime placeholders.
7. Compiled user messages change when transcript/batch sentinels change while the compiled system message stays exact.

These are characterization gates for Plans 1 and 2; they should pass before Phase 3 production changes. Do not rewrite prompt semantics or move response contracts.

- [ ] **Assert Ollama remains free of OpenAI cache fields**

Extend existing `/api/chat` and `/api/generate` fallback request-body assertions:

```typescript
expect(body).not.toHaveProperty("prompt_cache_key");
expect(body).not.toHaveProperty("prompt_cache_retention");
```

Do not modify `ollama.ts`.

- [ ] **Run focused invariant tests**

```bash
source ~/.nvm/nvm.sh && nvm use && npm test -- client/src/lib/ai/__tests__/structuredPromptCacheability.test.ts client/src/lib/ai/__tests__/ollamaProvider.test.ts client/src/lib/ai/providers/__tests__/openaiProvider.test.ts
```

Expected: all tests pass. Structured system prompts are immutable after Plans 1 and 2; Ollama and custom request bodies remain unchanged.

- [ ] **Run Plan 2 retry regressions**

```bash
source ~/.nvm/nvm.sh && nvm use && npm test -- client/src/lib/ai/__tests__/aiFeatureService.test.ts client/src/lib/ai/core/__tests__/aiFeatureService.timeout.test.ts client/src/lib/ai/core/__tests__/aiFeatureService.temperature.test.ts
```

Expected: exact prefix, corrective-history, provider retry, cancellation, timeout cleanup, and retry-count assertions pass unchanged.

- [ ] **Run the full repository gate**

Use the Global Constraints command sequence.

- [ ] **Review and commit**

```bash
git add client/src/lib/ai/__tests__/structuredPromptCacheability.test.ts client/src/lib/ai/__tests__/ollamaProvider.test.ts
git commit -m "test(ai): protect prompt cache prefixes"
```

---

## Task 3: Document the Provider Contract, Update DOX, and Verify Scope

**Files:**
- Modify `docs/features/architecture/ai-features-unified.md`
- Modify `client/src/lib/ai/AGENTS.md:15-30`

- [ ] **Update the architecture source of truth**

Document:

- caching is unconditional for `AIProviderConfig.type === "openai"` and invisible to users,
- every built-in OpenAI chat completion sends a SHA-256 key derived from the exact model and ordered system-message contents plus `prompt_cache_retention: "in-memory"`,
- the fixed digest contains no raw prompt, transcript, API key, endpoint, or provider identity,
- custom OpenAI-compatible and Ollama requests carry no OpenAI cache fields,
- direct `OpenAIProvider.chat` calls are covered,
- structured system prompts are static and runtime values stay in user messages,
- byte-different custom system prompts receive different keys,
- Plan 2's immutable prefix remains stable across retries and appended corrective history does not change the key,
- this is provider-side prefix caching, not response reuse,
- no settings, controls, translations, flags, cache interface, Responses API migration, or telemetry were added,
- cached-token telemetry is intentionally omitted under YAGNI,
- Phase 4 selective XML cleanup remains separate.

Replace stale claims that AI results are cached in IndexedDB or by the feature service.

- [ ] **Update the nearest AI DOX contract**

Add:

```markdown
- Built-in OpenAI chat requests always use a privacy-safe cache key derived from the exact model and system-message identity with in-memory retention.
- Custom OpenAI-compatible and Ollama request bodies must not receive OpenAI prompt-cache fields.
- Structured feature system prompts remain runtime-free; retries preserve their immutable system/user prefix.
```

- [ ] **Perform the DOX pass**

Re-read all applicable AGENTS files. Leave parent files unchanged because ownership, hierarchy, workflows, and child indexes did not change.

- [ ] **Run targeted final AI tests**

```bash
source ~/.nvm/nvm.sh && nvm use && npm test -- client/src/lib/ai/providers/__tests__/openaiProvider.test.ts client/src/lib/ai/__tests__/ollamaProvider.test.ts client/src/lib/ai/__tests__/providerFactory.test.ts client/src/lib/ai/__tests__/structuredPromptCacheability.test.ts client/src/lib/ai/__tests__/aiFeatureService.test.ts client/src/lib/ai/core/__tests__/aiFeatureService.timeout.test.ts client/src/lib/ai/core/__tests__/aiFeatureService.temperature.test.ts
```

Expected: explicit passing counts for cache fields, stable/different keys, custom prompts, OpenAI-only gating, immutable prompts, retry prefixes, timeout behavior, and unchanged providers.

- [ ] **Run final repository verification**

```bash
source ~/.nvm/nvm.sh && nvm use && npm run check
source ~/.nvm/nvm.sh && nvm use && npm run lint:fix
source ~/.nvm/nvm.sh && nvm use && npm run check
source ~/.nvm/nvm.sh && nvm use && npm test
```

Confirm successful TypeScript/Biome output and explicit Vitest file/test counts.

- [ ] **Perform final review**

Verify every built-in OpenAI body has both fields; custom and Ollama have neither; keys are stable for identical model/system identity and differ for model/system changes; keys are 64 lowercase hexadecimal characters without sensitive values; structured system prompts have zero placeholders; Plan 2 retry code is unchanged; OpenAI SDK types are used directly; and no telemetry, response cache, cache interface, setting, UI, translation, dependency, lockfile, XML, Responses API, `any`, placeholder, TODO, or commented-out code was introduced.

- [ ] **Inspect and commit**

```bash
git add docs/features/architecture/ai-features-unified.md client/src/lib/ai/AGENTS.md
git commit -m "docs(ai): document mandatory OpenAI prompt caching"
```
