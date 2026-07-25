# Test Coverage Plan

FlowScribe treats shadcn/ui wrappers as infrastructure. They are intentionally excluded from
application coverage because they mostly compose already-tested Radix/shadcn primitives. Coverage
work should focus on product behavior: transcript state, AI orchestration, persistence, import/export,
and settings decisions.

## Current baseline

- Production coverage scope excludes tests, type-only files, demo examples, test utilities, shadcn/ui
  wrappers, and the application entrypoint.
- Current line coverage after the first low-level expansion is about 73%.
- The next useful target is not broad render coverage. The next useful target is extracting decision
  logic from large UI/store modules into small utilities and testing those utilities directly.

## Test strategy

1. Prefer pure utility tests.
   - Target logic that accepts plain objects and returns plain objects.
   - Keep each test file below a few milliseconds where practical.
   - Cover business decisions, not DOM implementation details.

2. Use slice/action tests only when pure extraction would distort the design.
   - Build minimal Zustand state with existing test helpers.
   - Test one user-visible state transition per test.
   - Avoid timers unless the behavior is explicitly timer-based.

3. Use component tests only for small interaction boundaries.
   - Examples: a settings form validation path, a single dialog callback, or a button enabling rule.
   - Do not render the full app or transcript editor to raise coverage.
   - If a behavior requires full UI composition to test, pause and discuss before adding it.

4. Do not add E2E tests for the coverage gate.
   - E2E is valuable for workflow confidence, but it is too slow and broad for this phase.
   - Browser sanity checks remain manual or task-specific.

## Priority backlog

1. Settings logic extraction.
   - Provider form state transitions: done.
   - Remaining candidates: timeout/concurrency/temperature normalization, glossary import/export
     decisions, spellcheck dictionary enablement and validation.

2. AI store slice decision utilities.
   - Extract selection/filtering decisions from speaker analysis startup.
   - Extract merge apply/invalid-suggestion cleanup decisions from segment merge state.
   - Extract revision batch log summarization and repeated-failure stop decisions.

3. AI orchestration edge cases.
   - Test provider response normalization at the lowest layer.
   - Test retry/parse failure classification without rendering panels.
   - Test cancellation/result status mapping with mocked providers.

4. Export and persistence edges.
   - Continue covering serialization, fallback, quota, and browser API behavior with direct tests.
   - Keep IndexedDB/File System Access tests mocked and synchronous where possible.

## Runtime guardrails

- Prefer `npx vitest run <test-file>` while developing.
- Run full `npm test` only after a coherent batch of tests.
- Run coverage serially when collecting final numbers: Vitest workers have been flaky under full V8
  coverage in this repo.
- Avoid snapshot tests as a coverage tactic; they add runtime and review noise without proving behavior.
