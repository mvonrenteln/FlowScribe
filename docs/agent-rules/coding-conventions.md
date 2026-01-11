# Coding Conventions (Decision-Oriented)

This document defines preferred coding decisions for new or modified code.
It complements automated tooling (Biome, TypeScript) and focuses on choices
that affect correctness, performance, and long-term maintainability.

It is NOT a restatement of formatter or linter rules.

---

## 1. General Direction

- Prefer clarity over cleverness.
- Prefer local changes over wide refactors.
- Prefer explicit data flow over implicit coupling.
- Optimize for long transcripts and large datasets, not toy examples.

---

## 2. TypeScript: Modeling > Typing

### Prefer explicit domain types

- Introduce domain-specific types when values carry meaning (e.g. `SegmentId`, `SpeakerId`, `TimeMs`).
- Avoid passing raw `string` / `number` when semantics matter.

### `type` vs `interface`

- Use `type` for:
  - unions
  - aliases
  - value-like data
- Use `interface` only when extension or implementation is expected.

### Avoid structural shortcuts

- Avoid `as` casts to “make things work”.
- If a type is inconvenient, fix the model, not the compiler.

---

## 3. React: Renders Are the Cost Model

### Memoization is a tool, not a default

- Use `memo`, `useMemo`, `useCallback` only when:
  - the component is on a hot render path, OR
  - it is part of a large list / transcript surface.
- Prefer simple components over prematurely memoized ones.

### Handler identity matters

- Do not pass unstable anonymous functions into memoized components.
- If handler stability is required, make it explicit and documented.

### Hooks own behavior, components own layout

- Complex logic belongs in hooks, not JSX.
- Components should read like a layout description, not an algorithm.

---

## 4. State Management (Zustand)

### Select narrowly

- Prefer small, focused selectors over grabbing large state objects.
- Avoid selectors that change identity on every render.

### Keep state normalized

- Store references (ids) rather than duplicated objects.
- Derived data belongs in selectors or utilities, not in the store.

---

## 5. Async, Errors, and Boundaries

### Fail explicitly at boundaries

- Validate inputs at module boundaries (AI responses, imports, parsing).
- Inside a module, assume invariants hold.

### Error handling intent

- Catch errors to:
  - add context
  - normalize behavior
  - trigger recovery
- Do NOT catch errors just to silence them.

---

## 6. Testing: Signal > Coverage

### Test behavior, not implementation

- Prefer tests that describe observable behavior.
- Avoid asserting internal state unless it is the API.

### Pure logic first

- Extract pure logic until it becomes trivial to test.
- Services should have fewer tests, but higher intent.

### Tests as safety rails

- If a change feels risky, add a test before refactoring.
- If a bug existed once, it deserves a test.

---

## 7. Logging & Diagnostics

- Use structured logging for non-trivial flows (AI, parsing, recovery).
- Logs should answer: “what happened?” and “why?”
- Avoid console logging in production paths.

---

## 8. When in Doubt

- Prefer the simplest solution that preserves invariants.
- Prefer consistency with nearby code over global perfection.
- If unsure, make the decision explicit in code or docs.
