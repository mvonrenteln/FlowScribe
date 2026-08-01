# Selective XML Prompt Structure Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Improve the clarity of long or ambiguous default prompts for speaker classification, segment merge, and chapter detection by selectively delimiting specific blocks with descriptive XML tags, while preserving all structured outcomes, retries, cacheability, feature behavior, placeholders, and schemas established by Plans 1-3.

**Architecture:** Keep the existing prompt compiler and feature execution flow unchanged. Add one shared pure `escapeXmlText` helper, then apply it only to raw dynamic values inserted into newly tagged blocks of built-in default user prompts. Add tags through exact edits to selected default prompt constants; do not introduce an XML schema, tag registry, automatic transformation, or custom-prompt conversion.

**Tech Stack:** TypeScript strict mode, existing prompt/config/service layers, Vitest, Biome, npm 11, Node 24, standard string and regular-expression APIs only.

## Global Constraints

- Repository root: `/Users/marc.von-renteln/GitHub/FlowScribe`; all paths below are relative to it.
- Treat Plans 1-3 as implemented and stable: structured outcomes, all six model error examples, corrective retries, immutable prefixes, and mandatory built-in OpenAI cache fields.
- Before editing, re-read the applicable DOX chain for root, `client/src/lib/ai`, and `docs/features`.
- XML remains optional structure. Do not define a required vocabulary, wrapper schema, central tag type, or rule that prompts or headings must use XML.
- Do not wrap whole prompts. Preserve clear short prose and headings unchanged.
- Make only these intentional structural choices:
  - all three features: wrap the long structured outcome instructions and examples in `<response_contract>`;
  - speaker: wrap the long recognition guidance in `<speaker_recognition_rules>` and delimit default dynamic inputs with `<available_speakers>` and `<sections_to_classify>`;
  - segment merge: wrap long merge criteria in `<merge_rules>`, conditional smoothing instructions in `<smoothing_rules>`, and default dynamic transcript input in `<segments_for_context>`;
  - chapter detection: keep its short system task/constraints as plain headings, while delimiting default dynamic inputs with `<available_tag_ids>`, `<previous_chapter_context>`, and `<transcript_segments>`.
- These names describe selected blocks only; they are not an API or mandatory vocabulary for other prompts.
- Preserve every Plan 1 envelope field and meaning, all six model codes and retryability, and the provider-layer error disclaimer.
- Do not alter Plan 2 repair-message prose, diagnostics, conversation ordering, shared budget, or immutable prefix mechanics.
- Do not modify provider code or cache fields. Prompt text creates one new cache identity; afterward each default system prompt remains static and placeholder-free.
- Runtime transcript, speaker, tag, settings, batch, and previous-chapter values remain in user messages.
- Do not change placeholder names, `availablePlaceholders`, schemas, response types, outcomes, logs, progress, ID mapping, smoothing, or chapter continuation behavior.
- Do not modify `compileTemplate` interpolation. Escape only variables placed inside selected built-in XML blocks.
- If either the system prompt or user template is overridden, the complete custom-prompt execution remains caller-controlled and receives raw variables as before; do not partially escape it.
- Do not convert revision, rewrite, chapter metadata, content transformation, or other text-only prompts.
- No regex or bulk prompt conversion. Edit each named block deliberately.
- No dependencies, provider/cache changes, settings, UI, translations, flags, package, or lockfile changes.
- English documentation/comments only; strict TypeScript; no `any`, TODO implementation, placeholder implementation, broad snapshot, or commented-out code.
- Keep all Plan 1-3 tests. Update focused prompt/config/service tests rather than replacing them.
- Before every commit inspect `git status --short`, the task-specific diff, `git diff --check`, and `git log --oneline -10`; stage only intended files.
- After each code task run:

```bash
source ~/.nvm/nvm.sh && nvm use && npm run check
source ~/.nvm/nvm.sh && nvm use && npm run lint:fix
source ~/.nvm/nvm.sh && nvm use && npm run check
source ~/.nvm/nvm.sh && nvm use && npm test
```

If `lint:fix` changes files, rerun focused tests before the second `check`. Require explicit Vitest passed/failed counts.

## Exact File Map

### Modify

