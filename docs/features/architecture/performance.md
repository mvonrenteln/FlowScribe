# Merge and Merge-Undo Performance Plan

**Status:** Draft
**Owner:** Codex (prepared for Marc)
**Date:** 2026-01-17

## Overview

This document documents the analysis and remediation plan for slow `merge` operations and their `undo` variant in the Transcript Editor. While the original focus was on undo latency, profiling showed the root causes are shared between the `merge` action and the inverse `undo`. The goal is to reduce input-to-response latency for merge/undo actions from multi-second stalls to sub-300ms on typical long transcripts by eliminating the most expensive main-thread work that runs after a keydown event.

## Motivation

Editors expect immediate feedback for merge/undo actions. On large transcripts, users experienced long pauses (seconds) during merge/undo which block input and degrade usability. This work improves perceived responsiveness and prevents regressions as transcript size grows.

## Problem Statement

Symptoms observed:

- Long `keydown` interaction spans (~5s) in Chrome tracing dominated by main-thread CPU time.
- UI paint and React reconciliation are not the main cost; expensive data work runs between keydown and paint.
- Merge/undo triggers broad recomputation of derived data (filters, lexicon, spellcheck, confidence scores) because `segments` updates are treated as a large change set.

Primary performance drivers:

- O(n log n) computations on global arrays (e.g. sorting word scores for percentile thresholds).
- Full recomputation of per-segment derived results on small edits (no incremental caches).
- Unnecessary normalization and allocation work when related features are inactive.
- Side effects that cause WaveSurfer to rebuild regions or reprocess audio even for text-only changes.
- React re-renders caused by unstable handler identities or wide prop churn across many rows.

## Evidence

- Chrome trace with a ~5.3s `keydown` main-thread task (profiled during merge/undo).
- Code review: `useFiltersAndLexicon` sorts all word scores to compute the auto-threshold (O(n log n)).
- Trace and code patterns align: `segments` updates cause derived data recomputation and heavy CPU tasks.

## Prioritized Remediation Measures (with details)

The following measures are prioritized by impact and implementation effort. Each measure contains actionable substeps and suggested files/areas to change.

1) Replace global sorts with linear-time selection for confidence thresholds (High impact, Low effort)

   - Problem: `useFiltersAndLexicon` sorts all word scores to find the Xth percentile every segment update (O(n log n)).
   - Action: Implement a linear-time selection helper (quickselect or introselect) that returns the percentile value without fully sorting the array.
   - Files: `client/src/lib/*` utility file (e.g. `utils/selection.ts`) and `client/src/hooks/useFiltersAndLexicon.ts` (or wherever auto-threshold is computed).
   - Tests: Unit tests for percentile selection, empty arrays, clamping, and unchanged output compared to previous sort-based implementation.
   - Risk/Notes: Low risk; algorithm preserves exact output semantics if implemented carefully. Easy to test.

2) Conditional normalization and allocation avoidance (High impact, Low effort)

   - Problem: Normalized text/tag maps and other allocation-heavy structures are built on every segment change even when filters/search are inactive.
   - Action: Gate normalization work behind feature flags/active checks. Only populate normalized maps when search or tag filters are enabled.
   - Files: `useFiltersAndLexicon`, search/filter utilities, and code paths that build normalized representations.
   - Tests: Ensure normalization is triggered only when feature flags are on; check no functional regressions in search/filtering.
   - Risk/Notes: Very low risk; conservative gating recommended.

3) Per-segment caching for lexicon and spellcheck results (High impact, Medium effort)

   - Problem: Spellcheck and lexicon similarity scans run across all segments on small merge/undo edits.
   - Action: Cache lexicon/spellcheck results on a per-segment basis and only recompute for segments whose text changed or whose metadata requires re-evaluation.
   - Files: `client/src/lib/spellcheck.ts`, `client/src/lib/lexicon.ts`, `useFiltersAndLexicon` and store code that manages `segments`.
   - Implementation details:
     - Add a content-hash or version per segment (`segment.contentHash` or `spellcheckVersion`) to detect changes.
     - Store per-segment cached results indexed by segment id + version.
     - On merge/undo, update caches only for segments that changed (created, deleted, merged, or had text edits).
   - Tests: Unit tests for cache invalidation and integration tests for merge/undo scenarios.
   - Risk/Notes: Medium effort; ensure memory usage is bounded and caches purge stale entries.

