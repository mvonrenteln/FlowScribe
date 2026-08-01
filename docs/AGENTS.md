# Documentation DOX

## Purpose

- Own repository documentation, architecture notes, feature docs, developer guides, issue notes, PR notes, and design references.

## Ownership

- `agent-rules/` contains durable coding and architecture guidance for agents.
- `developer/` contains implementation guides, debug protocols, and maintenance notes.
- `features/` contains feature documentation and architecture source-of-truth files.
- `issues/` and `prs/` contain tracked findings or PR notes.
- Top-level docs such as `usage.md`, `formats.md`, `shortcuts.md`, and `design.md` stay under this contract.

## Local Contracts

- Documentation, code comments, and developer-facing prose must be in English.
- Keep docs operational and current; delete stale claims rather than documenting history.
- Feature behavior changes must update the closest relevant documentation.

## Work Guidance

- Link architecture docs from feature docs when they define invariants.
- Keep examples short and runnable where possible.
- Avoid duplicating root rules; reference them instead.

## Verification

- For docs-only edits, no build is required unless examples, scripts, or generated references are changed.
- For behavior docs tied to code changes, run the same verification as the code change.

## Child DOX Index

- `features/AGENTS.md` owns feature and architecture documentation.