- `client/src/lib/ai/prompts/promptBuilder.ts:18-52`: add the shared pure XML text helper without changing compilation.
- `client/src/lib/ai/prompts/index.ts:7-13`: export the helper.
- `client/src/lib/ai/prompts/__tests__/promptBuilder.test.ts:1-161`: add focused helper tests.
- `client/src/lib/ai/features/speaker/config.ts`: edit selected system/user blocks after Plan 1.
- `client/src/lib/ai/features/speaker/service.ts:105-126`: escape only default tagged variables.
- `client/src/lib/ai/__tests__/speakerService.test.ts`: add prompt and default/custom variable assertions.
- `client/src/lib/ai/features/segmentMerge/config.ts`: edit selected blocks after Plan 1.
- `client/src/lib/ai/features/segmentMerge/promptBuilder.ts:88-133`: add default-only escaping.
- `client/src/lib/ai/features/segmentMerge/__tests__/config.test.ts:15-61`: assert intentional structure.
- `client/src/lib/ai/features/segmentMerge/__tests__/promptBuilder.test.ts:19-166`: cover escaping and custom templates.
- `client/src/lib/ai/features/chapterDetection/config.ts`: edit selected blocks after Plan 1.
- `client/src/lib/ai/features/chapterDetection/service.ts:148-168,277-284`: escape selected default values.
- `client/src/lib/ai/features/chapterDetection/__tests__/service.test.ts`: cover compiled variables and custom prompts.
- `client/src/lib/ai/__tests__/structuredPromptCacheability.test.ts`: update Plan 3 characterization assertions.
- `docs/features/architecture/ai-features-unified.md`: document selective prompt structure.
- `client/src/lib/ai/AGENTS.md:15-30`: record the durable XML/escaping contract.

### Intentionally Unchanged

- `client/src/lib/ai/core/**`: no envelope, retry, prefix, result, or type changes.
- `client/src/lib/ai/parsing/**`: schemas and parsing remain unchanged.
- `client/src/lib/ai/providers/**`: no cache-key algorithm, fields, or request changes.
- `compileTemplate`, `compilePrompt`, and `PromptVariables` interfaces.
- Feature response schemas and result interfaces.
- Custom prompt storage/editors and all text-only prompts.
- UI, settings, translations, package files, and lockfile.

## Interface Contract

Add one exported pure helper:

```typescript
/**
 * Escapes raw text for placement inside an XML text block.
 *
 * Existing XML entities remain stable so applying the helper again does not
 * double-escape an already escaped value.
 */
export function escapeXmlText(value: string): string;
```

Required behavior:

| Input | Output |
| --- | --- |
| `A & B` | `A &amp; B` |
| `<tag>` | `&lt;tag&gt;` |
| `"quoted" and 'single'` | `&quot;quoted&quot; and &apos;single&apos;` |
| `&amp; &lt; &gt; &quot; &apos;` | unchanged |
| applying the helper twice | same output as applying it once |

Recognize only the five named XML entities when preserving existing escapes. Do not add XML parsing, DOM usage, numeric-entity handling, or escaping to global template interpolation.

---

## Task 1: Add the Small Shared XML Text Helper

**Files:**
- Modify `client/src/lib/ai/prompts/promptBuilder.ts:18-52`
- Modify `client/src/lib/ai/prompts/index.ts:7-13`
- Modify `client/src/lib/ai/prompts/__tests__/promptBuilder.test.ts:1-161`

- [ ] **Write failing focused tests first**

Add a dedicated `escapeXmlText` block covering unchanged text/empty input, all five reserved characters, multiline transcript text, reserved characters adjacent to existing entities, preservation of the five named entities, idempotence, and proof that direct `compileTemplate` substitution remains raw.

- [ ] **Run the focused test and confirm failure**

```bash
source ~/.nvm/nvm.sh && nvm use && npm test -- client/src/lib/ai/prompts/__tests__/promptBuilder.test.ts
```

Expected failure: `escapeXmlText` is not exported.

- [ ] **Implement the minimal helper**

Place it near existing string helpers. Escape unescaped ampersands first, preserving only the five exact lowercase named entities, then replace `<`, `>`, `"`, and `'`. Do not alter compilation or placeholder extraction.

Export it from `prompts/index.ts`. Keep its JSDoc explicit that callers opt in only for XML text content.

- [ ] **Run focused tests and the full gate**

Run the focused test, then the Global Constraints verification sequence.

- [ ] **Inspect and commit**

```bash
git add client/src/lib/ai/prompts/promptBuilder.ts client/src/lib/ai/prompts/index.ts client/src/lib/ai/prompts/__tests__/promptBuilder.test.ts
git commit -m "feat(ai-prompts): add XML text escaping"
```

---

## Task 2: Structure Speaker Classification Prompts Selectively

