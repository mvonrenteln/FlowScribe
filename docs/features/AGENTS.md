# Feature Documentation DOX

## Purpose

- Own feature documentation and architecture notes for FlowScribe capabilities.

## Ownership

- `architecture/` contains source-of-truth architecture documents and should be treated as binding for referenced invariants.
- AI feature docs describe optional AI behavior and must preserve manual-first assumptions.
- `README.md` indexes feature and architecture documentation.

## Local Contracts

- Keep architecture docs aligned with implementation when sync, store, AI, backup, or import/export behavior changes.
- Do not document speculative features as shipped behavior.
- TODO docs must make unfinished status explicit.

## Work Guidance

- Read `architecture/player-transcript-sync.md` before documenting player, selection, navigation, or scroll-follow changes.
- Read AI architecture docs before documenting AI provider, parsing, or orchestration changes.

## Verification

- Docs-only edits need no build unless they include checked examples or scripts.
- For paired code changes, run the root verification loop required by the changed code.

## Child DOX Index

- No child DOX files yet.
