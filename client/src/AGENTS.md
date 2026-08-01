# Client Source DOX

## Purpose

- Own React application source, domain logic, client-side tests, styling, translations, and browser integration code.

## Ownership

- `components/` owns UI components and interaction surfaces.
- `hooks/` owns reusable React hooks.
- `lib/` owns domain logic, AI infrastructure, persistence, store, parsing, and utilities.
- `translations/` owns i18n resource JSON.
- `i18n/` owns i18next setup.
- `pages/`, `types/`, and `test/` stay under this source contract unless a child DOX is added.

## Local Contracts

- Keep TypeScript strict and avoid `any` in source and tests.
- Any visible string must use `t()` and exist in both `translations/en.json` and `translations/de.json`.
- New behavior and bug fixes need tests that fail without the change.
- Keep transcript editing manual-first; AI features must remain optional enhancements.

## Work Guidance

- Prefer pure utilities for branchy logic and keep side effects in components, hooks, or services.
- Use narrow Zustand selectors instead of broad state reads.
- Avoid unstable props in heavily rendered transcript rows.

## Verification

- Run the root verification loop for source edits: check, lint:fix, test.
- If lint:fix changes files, rerun check and tests.

## Child DOX Index

- `components/AGENTS.md` owns UI components and shadcn/Radix composition.
- `hooks/AGENTS.md` owns reusable React hooks.
- `lib/AGENTS.md` owns domain logic, services, persistence, AI, parsing, and utilities.
- `translations/AGENTS.md` owns i18n resource files.