**Files:**
- Modify `client/src/lib/ai/features/speaker/config.ts`
- Modify `client/src/lib/ai/features/speaker/service.ts:105-126`
- Modify `client/src/lib/ai/__tests__/speakerService.test.ts`
- Modify `client/src/lib/ai/__tests__/structuredPromptCacheability.test.ts`

- [ ] **Write failing prompt and service tests**

Assert exactly one balanced pair for each selected tag:

```xml
<response_contract>...</response_contract>
<speaker_recognition_rules>...</speaker_recognition_rules>
<available_speakers>...</available_speakers>
<sections_to_classify>...</sections_to_classify>
```

Also assert:

1. short `TASK` prose remains untagged;
2. the response contract retains every envelope field/state, all six codes, exact retryability, and provider disclaimer;
3. placeholders remain exactly `speakers` and `segments` and the system prompt has none;
4. default speaker/segment sentinels containing reserved characters reach `executeFeature` escaped exactly once;
5. existing named entities stay stable;
6. a custom user template, a custom system prompt, or both receive original unescaped values;
7. result mapping, empty outcomes, failures, and batch behavior remain unchanged.

Update Plan 3's cacheability test without adding a whole-prompt snapshot.

- [ ] **Run focused tests and confirm failure**

```bash
source ~/.nvm/nvm.sh && nvm use && npm test -- client/src/lib/ai/__tests__/speakerService.test.ts client/src/lib/ai/__tests__/structuredPromptCacheability.test.ts
```

Expected failure: selected tags are absent and default variables are raw.

- [ ] **Apply the exact prompt edits**

In the Plan 1 system prompt, wrap the complete structured response contract in `<response_contract>` and the existing heuristics, humor guidance, and decision steps in `<speaker_recognition_rules>`. Leave short task prose and headings unchanged.

In the default user template, retain headings but place only dynamic bodies inside `<available_speakers>` and `<sections_to_classify>`.

- [ ] **Escape only default tagged values**

In `classifySpeakers`, format values as today, then apply `escapeXmlText` only when neither `customPrompt.systemPrompt` nor `customPrompt.userPromptTemplate` is supplied. If either override is active, pass raw values. Do not change global interpolation, mapping, or execution options.

- [ ] **Run focused regressions and the full gate**

```bash
source ~/.nvm/nvm.sh && nvm use && npm test -- client/src/lib/ai/__tests__/speakerService.test.ts client/src/lib/ai/__tests__/structuredPromptCacheability.test.ts client/src/lib/ai/__tests__/aiFeatureService.test.ts
```

Then run the full gate.

- [ ] **Inspect and commit**

```bash
git add client/src/lib/ai/features/speaker/config.ts client/src/lib/ai/features/speaker/service.ts client/src/lib/ai/__tests__/speakerService.test.ts client/src/lib/ai/__tests__/structuredPromptCacheability.test.ts
git commit -m "feat(ai-speaker): structure default prompts selectively"
```

---

## Task 3: Delimit Merge Rules and Default Transcript Content

**Files:**
- Modify `client/src/lib/ai/features/segmentMerge/config.ts`
- Modify `client/src/lib/ai/features/segmentMerge/promptBuilder.ts:88-133`
- Modify `client/src/lib/ai/features/segmentMerge/__tests__/config.test.ts:15-61`
- Modify `client/src/lib/ai/features/segmentMerge/__tests__/promptBuilder.test.ts:19-166`
- Modify `client/src/lib/ai/__tests__/structuredPromptCacheability.test.ts`

- [ ] **Write failing config and prompt-builder tests**

Assert:

1. prefilter facts, merge criteria, artifacts, boundary preservation, confidence, and exclusions are enclosed by one `<merge_rules>` pair;
2. the Plan 1 outcome section is enclosed by `<response_contract>` without losing semantics or examples;
3. both built-in user variants wrap `{{segments}}` in `<segments_for_context>` and conditional smoothing instructions in `<smoothing_rules>`;
4. short `TASK`, `CONTEXT`, and consecutive-segment prose remains untagged;
5. `segments`, `maxTimeGap`, and `enableSmoothing` placeholders remain unchanged;
6. default formatted segment content is escaped exactly once;
7. other variables are not transformed;
8. a custom `userTemplate`, custom `systemPrompt`, or both receive raw segments and no partial escaping;
9. filtering, mapping, template selection, rules, schema, empty handling, smoothing, and ordering remain intact.

- [ ] **Run focused tests and confirm failure**

```bash
source ~/.nvm/nvm.sh && nvm use && npm test -- client/src/lib/ai/features/segmentMerge/__tests__/config.test.ts client/src/lib/ai/features/segmentMerge/__tests__/promptBuilder.test.ts client/src/lib/ai/__tests__/structuredPromptCacheability.test.ts
```

