---
name: sync-branch-and-open-pr
description: Use this skill to finish Git work safely: sync branch with main, commit pending changes, push branch, create a PR, and report mergeability. Trigger when user asks to create/open a PR, sync/rebase with main before a PR, or run a commit-push-PR closeout flow.
---

# Sync Branch and Open PR

Use this skill when the user wants the standard Git closeout flow.

## Trigger phrases

- create pr
- open pr
- sync with main and open pr
- commit, push and pr
- prepare branch to be mergeable and open pr
- run the git release flow

## Goal

Produce a clean, reviewable PR from the current local work with minimal risk.

## Required flow

1. Inspect repository state:
   - `git status --short --branch`
   - `git diff --staged`
   - `git diff`
   - `git log --oneline -8`
2. Ensure branch strategy:
   - If currently on `main`, create a new feature branch.
   - If already on a feature branch, keep it unless the user explicitly wants a rename.
3. Sync with base:
   - `git fetch origin main`
   - Rebase current branch onto `origin/main`.
   - Resolve conflicts carefully and preserve user changes.
4. Commit pending work:
   - Stage relevant files.
   - Create a semantic commit message that explains why.
   - Do not create empty commits.
5. Push branch:
   - `git push -u origin <branch>` when first push.
   - Otherwise `git push`.
6. Create PR with `gh`:
   - Base: `main`
   - Head: current branch
   - Include concise summary and verification steps.
7. Check PR mergeability:
   - `gh pr view <number> --json mergeable,mergeStateStatus,url,baseRefName,headRefName`
   - Report result clearly.

## Safety constraints

- Never use destructive commands (`git reset --hard`, force checkout, deleting user files).
- Never force-push unless the user explicitly requests it.
- Never amend commits unless the user explicitly requests it.
- Never push directly to `main`.
- Do not change git config.

## Output format

Return:

- Branch name
- Commit hash and message
- PR URL
- Mergeability status (`mergeable` and `mergeStateStatus`)
- Any blockers (conflicts, failing checks, missing permissions)
