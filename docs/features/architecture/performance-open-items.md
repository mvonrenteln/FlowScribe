# Performance Open Items (Consolidated)

**Status:** Draft  
**Owner:** Team  
**Scope:** Consolidated open items from `performance.md`, `performance-diagnosis-long-audio.md`, and `optimize-performance.md`.

This document is the single source of truth for remaining performance work. It is designed to replace the older documents once accepted.

## Prioritization Criteria

Each item is evaluated and prioritized with the following criteria:

- **Impact:** Expected performance improvement (High / Medium / Low).
- **Effort:** Implementation complexity and time (Small / Medium / Large).
- **Risk:** Regression or architectural risk (Low / Medium / High).
- **Priority:** P0 (highest) to P3 (lowest), based on Impact vs Effort and adjusted for Risk.

## Open Items (Prioritized)

### P0 — Must address first

1) Introduce virtualized transcript list rendering (Phase 1)  
**Impact:** High | **Effort:** Medium | **Risk:** Medium  
**Description:** Replace the non-virtualized transcript list with a virtualization-based scroller to shrink DOM size and render cost. This is focused on rendering performance only; scroll/selection behavior can be temporarily degraded but must remain stable.

2) Replace DOM-based scroll targeting with virtualized scroll control (Phase 2)  
**Impact:** High | **Effort:** Medium | **Risk:** Medium  
**Description:** Introduce a scroll controller that scrolls by index instead of querying DOM nodes. Use virtualization range callbacks for visibility and remove `scrollIntoView` from the sync path to restore reliable follow-playback and seek navigation.

### P1 — High value, next in line

3) Batch store updates for merge/undo actions  
**Impact:** High | **Effort:** Medium-Large | **Risk:** Medium  
**Description:** Apply a single transactional update for merge/undo so derived computations and renders happen once. This reduces multiple sync renders and avoids repeated recalculation cascades.

### P2 — Important, but can follow the above

4) Optimize filtered segment computation  
**Impact:** Medium | **Effort:** Small-Medium | **Risk:** Low  
**Description:** Reduce re-computation frequency and cost for filtering logic. This includes stabilizing dependencies, memoization boundaries, and incremental filtering where possible.

5) Stabilize handler identities and memoize transcript rows  
**Impact:** Medium | **Effort:** Medium | **Risk:** Medium  
**Description:** Ensure per-row props remain stable so list items do not re-render unnecessarily. This reduces reconciliation work during selection, playback, and merge/undo flows.

6) Replace layout thrash with observer-based visibility  
**Impact:** Medium | **Effort:** Medium | **Risk:** Low  
**Description:** Use `IntersectionObserver` / `ResizeObserver` instead of repeated `getBoundingClientRect` and `scrollIntoView` checks. This reduces forced reflows and long tasks.

7) Define UX policy when target segment is filtered out  
**Impact:** Medium | **Effort:** Small-Medium | **Risk:** Low  
**Description:** Provide a consistent user-facing outcome for navigation to hidden segments (e.g., toast or optional filter reset). This prevents “no-op” navigation in virtualized flows.

8) ID hygiene for split/merge/delete  
**Impact:** Medium | **Effort:** Medium | **Risk:** Medium  
**Description:** Ensure selection and navigation never point at deleted or replaced IDs. After structural edits, resolve selection to a valid neighboring segment and trigger scroll reliably.

9) Word-level rendering efficiency  
**Impact:** Medium | **Effort:** Small-Medium | **Risk:** Low  
**Description:** Ensure only the active segment updates during playback and reduce per-frame word index search cost. This is a targeted micro-optimization for long segments.

### P3 — Longer-term or diagnostic work

10) Workerize spellcheck and lexicon processing  
**Impact:** Medium-High | **Effort:** Large | **Risk:** High  
**Description:** Move heavy lexicon/spellcheck computation off the main thread. Requires messaging, cancellation, and cache invalidation strategy.

11) Evaluate per-word lexicon caching strategy  
**Impact:** Medium | **Effort:** Medium | **Risk:** Medium  
**Description:** Introduce fine-grained caching for lexicon similarity scans to reduce repeated work. Must remain bounded in memory and accurate after edits.

12) Performance instrumentation and profiling harness  
**Impact:** Medium | **Effort:** Medium | **Risk:** Low  
**Description:** Add a dev-only performance monitor, render counters, and a repeatable profiling checklist to validate improvements and locate regressions.

13) Automated performance tests in CI  
**Impact:** Medium | **Effort:** Medium | **Risk:** Medium  
**Description:** Add synthetic fixtures and timing checks to detect regressions in merge/undo and playback navigation. Keep thresholds stable and avoid flakiness.

14) Post-deploy monitoring and dashboards  
**Impact:** Medium | **Effort:** Medium | **Risk:** Low  
**Description:** Track interaction latency (e.g., INP) for merge/undo, seek, and playback in production and alert on regressions.

15) Enable sourcemaps for profiling analysis  
**Impact:** Low | **Effort:** Small | **Risk:** Low  
**Description:** Enable sourcemaps in builds when deeper profiling is needed to map bundles back to sources.

16) Batch DOM writes and reduce inline style churn  
**Impact:** Medium | **Effort:** Medium | **Risk:** Low  
**Description:** Group DOM writes and prefer CSS class toggles over inline style updates to avoid layout thrash during waveform or transcript updates.

## Notes

- Priority ordering assumes current pain points: seek latency, playback input lag, and long-audio jank.
- Items 2 and 3 should be treated as a single program, with Phase 1 focused on render performance and Phase 2 restoring scroll correctness.
- Items 1, 4, and 5 are likely to yield the fastest responsiveness gains across the app.