Expected failure: merge tags are absent and default transcript content is unescaped.

- [ ] **Apply exact prompt edits**

Edit only the named blocks. Preserve every rule, example, field, and heading inside them. Use `<smoothing_rules>` inside the existing `enableSmoothing` conditional in both templates.

- [ ] **Escape only the default transcript variable**

In `buildMergePrompt`, build the formatted segment string, select the final template, and apply `escapeXmlText` to `variables.segments` only when both `params.systemPrompt` and `params.userTemplate` are absent. If either override is active, keep raw segments. Leave all other variables unchanged.

- [ ] **Run focused regressions and the full gate**

```bash
source ~/.nvm/nvm.sh && nvm use && npm test -- client/src/lib/ai/features/segmentMerge/__tests__/config.test.ts client/src/lib/ai/features/segmentMerge/__tests__/promptBuilder.test.ts client/src/lib/ai/features/segmentMerge/__tests__/service.test.ts client/src/lib/ai/features/segmentMerge/__tests__/responseProcessor.test.ts client/src/lib/ai/__tests__/structuredPromptCacheability.test.ts
```

Then run the full gate.

- [ ] **Inspect and commit**

```bash
git add client/src/lib/ai/features/segmentMerge/config.ts client/src/lib/ai/features/segmentMerge/promptBuilder.ts client/src/lib/ai/features/segmentMerge/__tests__/config.test.ts client/src/lib/ai/features/segmentMerge/__tests__/promptBuilder.test.ts client/src/lib/ai/__tests__/structuredPromptCacheability.test.ts
git commit -m "feat(ai-merge): delimit merge prompt blocks"
```

---

## Task 4: Delimit Chapter Inputs Without Changing Sequential Context

**Files:**
- Modify `client/src/lib/ai/features/chapterDetection/config.ts`
- Modify `client/src/lib/ai/features/chapterDetection/service.ts:148-168,277-284`
- Modify `client/src/lib/ai/features/chapterDetection/__tests__/service.test.ts`
- Modify `client/src/lib/ai/__tests__/structuredPromptCacheability.test.ts`

- [ ] **Write failing chapter prompt/service tests**

Assert:

1. short system task/constraints remain unwrapped and only the long outcome section receives `<response_contract>`;
2. batch metadata stays plain;
3. tags, previous chapter, and segments use the three selected tags;
4. no empty previous-context tag appears for the first batch;
5. all eight placeholders remain unchanged and the system prompt remains placeholder-free;
6. default tag, segment, and previous-context text is escaped exactly once while numeric values remain unchanged;
7. a custom system prompt, custom user template, or both receive raw values;
8. sequential context, empty behavior, array schema, mapping, progress, logs, callbacks, and failures remain unchanged.

- [ ] **Run focused tests and confirm failure**

```bash
source ~/.nvm/nvm.sh && nvm use && npm test -- client/src/lib/ai/features/chapterDetection/__tests__/service.test.ts client/src/lib/ai/__tests__/structuredPromptCacheability.test.ts
```

Expected failure: chapter tags and conditional wrapper are absent and dynamic content remains raw.

- [ ] **Apply exact prompt edits**

Wrap only the structured response contract in the system prompt. In the default user template:

```xml
<available_tag_ids>
{{tagsAvailable}}
</available_tag_ids>

{{#if previousChapter}}
<previous_chapter_context>
{{previousChapter}}
</previous_chapter_context>
{{/if}}

<transcript_segments>
{{segments}}
</transcript_segments>
```

Retain descriptive headings where they add context. Do not tag batch metadata or the whole prompt.

- [ ] **Escape only default tagged variables**

When constructing variables in `detectChapters`, escape `tagsAvailable`, `segments`, and `previousChapter` only when no custom system prompt or user template is active. If either override is supplied, preserve all raw values.

Escape previous context when inserting it into the next default request, not when storing results, so chapter titles/summaries and callbacks remain unchanged.

- [ ] **Run focused regressions and the full gate**

```bash
source ~/.nvm/nvm.sh && nvm use && npm test -- client/src/lib/ai/features/chapterDetection/__tests__/service.test.ts client/src/lib/ai/features/chapterDetection/__tests__/utils.test.ts client/src/lib/ai/__tests__/structuredPromptCacheability.test.ts client/src/lib/ai/__tests__/aiFeatureService.test.ts
```

Then run the full gate.

- [ ] **Inspect and commit**

