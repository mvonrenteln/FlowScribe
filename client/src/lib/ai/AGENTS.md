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

## Work Guidance

- Read `docs/features/architecture/ai-features-unified.md` before changing AI architecture or feature flow.
- Keep prompts and parsers paired with tests for expected and malformed responses.
- Keep provider-specific details out of feature-level code where possible.

## Verification

- Run the root verification loop for AI edits.
- Add parser or feature tests for new AI behavior, including failure cases.

## Child DOX Index

- No child DOX files yet.
