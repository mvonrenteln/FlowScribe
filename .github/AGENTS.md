# GitHub Automation DOX

## Purpose

- Own GitHub repository automation under `.github/`, including CI workflows and future GitHub templates.

## Ownership

- `.github/workflows/` contains GitHub Actions workflow definitions.
- Repository-wide runtime, lint, test, and commit rules stay in the root `AGENTS.md`.

## Local Contracts

- Keep CI aligned with root commands: `npm run check`, `npm run lint`, and `npm test`.
- Use the Node and npm versions declared by the repository root.
- Do not add secrets or machine-specific paths to workflow files.

## Work Guidance

- Prefer small workflow changes over new jobs or matrices unless a concrete failure mode requires them.
- Keep workflow names and step names descriptive enough to diagnose failures from the GitHub UI.

## Verification

- For workflow edits, run the closest local equivalent command before reporting completion.
- If local verification cannot exercise a GitHub-only behavior, state that clearly in the final response.

## Child DOX Index

- No child DOX files.