```bash
git add client/src/lib/ai/features/chapterDetection/config.ts client/src/lib/ai/features/chapterDetection/service.ts client/src/lib/ai/features/chapterDetection/__tests__/service.test.ts client/src/lib/ai/__tests__/structuredPromptCacheability.test.ts
git commit -m "feat(ai-chapters): delimit chapter prompt blocks"
```

---

## Task 5: Document the Convention, Complete DOX, and Verify Plans 1-3

**Files:**
- Modify `docs/features/architecture/ai-features-unified.md`
- Modify `client/src/lib/ai/AGENTS.md:15-30`

- [ ] **Update the architecture source of truth**

Document:

- tags are optional and reserved for long or ambiguous blocks;
- clear short prose/headings remain valid;
- there is no mandatory vocabulary, wrapper schema, automatic conversion, or all-prompts rule;
- the exact selected blocks for the three features;
- raw dynamic content in tagged default blocks uses `escapeXmlText`;
- named entities are stable and values are escaped only at feature boundaries;
- custom prompts and untagged variables remain untouched;
- envelopes, six codes, retryability, schemas, and behavior remain unchanged;
- corrective retry messages remain concise plain text;
- system prompts remain runtime-free;
- this prompt edit creates one new OpenAI cache identity, which then stays stable;
- provider cache fields, custom-provider behavior, and Ollama behavior remain unchanged;
- text-only and user-authored prompts were intentionally not converted.

Remove any stale claim that XML is globally required.

- [ ] **Update the nearest AI DOX contract**

Add:

```markdown
- Use descriptive XML tags only around long or ambiguous default prompt blocks; do not impose a global tag vocabulary or wrap every prompt section.
- Escape raw dynamic text placed in built-in XML blocks with the shared prompt helper; do not alter global template interpolation or custom prompts.
- Structured system prompts remain runtime-free, and prompt edits must preserve outcome, retry, and cache-prefix contracts.
```

- [ ] **Perform the final DOX pass**

Re-read all applicable DOX chains. Leave parent AGENTS files and child indexes unchanged because ownership, hierarchy, workflows, and file boundaries did not change. Do not create a feature-specific child AGENTS file.

- [ ] **Run targeted Plan 1-3 regressions**

```bash
source ~/.nvm/nvm.sh && nvm use && npm test -- client/src/lib/ai/prompts/__tests__/promptBuilder.test.ts client/src/lib/ai/__tests__/structuredPromptCacheability.test.ts client/src/lib/ai/__tests__/speakerService.test.ts client/src/lib/ai/features/segmentMerge/__tests__/config.test.ts client/src/lib/ai/features/segmentMerge/__tests__/promptBuilder.test.ts client/src/lib/ai/features/segmentMerge/__tests__/service.test.ts client/src/lib/ai/features/chapterDetection/__tests__/service.test.ts client/src/lib/ai/__tests__/structuredBatchResponse.test.ts client/src/lib/ai/__tests__/aiFeatureService.test.ts client/src/lib/ai/core/__tests__/aiFeatureService.timeout.test.ts client/src/lib/ai/providers/__tests__/openaiProvider.test.ts client/src/lib/ai/__tests__/ollamaProvider.test.ts
```

Expected: explicit passing counts for selective tags, escaping, custom prompts, envelopes, retries, plain-text corrective history, immutable prefixes, cache fields, and unchanged providers.

- [ ] **Run final repository verification**

```bash
source ~/.nvm/nvm.sh && nvm use && npm run check
source ~/.nvm/nvm.sh && nvm use && npm run lint:fix
source ~/.nvm/nvm.sh && nvm use && npm run check
source ~/.nvm/nvm.sh && nvm use && npm test
```

Confirm successful TypeScript/Biome output and explicit Vitest counts. If lint changes files, rerun focused tests before the final check/test.

- [ ] **Perform final consistency review**

Verify selected tags are balanced; no whole prompt or unrelated heading was converted; system prompts remain placeholder-free; placeholders and lists are unchanged; response contracts retain every state/code/example; no retry/parser/schema/result behavior changed; custom prompts remain raw; tagged content is escaped exactly once; Plan 2 prefixes remain immutable; Plan 3 provider implementation is untouched; and no dependency, configuration, provider, UI, setting, translation, package, lockfile, text-only prompt, `any`, TODO, or commented-out code was introduced.

- [ ] **Inspect and commit**

```bash
git add docs/features/architecture/ai-features-unified.md client/src/lib/ai/AGENTS.md
git commit -m "docs(ai): document selective XML prompts"
```
