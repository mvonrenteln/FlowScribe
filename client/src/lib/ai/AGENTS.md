# AI Library DOX

## Purpose

- Own optional AI infrastructure, provider integration, prompts, parsing, feature services, export helpers, and AI tests.

## Ownership

- `core/` owns shared AI execution contracts.
- `providers/` owns provider-specific adapters.
- `parsing/` owns response parsing and validation.
- `features/` owns feature-level AI orchestration.
- `prompts/`, `logging/`, and `export/` own their named AI support areas.

## Local Contracts

- AI must remain optional; manual transcript editing must work without AI configuration.
- Do not bypass `core/`, `providers/`, `parsing/`, or feature orchestration seams.
- Validate provider responses before applying changes to transcript state.
- Structured batch features use the shared `ok` / `empty` / `error` envelope.
- `empty` is a successful terminal outcome; malformed or schema-invalid output remains a parser failure.
- Structured failures preserve `model`, `provider`, or `parser` origin plus explicit retryability.
- Structured-batch retries: parser failures retry with a corrective message (invalid response + repair instruction); retryable model/provider failures retry without one. The retry budget (`parseRetryCount`) is shared across all three causes.
- Retryable provider failures wait for the provider's normalized `retryAfter` (capped at 30s, 0ms if absent) before retrying; the wait is abortable and cancellation during it is terminal.
- Built-in OpenAI chat requests always use a privacy-safe cache key derived from the exact model and system-message identity with in-memory retention.
- Custom OpenAI-compatible and Ollama request bodies must not receive OpenAI prompt-cache fields.
- Structured feature system prompts remain runtime-free; retries preserve their immutable system/user prefix.
- Use descriptive XML tags only around long or ambiguous default prompt blocks; do not impose a global tag vocabulary or wrap every prompt section.
- Escape raw dynamic text placed in built-in XML blocks with the shared prompt helper; do not alter global template interpolation or custom prompts.
- Structured system prompts remain runtime-free, and prompt edits must preserve outcome, retry, and cache-prefix contracts.

## Work Guidance

- Read `docs/features/architecture/ai-features-unified.md` before changing AI architecture or feature flow.
- Keep prompts and parsers paired with tests for expected and malformed responses.
- Keep provider-specific details out of feature-level code where possible.

## Verification

- Run the root verification loop for AI edits.
- Add parser or feature tests for new AI behavior, including failure cases.

## Child DOX Index

- No child DOX files yet.