4) Batch and reduce store updates (High impact, Medium effort)

   - Problem: Many synchronous store set operations cause multiple renders and recalculations.
   - Action: Batch segment updates and derived-data invalidations so the store emits a minimal set of change events.
   - Files: `client/src/lib/store/*`, `useFiltersAndLexicon`, and any action creators that perform merge/undo.
   - Implementation details:
     - Introduce a single transaction-like update API for merge/undo that applies all segment changes and then triggers derived recomputations once.
     - Use Zustand's `set` batching or microtask deferral to coalesce updates.
   - Tests: Verify merge/undo still applies correct final state; measure reduced render counts.
   - Risk/Notes: Moderate; avoid introducing inconsistent intermediate states observable by other parts.

5) Stabilize handler identities and reduce React re-renders (Medium/High impact, Medium effort)

   - Problem: Unstable function props and wide prop churn cause many `TranscriptSegment` rows to re-render.
   - Action: Ensure handlers passed to row components are stable (`useCallback` or lift handlers), minimize props that change during merge/undo, and memoize rows aggressively.
   - Files: `client/src/components/TranscriptSegment.tsx`, parent list rendering components, and any hooks that create per-row handlers.
   - Implementation details:
     - Extract stable handlers into parent components or hooks and pass identifiers instead of inline closures.
     - Add `React.memo` with custom props comparison for `TranscriptSegment` rows.
   - Tests: Visual/manual validation for selection/navigation; unit tests where feasible for handler identity.
   - Risk/Notes: Medium; ensure no stale closures remain that capture outdated state.

6) WaveSurfer guardrails: avoid audio work on text-only changes (Medium impact, Medium effort)

   - Problem: WaveSurfer may rebuild regions or reprocess channel data on store updates that do not affect audio, causing heavy CPU work.
   - Action: Add guards that skip WaveSurfer region rebuilds when merge/undo only changes text or speaker names and does not change audio timing/channel data.
   - Files: `client/src/components/WaveformPlayer.tsx`, WaveSurfer initialization and region management code.
   - Implementation details:
     - Add a diff check that inspects changed keys on segments and only triggers WaveSurfer updates for audio-related changes.
     - Ensure cleanup on unmount and guard against zoom/state bleed in initialization effects.
   - Tests: Manual test: merge text-only segments while speaker regions hidden; confirm no waveform reprocess.
   - Risk/Notes: Medium; WaveSurfer initialization is fragile—verify cleanup on unmount.

7) Offload heavy work to Web Workers (Medium/High impact, High effort)

   - Problem: Even with optimizations, spellcheck/lexicon or other scanning may remain CPU-heavy on large transcripts.
   - Action: Move CPU-heavy but non-DOM work (spellcheck scans, lexicon similarity scoring) into a Worker and communicate via structured messages.
   - Files: New worker in `client/src/workers/` and integration points in `spellcheck.ts`/`lexicon.ts`.
   - Implementation details:
     - Define a compact message protocol for job submission and result streaming.
     - Implement cancellable jobs (with job ids) so in-flight work can be aborted on rapid user actions.
   - Tests: Worker unit tests and integration tests verifying correctness and cancellation.
   - Risk/Notes: High implementation effort and complexity; requires careful API design and testing.

8) Instrumentation and automated perf tests (Continuous)

   - Problem: Regressions can reappear without tests or instrumentation.
   - Action: Add microbenchmarks and vitest-based performance checks (or lightweight harness) for merge/undo on synthetic large transcripts.
   - Files: `client/test/` or `client/src/test/perf/`, CI scripts.
   - Implementation details:
     - Create synthetic transcript fixtures (10k words, 2k segments) and measure wall-clock of merge/undo handlers.
     - Fail CI if key performance targets regress beyond an allowed delta.
   - Risk/Notes: Helps maintain long-term stability; keep tests stable and not flaky.

## Implementation Summary (what's been done)

- Implemented a linear-time selection helper for auto confidence threshold and wired it into `useFiltersAndLexicon`.
- Added unit coverage for percentile selection, clamping, and empty-score conditions.
- Introduced `confidenceScoresVersion` to avoid recomputing thresholds when scores don't change.
- Skipped auto-threshold computation when a manual threshold is set.
- Cached and reused spellcheck/lexicon results for unchanged segments during merge/undo.
- Skipped normalization work when search/tag filters are inactive.
- Avoided WaveSurfer region rebuilds for text-only segment changes when speaker regions are hidden.
- Skipped WaveSurfer region rebuilds when segment timing and speaker metadata are unchanged.
- Stabilized merge handler identities to reduce transcript row re-renders during merge/undo.
- Throttled scroll visibility checks during playback to avoid repeated DOM measurements.
- Kept persistence from waking up on every tiny state change by watching only persistence-relevant fields and bucketing playback time updates.
- Moved persistence JSON serialization to a worker so long sessions do not block the main thread during playback or rapid seeking.
