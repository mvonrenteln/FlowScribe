# Demo Data DOX

## Purpose

- Own sample transcript fixtures and scripts used for demos, local testing, and documentation examples.

## Ownership

- `Dialogue.json` and `Dialogue.txt` are sample transcript fixtures.
- `scripts/` owns fixture conversion or maintenance scripts.

## Local Contracts

- Keep fixtures deterministic and small enough for repository use.
- Do not include private, copyrighted, or user-identifying transcript data.
- Preserve compatibility with the import formats documented in `docs/formats.md`.

## Work Guidance

- Prefer updating conversion scripts over hand-editing generated fixture fields when repeatability matters.
- Document fixture format changes in `docs/formats.md` or nearby developer docs.

## Verification

- Run the root verification loop when fixture or script changes affect app behavior or tests.
- For script-only changes, run the script if it has no external dependency or stateful side effect.

## Child DOX Index

- No child DOX files.
