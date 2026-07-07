# Client DOX

## Purpose

- Own the frontend Vite client package, browser entrypoint, static public assets, and application source tree.

## Ownership

- `src/` contains all React, TypeScript, styling, state, tests, i18n, and client utilities.
- `public/` contains static browser assets and dictionaries served by Vite.
- `index.html` is the browser shell.
- Generated or external content under `node_modules/` and `coverage/` is not owned by DOX.

## Local Contracts

- This is a frontend-only React 18 app; do not introduce server runtime assumptions.
- User-facing text must go through `react-i18next` with English and German keys.
- Keep browser APIs guarded where persistence, files, audio, or storage handles may be unavailable.

## Work Guidance

- Preserve existing Vite and React patterns unless the task requires changing them.
- Static assets should be stable filenames when referenced by browser metadata or tests.
- Do not edit generated coverage output.

## Verification

- For code changes in this subtree, run from the repository root: `source ~/.nvm/nvm.sh && nvm use && npm run check`, `source ~/.nvm/nvm.sh && nvm use && npm run lint:fix`, and `source ~/.nvm/nvm.sh && nvm use && npm test`.

## Child DOX Index

- `src/AGENTS.md` owns client application source code and tests.
