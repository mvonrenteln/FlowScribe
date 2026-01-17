# Merge/Undo Performance Plan

**Status:** Draft
**Owner:** Codex (prepared for Marc)
**Date:** 2026-01-17

## Goal

Reduce merge/undo input latency (INP) from seconds to sub-300ms by targeting the most expensive CPU work triggered by a keydown merge/undo action.

## Evidence Summary

- Chrome trace shows a long `keydown` interaction dominated by main-thread processing (~5.3s).
- React reconciliation and layout are present, but long tasks indicate heavy data processing between keydown and paint.
- The UI uses large transcript lists with derived data recomputed on segment changes (filters, lexicon, spellcheck, confidence).

## Prioritized Ideas (Impact vs. Effort)

1. **Reduce derived-data cost on segment updates (High impact, Low/Medium effort)**
   - `useFiltersAndLexicon` recomputes low-confidence thresholds by sorting all word scores on every segment change.
   - Replace full sorting with a linear-time selection (quickselect) and keep outputs identical.
   - Expected gain: large reduction in CPU time during merge/undo, especially on long transcripts.

2. **Avoid unnecessary normalization work when filters/search are inactive (High impact, Low effort)**
   - Build normalized text and tag maps only when the relevant filters/search are enabled.
   - Expected gain: fewer O(n) allocations on every merge/undo, fewer GC spikes.

3. **Limit expensive spellcheck/lexicon recomputation on small edits (High impact, Medium effort)**
   - Cache results per segment and update only affected segments for merge/undo.
   - Expected gain: avoid re-running lexicon/spellcheck across all segments on small operations.

4. **Render-surface reduction and memoization audits (Medium/High impact, Medium effort)**
   - Keep handler identity stable for `TranscriptSegment` props during merge/undo.
   - Reduce re-renders for non-visible segments (virtualization or tighter windowing).

5. **WaveSurfer processing guardrails (Medium impact, Medium effort)**
   - Ensure merge/undo does not trigger waveform reprocessing (`channelData`) or region rebuilds.
   - Verify no WaveSurfer re-init on store updates unrelated to audio.

## Code-Based Findings (Post-Review)

- `useFiltersAndLexicon` currently sorts all word scores to compute the 10th percentile, which is O(n log n) on every segment change.
- Merge/undo updates `segments` and therefore recomputes filters, lexicon matches, spellcheck matches, and confidence metrics.
- The performance trace indicates long main-thread tasks that are consistent with repeated heavy calculations triggered by `segments` updates.

## Updates After Code Review

- The first implementation should replace the O(n log n) confidence threshold sort with O(n) selection to reduce per-merge cost without changing output.
- This change is low risk, easy to test, and should improve merge/undo latency even before deeper refactors.

## Implementation Update

- Added a linear-time selection helper for the auto confidence threshold and wired it into `useFiltersAndLexicon`.
- Added unit coverage for percentile selection, clamping behavior, and empty-score handling.
- Added a `confidenceScoresVersion` state to avoid recomputing the auto-threshold on merge/split when scores do not change.
- Auto-threshold computation now skips when a manual threshold is set.
- Reused spellcheck results for unchanged segments to avoid full re-processing on merge/undo when word content is stable.
- Skipped normalization work for search/tag filtering when those features are inactive to reduce per-update work.
- Reused lexicon matches for unchanged segments to avoid recomputing similarity scans on merge/undo when word content is stable.
- Avoided WaveSurfer region rebuilds for text-only segment changes when speaker regions are hidden.

## Follow-ups (Higher Effort)

- Move spellcheck processing into a Worker to eliminate main-thread pressure when spellcheck is enabled.
- Evaluate similar per-word caching for lexicon matching to reduce similarity-score scans on large transcripts.

## Execution Order

1. Implement the O(n) confidence threshold selection and add unit tests.
2. Add conditional normalization to skip unused work when search/tag filters are inactive.
3. Introduce incremental lexicon/spellcheck caching.
4. Re-evaluate React render surface and WaveSurfer side effects after steps 1–3.
