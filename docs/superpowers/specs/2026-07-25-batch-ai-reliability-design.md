# Batch AI Reliability Design

## Goal

Make batch AI execution distinguish valid empty results from failures, improve malformed-response retries, always use OpenAI prompt caching, and use XML tags where they make long prompt sections clearer.

## Scope

The work applies to structured batch features that use `AIFeatureService`, currently speaker classification, segment merge, and chapter detection. Text-only operations keep their existing response shape unless they participate in a structured batch flow.

OpenAI receives cache controls automatically. Ollama and custom OpenAI-compatible providers keep their current request behavior unless they use the built-in OpenAI provider type.

## Delivery Order

The work is split into four implementation plans and executed in this order:

1. Structured batch outcomes
2. Corrective retries
3. Mandatory OpenAI prompt caching
4. Selective XML prompt structure

Each plan must leave the repository passing the full verification loop before the next plan starts. Plan 2 depends on Plan 1. Plan 4 preserves the outcome contract from Plan 1 and the stable prompt prefix from Plan 3.

## 1. Structured Batch Outcomes

Structured batch prompts and parsers use a discriminated response envelope:

```json
{
  "status": "empty",
  "retryable": false,
  "data": [],
  "error": null
}
```

The allowed states are:

- `ok`: `data` contains one or more valid results.
- `empty`: `data` is empty because the model found no applicable result; this is a successful terminal outcome.
- `error`: `error` contains a stable code and message; `retryable` explicitly controls another model attempt.

An empty provider body, malformed JSON, truncated JSON, or schema mismatch is not an `empty` outcome. These remain parse failures. Provider failures such as authentication, cancellation, rate limiting, timeout, and server errors remain normalized provider errors rather than model-produced envelopes.

Retryability is assigned by the layer that can identify the failure:

| Failure | Retryable | Reason |
| --- | --- | --- |
| Valid `empty` outcome | No | The model completed the task and found no result. |
| Empty provider body | Yes | No usable model outcome was received. |
| Truncated, malformed, or schema-invalid model output | Yes | A corrective retry can produce a valid replacement. |
| Network interruption or request timeout | Yes | The same request may succeed once connectivity recovers. |
| HTTP 408, 429, or 5xx provider response | Yes | The failure is transient; rate-limit retries must honor provider timing. |
| HTTP 400 or 422 request/input format rejection | No | Resending the same invalid request cannot fix it. |
| HTTP 401 or 403 authentication failure | No | Credentials or permissions must change first. |
| Unknown model, unsupported provider option, or missing local configuration | No | Configuration must change first. |
| User cancellation | No | Retrying would contradict the user action. |
| Model reports missing required input, invalid input shape, contradictory input, or unsupported task | No | The supplied input must change first. |
| Model reports its own output was truncated or it temporarily could not complete the task | Yes | A new generation may complete successfully. |

The model-facing prompt includes these examples. It must not label authentication, rate limiting, network, or server failures because those conditions are only known to the provider layer.

The core execution result must expose terminal success, valid empty success, and failure without requiring feature services to infer meaning from array length. Batch summaries count `empty` as succeeded.

## 2. Corrective Retries

The first attempt uses the normal immutable system message and compiled user message. When parsing or validation fails and retries remain, the next request keeps that prefix and appends:

1. The invalid assistant response.
2. A repair instruction containing the parser error code and concise field-level diagnostics.

The repair instruction asks for a complete replacement response matching the original contract. It must identify useful failures such as invalid fields, missing fields, wrong types, malformed JSON, and apparent truncation. It must not include unrelated implementation details.

Only failures with a received but invalid model response add corrective messages. Retryable provider failures are retried by the application without model feedback because no model response exists to repair.

Retry decisions follow explicit intent:

- A valid `empty` response never retries.
- A model `error` retries only when `retryable` is `true`.
- A malformed or schema-invalid response may retry with corrective feedback.
- Authentication, invalid request/input format, configuration errors, cancellation, and other non-retryable request errors never retry.
- Timeouts, network interruptions, HTTP 408/429/5xx responses, empty bodies, and malformed or truncated model responses are retryable.
- The configured retry limit remains authoritative.

Retry logging records the error category and corrective attempt without exposing credentials.

## 3. Mandatory OpenAI Prompt Caching

Prompt caching is automatic and has no user setting, feature flag, or opt-out.

The default system prompt for each feature is immutable and contains no batch-specific values. Runtime transcript content and other variables stay in the user message. Custom system prompts remain supported but receive a distinct cache key.

Every chat completion request through the built-in OpenAI provider sends:

- A stable `prompt_cache_key` derived from the model and exact system prompt identity.
- `prompt_cache_retention: "in-memory"` for batch-run prefix reuse without extended-retention configuration.

Corrective retries preserve the original system and user prefix so OpenAI can reuse cached input tokens. Ollama receives no cache fields. Tests assert the exact OpenAI SDK request and confirm that no settings or UI controls are introduced.

## 4. Selective XML Prompt Structure

XML tags are used only when they make a long or otherwise ambiguous prompt block easier to distinguish. Short prompts and short sections may remain plain prose or use their existing formatting. There is no mandatory tag vocabulary or requirement that an entire prompt be XML-shaped.

Typical long blocks may use descriptive tags such as:

```xml
<rules>...</rules>
<characters>...</characters>
```

Tag names must describe the enclosed block rather than follow a central schema. When dynamic values are placed inside an XML-tagged block, XML-reserved characters are escaped so transcript content cannot alter the surrounding structure. Prompt interpolation continues to use the existing template compiler.

The prompt cleanup must not add tags where headings or prose are already clear, and it must not change feature semantics, placeholder names, or the structured outcome envelope.

## Data Flow

```text
feature service
  -> compile immutable system prompt and dynamic user prompt
  -> OpenAI provider adds mandatory cache controls
  -> model returns structured outcome envelope
  -> parser validates envelope and feature data
  -> terminal result, or corrective retry with diagnostics
  -> ordered batch coordinator records success, empty, or error
```

## Testing

Each implementation plan adds focused tests before production changes.

- Outcome tests cover `ok`, `empty`, the retryability examples above, empty bodies, malformed JSON, and schema failures.
- Retry tests verify that the second request includes the invalid response and precise diagnostics while preserving the original prefix.
- Provider tests verify mandatory OpenAI cache fields and unchanged Ollama requests.
- Prompt tests verify selectively tagged long blocks, safe dynamic content, unchanged placeholders, immutable system prompts, and the response envelope without enforcing tags on every prompt section.
- Existing batch ordering, cancellation, timeout, and feature result tests must continue to pass.

## Documentation

Each plan updates `docs/features/architecture/ai-features-unified.md` for the behavior it ships. No user-facing setting or translation work is expected for caching because caching is unconditional and invisible.

## Non-Goals

- Client-side result caching
- A provider-wide cache abstraction
- New retry settings
- UI controls for caching
- Migration from Chat Completions to the Responses API
- Changes to manual transcript editing

## Acceptance Criteria

- Valid no-match responses complete without retry.
- Failures carry an explicit retry decision.
- Malformed-response retries include actionable model feedback.
- Every built-in OpenAI chat completion sends stable cache controls without user configuration.
- Long or ambiguous prompt blocks use descriptive XML tags where they improve clarity; no global XML schema is imposed.
- Each plan can be executed and verified as a separate change in the stated order.
