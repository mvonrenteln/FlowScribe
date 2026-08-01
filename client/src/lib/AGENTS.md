# Library DOX

## Purpose

- Own client domain logic, AI infrastructure, persistence, store, parsing, export, logging, workers, and reusable utilities.

## Ownership

- `ai/` owns optional AI infrastructure and feature orchestration.
- `store/` owns Zustand slices, selectors, persistence guard, and editor state contracts.
- `backup/`, `settings/`, `storage/`, `transcript/`, `logging/`, `workers/`, and utility files remain under this contract unless a child DOX is added.
- Tests for library behavior live in local `__tests__/` folders.

## Local Contracts

- Prefer pure functions for parsing, formatting, matching, and transformation logic.
- Keep browser side effects isolated to services or integration layers.
- Do not bypass domain types where `SegmentId`, `SpeakerId`, `TimeMs`, or similar types already exist.

## Work Guidance

- Use lookup maps for measured hot paths instead of repeated scans.
- Keep exported public functions documented with concise JSDoc when their purpose or side effects are not obvious.
- Do not add compatibility branches without persisted data, shipped behavior, external consumers, or explicit user need.

## Verification

- Run the root verification loop for library edits.
- For pure utilities, add focused Vitest coverage for edge cases and branch behavior.

## Child DOX Index

- `ai/AGENTS.md` owns AI infrastructure and feature code.
- `store/AGENTS.md` owns Zustand state and sync invariants.
