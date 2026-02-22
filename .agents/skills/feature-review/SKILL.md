---
name: feature-review
description: "Use this skill for ALL code reviews — it is the default review skill for this project. Covers both functional/spec correctness and technical code quality (includes typescript-react-reviewer). Always use this skill when the user says: review, code review, PR review, feature review, review my changes, review this branch, review uncommitted changes, review commits, does this implement X correctly, is this implementation correct, make a review."
---

# Feature Review — Functional + Technical

A holistic review skill that checks **functional correctness first**, then applies technical code quality review via the `typescript-react-reviewer` skill.

## Step 1: Establish the Specification

Before reviewing any code, you need to know **what the change is supposed to do**.

### Automatic sources (check in order)

1. **Linked issue** — look for `#123` references in the branch name, commit messages, or PR description. Read the issue.
2. **Documentation** — check `docs/features/`, `docs/developer/`, `docs/issues/`, `Features.md`, `progress.md` for relevant entries.
3. **AGENTS.md** — check for stated invariants or non-negotiables that apply.
4. **Commit messages / PR description** — extract intent from the diff metadata.

### When the specification is unclear — ask

If none of the above yields a clear picture of the intended behavior, **stop and ask the user**:

> I wasn't able to find a clear specification for this change. Before I review, I need to understand the intent:
>
> 1. What problem does this change solve or what feature does it implement?
> 2. Is there a linked issue, ticket, or design document I should read?
> 3. Are there any known edge cases or acceptance criteria I should validate against?
>
> Please share any of the above so I can give you a meaningful functional review.

Do not proceed with a functional review based on guesses. A technically clean implementation of the wrong behavior is still wrong.

---

## Step 2: Functional Correctness Review

With the specification in hand, evaluate the code change against it.

### Correctness checklist

| Area | Questions to ask |
|------|-----------------|
| **Happy path** | Does the implementation produce the correct output for the primary use case described in the spec? |
| **Edge cases** | Are boundary conditions from the spec handled (empty input, max values, zero, missing data, concurrent calls)? |
| **Rejection / error paths** | Does the code handle invalid input or failure modes as specified? |
| **Side effects** | Are the stated effects (store updates, events emitted, UI changes) actually triggered? |
| **Spec completeness** | Does the change implement the *full* scope of the spec, or only a subset? Explicitly flag anything left out. |
| **Regression risk** | Could this change break existing behavior that is not mentioned in the spec? Check related code paths. |

### Reporting functional issues

Rate each issue:

- 🔴 **Wrong** — behavior is clearly incorrect relative to spec (must fix)
- 🟡 **Incomplete** — partially correct but misses spec requirements (must fix)
- 🟠 **Risky** — might be correct but is fragile or likely to break adjacent behavior (should fix)
- 🔵 **Clarification needed** — spec is ambiguous; flag for discussion rather than guessing

---

## Step 3: Project-Specific Invariants

For FlowScribe, always verify the following regardless of what the spec says:

- **Player ↔ Transcript sync**: Any change touching time/seeking must go through `seekToTime`. Check `docs/features/architecture/player-transcript-sync.md`.
- **AI infra layering**: Changes in `client/src/lib/ai/` must not bypass `core/ → providers/ → parsing/ → features/` layering.
- **Tests**: New behavior must have tests. If none are added, flag it.
- **Verification loop**: Check that `npm run check && npm run lint:fix && npm test` would pass (or ask if it has been run).

---

## Step 4: Technical Code Quality Review

After functional correctness is established, apply the full technical review from the `typescript-react-reviewer` skill.

> **Include the full `typescript-react-reviewer` checklist here.**
> Scan for Critical → High Priority → Architecture/Style issues in that order.
> Reference: `.agents/skills/typescript-react-reviewer/SKILL.md`

---

## Output Format

Structure your review as follows:

```
## Specification
[Summary of what you understood the feature/fix to be; where you got it from]

## Functional Review
[Findings per checklist area; use 🔴 🟡 🟠 🔵 icons]

## Project Invariants
[Any invariant violations or confirmations]

## Technical Review
[TypeScript/React findings from typescript-react-reviewer, Critical first]

## Verdict
[ ] Ready to merge
[ ] Needs changes (list blockers)
[ ] Needs clarification (list open questions)
```

---

## When to Ask vs. When to Proceed

| Situation | Action |
|-----------|--------|
| Spec found, behavior clear | Proceed with full review |
| Spec found, some gaps | Note gaps as 🔵 Clarification, still proceed |
| No spec found, intent guessable from code | Proceed, but state your assumption explicitly and ask for confirmation |
| No spec, intent unclear | Stop and ask (see Step 1) |
