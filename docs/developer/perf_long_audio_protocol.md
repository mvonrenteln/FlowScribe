# Long-Audio Performance Investigation — Protocol

Status: in-progress
Date: 2026-01-16

Purpose
-------
This document records raw measurements, console violations, the quick experiments and code changes performed to diagnose perf problems with ~2h audio files (~1000-1500 segments). It is written for developers and is intended to be an auditable, sequential protocol for reproducible A/B tests.

Environment
-----------
- App: FlowScribe (React + TypeScript + Vite)
- Branch: logging
- Date of run: 2026-01-16
- Test machine: user's local macOS environment (recorded by user)
- Instrumentation: `perfMonitor` (client/src/lib/perfMonitor.ts), browser Chrome Performance + React DevTools

What we changed (quick summary)
--------------------------------
- DEV-only persistence toggle added to subscription in `client/src/lib/store.ts`. Use `window.__DEV_DISABLE_PERSISTENCE = true` in the browser to disable persistence during tests.
- Throttle/guard introduced for scroll/visibility checks in `client/src/components/transcript-editor/useScrollAndSelection.ts` to avoid DOM queries at 60Hz (throttled to ~4Hz during playback).

Files changed (quick links)
- [client/src/lib/store.ts](client/src/lib/store.ts)
- [client/src/components/transcript-editor/useScrollAndSelection.ts](client/src/components/transcript-editor/useScrollAndSelection.ts)

Raw measurement snapshots
-------------------------

1) Baseline (user-supplied) — with persistence disabled (`window.__DEV_DISABLE_PERSISTENCE = true`), before scroll-throttle patch

Perf Summary
============
Total events (after filter): 1517
Unique event types: 8

Top event types by count:
- segment-render: count=1389
- playback-update: count=30 avg=2.42ms max=4.10ms
- scroll-effect-start: count=20
- scroll-effect: count=20 avg=2.27ms max=5.70ms
- scroll-effect-end: count=20
- seek-start: count=15
- store-subscription-bulk: count=14
- seek-complete: count=9

Top slow events overall:
```
scroll-effect 5.70ms {"segmentId":"seg-1085","behavior":"auto"}
scroll-effect 4.80ms {"segmentId":"seg-845","behavior":"auto"}
scroll-effect 4.30ms {"segmentId":"seg-1068","behavior":"smooth"}
playback-update 4.10ms {"time":2101.587078}
... (truncated)
```

Console Violations (selected):
```
[Violation] 'message' handler took <N>ms
[Violation] 'seeking' handler took <N>ms
chunk-UZOKQUDP.js?v=3e69bafe:18625 [Violation] 'click' handler took 2100ms
[Violation] Forced reflow while executing JavaScript took <N>ms
wavesurfer__js.js?v=3e69bafe:325 [Violation] 'scroll' handler took 283ms
... (truncated)
```

Conclusion from baseline
- Disabling persistence alone did not eliminate the performance problems. The `segment-render` count is very high, confirming excessive React work / DOM updates.
- Scroll-related work is a notable cost (many `scroll-effect` events, some up to 5.7ms), and Wavesurfer scroll handlers reported heavy costs too.
- Console violations show very long event handlers (seeking/click/rAF/timeupdate) — these are symptomatic of large synchronous work on main thread caused by many renders and layout/paint operations.

2) Follow-up measurement (user-supplied) — after DEV-only persistence disable, but before scroll-throttle patch (user ran another measurement)

Perf Summary
============
Total events (after filter): 3101
Unique event types: 9

Top event types by count:
- segment-render: count=2778
- playback-update: count=64 avg=2.23ms max=4.10ms
- scroll-effect-start: count=53
- scroll-effect: count=53 avg=2.08ms max=5.70ms
- scroll-effect-end: count=53
- seek-start: count=44
- store-subscription-bulk: count=28
- seek-complete: count=23
- seek-requested: count=5

Top slow events overall (excerpt):
```
scroll-effect 5.70ms {"segmentId":"seg-1085","behavior":"auto"}
scroll-effect 4.80ms {"segmentId":"seg-845","behavior":"auto"}
scroll-effect 4.30ms {"segmentId":"seg-1068","behavior":"smooth"}
playback-update 4.10ms {"time":2101.587078}
... (truncated)
```

Console Violations (selected):
```
chunk-UZOKQUDP.js?v=3e69bafe:377 [Violation] 'message' handler took 945ms
chunk-UZOKQUDP.js?v=3e69bafe:377 [Violation] 'message' handler took 1074ms
chunk-UZOKQUDP.js?v=3e69bafe:377 [Violation] 'message' handler took 1165ms
chunk-UZOKQUDP.js?v=3e69bafe:18625 [Violation] 'seeking' handler took 942ms
chunk-UZOKQUDP.js?v=3e69bafe:18625 [Violation] 'seeking' handler took 918ms
... (truncated)
```

Conclusion from follow-up
- The `segment-render` count rose substantially in this run, reinforcing that many segments are constantly being considered for render and that the UI is under heavy React reconciliation pressure.
- Scroll effects increased in count and remain an important contributor to total CPU time.
- Message/seeking handlers occasionally run for hundreds to thousands of milliseconds — we should identify which message handlers (postMessage, worker messages, or other central dispatch) are responsible.

Actions taken (so far)
----------------------
1. DEV persistence toggle: added early-return guard in `client/src/lib/store.ts`. This allows quick A/B testing by setting `window.__DEV_DISABLE_PERSISTENCE = true` in the dev console.
2. Scroll/visibility throttle: added a 250ms throttle to reduce DOM queries during playback in `client/src/components/transcript-editor/useScrollAndSelection.ts`. This change reduces visibility-checks from ~60Hz to ~4Hz while playing.

Planned quick A/B tests (next)
------------------------------
- Disable WaveSurfer Regions (DEV-only toggle) to measure DOM/paint impact. File of interest: `client/src/components/WaveformPlayer.tsx`.
- Smoke-test transcript rendering by limiting to first N segments (e.g., `filteredSegments.slice(0,50)` in the transcript list) to confirm rendering is the dominant factor.
- Throttle `updatePlaybackTime` store writes to ~10Hz to reduce subscription and selector churn.
- Identify heavy `message` / `seeking` handlers by adding perf marks and console traces near suspected dispatchers (e.g. WaveSurfer events, central event bus).

How to reproduce / run the next measurement
------------------------------------------
1. Open dev build locally
2. In the browser console set (optional):
```
window.__DEV_DISABLE_PERSISTENCE = true
```
3. (When I add region toggle) optionally set:
```
window.__DEV_DISABLE_REGIONS = true
```
4. Run test scenarios: Seek click, 10s playback, click UI while playback
5. Export `perfMonitor` JSON and Chrome Performance trace; send new `perf.json`

Notes and provenance
--------------------
- This protocol is intended to be append-only for the duration of the investigation. New measurement results and console logs will be appended with timestamped entries.
- Documentation files in this repo are English by project policy. Short, local developer notes may be kept in German separately if desired.

Next steps for me
-----------------
- Create a DEV-only patch to disable Regions or render-slice test (you pick which). I will implement the change, add an easy browser toggle if appropriate, and update this protocol with the measurement results once you provide the new `perf.json`.
- Add quick perf marks to likely message/seek handlers if console shows repeated long durations and we need to pinpoint the source.

3) Measurement with Scroll-Throttle active (user-supplied)

Perf Summary
============
Total events (after filter): 1594
Unique event types: 9

Top event types by count:
- segment-render: count=1389
- seek-start: count=36
- scroll-effect-start: count=33
- scroll-effect: count=33 avg=2.12ms max=8.80ms
- scroll-effect-end: count=33
- playback-update: count=32 avg=1.95ms max=3.40ms
- seek-complete: count=21
- store-subscription-bulk: count=14
- seek-requested: count=3

Top slow events overall (excerpt):
```
scroll-effect 8.80ms {"segmentId":"seg-1002","behavior":"auto"}
scroll-effect 7.50ms {"segmentId":"seg-999","behavior":"auto"}
scroll-effect 5.90ms {"segmentId":"seg-998","behavior":"auto"}
scroll-effect 5.60ms {"segmentId":"seg-999","behavior":"auto"}
playback-update 3.40ms {"time":4702.523521}
... (truncated)
```

Console Violations observed (selected, during wave-loading and interaction):
```
[Violation] 'message' handler took 4273ms
[Violation] 'message' handler took 4513ms
[Violation] 'message' handler took 1147ms
[Violation] Forced reflow while executing JavaScript took 885ms
[Violation] 'seeking' handler took 2181ms
[Violation] 'click' handler took 2291ms
[Violation] Handling of 'wheel' input event was delayed for 2133 ms due to main thread being busy
... (truncated)
```

Updated interpretation
----------------------
- The scroll-throttle reduced the frequency of visibility DOM-queries but did not eliminate heavy work. `scroll-effect` latency still peaks (up to 8.8ms) — likely because `scrollIntoView` and reflows still occur for certain segments.
- `segment-render` remains the dominant event (1389 counts) — rendering many transcript rows is still primary driver.
- New high-latency `message` handler entries (4.2s–4.5s) during wave-loading strongly indicate expensive synchronous work in message callbacks (e.g., large JSON parsing, synchronous state updates, or heavy message dispatch loops). We must instrument message handlers to find the origin.
- The long `seeking`, `requestAnimationFrame`, `timeupdate`, and click handlers (1.8–2.3s) show that main-thread long tasks persist and block user input. These are likely downstream effects of large renders or heavy DOM operations triggered by those events.

Immediate actionable hypotheses
------------------------------
1. WaveSurfer Regions creation and per-frame updates still cause large layout/paint work for many segments — disabling Regions should reduce Forced Reflow and click latencies.
2. Message handler long tasks point to either large synchronous parsing (e.g., `JSON.parse`/`stringify`) or heavy worker<->main message handlers. Add perf marks to message handlers that listen on `window` or `worker` to identify hotspots.
3. `segment-render` high count indicates missing virtualization / unstable memoization. A smoke-test rendering only the first 50 segments should immediately show impact and confirm rendering is the dominant factor.

Planned quick experiments (order)
--------------------------------
1. DEV toggle: disable WaveSurfer Regions (avoid adding 1500 DOM nodes). Measure.
2. DEV toggle: slice transcript rendering to `filteredSegments.slice(0,50)` and measure. If this shows big improvement, plan virtualization.
3. Instrument message handlers and WaveSurfer event handlers with `perfMonitor.mark` to identify slow callbacks.

Outstanding todos (repo state)
-----------------------------
- Disable WaveSurfer Regions: planned (DEV toggle) — next immediate change to implement.
- Throttle Playback Updates: planned.
- Stabilize Handlers / Memoization: in progress (we already made defensive changes to handler cache; further memoization required).
- Run Targeted Profiling After Each Change: pending — perform after next experiments and append results.

Next step for me
----------------
I will add a DEV-only toggle to `client/src/components/WaveformPlayer.tsx` to skip adding Regions and re-run measurements when you confirm it's okay. This is low-risk and reversible. After you run the test, send the new `perf.json` and console logs and I'll analyze deltas.

5) Latest measurement (user-supplied) — DEV slice enabled, Regions disabled, persistence re-enabled

Perf Summary
============
Total events (after filter): 1176
Unique event types: 9

Top event types by count:
- segment-render: count=469
- playback-update: count=427 avg=0.12ms max=0.30ms
- seek-start: count=67
- scroll-effect-start: count=52
- scroll-effect: count=52 avg=0.10ms max=0.60ms
- scroll-effect-end: count=52
- seek-complete: count=44
- store-subscription-bulk: count=12
- seek-requested: count=1

Top slow events overall:
scroll-effect 0.60ms {"segmentId":"seg-946","behavior":"smooth"}
playback-update 0.30ms {"time":4781.431164}
scroll-effect 0.30ms {"segmentId":"seg-1141","behavior":"auto"}
playback-update 0.30ms {"time":5033.3}
playback-update 0.30ms {"time":4634.80171}
playback-update 0.30ms {"time":4748.885958}
playback-update 0.30ms {"time":4778.653565}
playback-update 0.20ms {"time":2364.057925}
scroll-effect 0.20ms {"segmentId":"seg-476","behavior":"auto"}
playback-update 0.20ms {"time":2300.4013409379545}
playback-update 0.20ms {"time":2434.172423}
playback-update 0.20ms {"time":2304.618754}
playback-update 0.20ms {"time":2326.496586605588}
scroll-effect 0.20ms {"segmentId":"seg-945","behavior":"smooth"}
playback-update 0.20ms {"time":4632.338512}
playback-update 0.20ms {"time":4632.927735}
playback-update 0.20ms {"time":4632.969316}
playback-update 0.20ms {"time":4633.434422}
playback-update 0.20ms {"time":4633.546093}
playback-update 0.20ms {"time":4633.589209}

Console Violations (selected):
```
[Violation] 'seeking' handler took 165ms
wavesurfer__js.js?v=3e69bafe:325 [Violation] 'scroll' handler took 197ms
wavesurfer__js.js?v=3e69bafe:325 [Violation] 'scroll' handler took 193ms
22[Violation] 'requestAnimationFrame' handler took <N>ms
chunk-UZOKQUDP.js?v=3e69bafe:18625 [Violation] 'requestAnimationFrame' handler took 58ms
chunk-UZOKQUDP.js?v=3e69bafe:18625 [Violation] 'requestAnimationFrame' handler took 61ms
chunk-UZOKQUDP.js?v=3e69bafe:18625 [Violation] 'requestAnimationFrame' handler took 78ms
... (truncated)
```

Interpretation
--------------
- Re-enabling persistence while keeping DEV slice + regions-disable active does *not* materially regress the perf gains: `segment-render` dropped to ~469 (previously ~1.2k), indicating the slice test is highly effective in reducing React work.
- `scroll-effect` timings are reduced and playback updates are inexpensive.
- Wavesurfer still reports some `scroll`/`seeking` handler durations, but these are much smaller than earlier multi-second violations.

What the three DEV flags change (summary)
----------------------------------------
- `window.__DEV_SLICE_TRANSCRIPT = true` (file: `client/src/components/transcript-editor/TranscriptList.tsx`)
	- Replaces rendering of the entire `filteredSegments` list with a small sliding window (~50 segments) centered on the active/selected/last segment. This reduces the number of rendered `TranscriptSegment` components and thus React reconciliation work and DOM updates.

- `window.__DEV_DISABLE_REGIONS = true` (file: `client/src/components/WaveformPlayer.tsx`)
	- Skips creating/registering the `RegionsPlugin` instance and avoids creating per-segment region DOM nodes. This reduces DOM node count and layout/paint pressure caused by many region elements overlaying the waveform.

- `window.__DEV_DISABLE_PERSISTENCE = true` (file: `client/src/lib/store.ts`)
	- Temporarily disables the store persistence call-path that serializes and writes parts of the store to disk/localStorage on subscription changes. This can reduce long synchronous tasks caused by serialization and I/O pressure during heavy event bursts.

Can the code be deleted?
-------------------------
- Short answer: Not yet. Rationale:
	- These are DEV-only toggles meant for A/B testing. They are small, reversible changes that let us quantify impact without shipping behavior changes to users.
	- Your measurement shows the major perf improvement comes from reducing rendered segments (slice) — but that was a smoke-test. The intended permanent solution is either virtualization (render only visible rows) or stable memoization of all `TranscriptSegment` handlers — both are larger, well-tested changes.
	- `__DEV_DISABLE_REGIONS` showed measurable benefits; however Regions may be a product-visible feature that users expect. We should not delete it but instead consider optimizing region creation (e.g., batch DOM updates, use canvas overlay, or only create regions for visible window) before removing code.
	- `__DEV_DISABLE_PERSISTENCE` was useful to confirm persistence cost — if persistence is safe to re-enable (and you re-enabled it without perf regression), it likely isn't the main culprit and the DEV flag can be removed after documenting the test. But keep the code around short-term until we finalize other optimizations and have regression tests.

Recommended finalization steps
------------------------------
1. Keep DEV flags in place for now (they're behind `import.meta.env.DEV`) so the team can re-run experiments easily.
2. Replace the DEV-slice smoke-test with a proper virtualization plan (react-window) or implement selective rendering of visible segments. This will be the production fix for the `segment-render` problem.
3. Optimize Regions creation (batching, canvas rendering, or only create for visible segments) if we need to keep regions live for users.
4. Remove the persistence-disable guard only after confirming that re-enabling persistence in CI/dev doesn't re-introduce regressions.

Append to protocol and keep iterating.

4) Measurement with Regions disabled + persistence disabled (user-supplied)

Perf Summary
============
Total events (after filter): 1603
Unique event types: 7

Top event types by count:
- segment-render: count=1389
- seek-start: count=49
- scroll-effect-start: count=37
- scroll-effect: count=37 avg=1.57ms max=3.60ms
- scroll-effect-end: count=37
- playback-update: count=33 avg=2.48ms max=3.50ms
- seek-complete: count=21

Top slow events overall (excerpt):
```
scroll-effect 3.60ms {"segmentId":"seg-747","behavior":"auto"}
playback-update 3.50ms {"time":3485.150702}
playback-update 3.30ms {"time":2461.82014}
... (truncated)
```

Console Violations (selected):
```
[Violation] 'scroll' handler took 263ms
wavesurfer__js.js?v=3e69bafe:325 [Violation] 'scroll' handler took 199ms
wavesurfer__js.js?v=3e69bafe:325 [Violation] 'scroll' handler took 394ms
chunk-UZOKQUDP.js?v=3e69bafe:18625 [Violation] 'click' handler took 2056ms
chunk-UZOKQUDP.js?v=3e69bafe:18625 [Violation] 'click' handler took 1909ms
[Violation] 'requestAnimationFrame' handler took ~1s (many)
... (truncated)
```

Observations & interpretation
-----------------------------
- Regions-disable reduced `scroll-effect` peaks (max down from 8.8ms to 3.6ms) and improved minimap click latency subjectively. This suggests Regions were contributing significantly to layout/paint costs, especially on minimap interactions.
- However, `segment-render` counts remain unchanged (1389) and click handlers still show long (>1.8s) latencies. This indicates the main remaining bottleneck is React reconciliation and DOM updates (rendering/transcript handling) rather than region DOM nodes alone.
- Wavesurfer internal `scroll` handlers still show non-trivial times (199–394ms), which indicates WaveSurfer's own event handlers may be doing work that interacts with our app (e.g., firing `timeupdate`/`seeking` events that trigger app logic).

Hypotheses validated so far
--------------------------
1. Regions contribute to layout/paint overhead and disabling them yields measurable improvement (confirmed).
2. The dominant remaining source is React rendering and expensive event handlers triggered by seeks/clicks/timeupdate (confirmed by unchanged `segment-render` counts and long click/rAF handlers).

Recommended next experiments (fast, A/B)
--------------------------------------
1. Smoke-test: limit transcript rendering to `filteredSegments.slice(0,50)` (DEV-only) — expected: large drop in `segment-render` counts and click/rAF latencies. If positive, plan virtualization.
2. Instrument WaveSurfer event/message handlers (e.g., `ws.on('seeking')`, `ws.on('interaction')`, any `postMessage` listeners) with `perfMonitor.mark` to localize the 4s+ `message` handler work.
3. Throttle `updatePlaybackTime` store writes to ~10Hz (DEV-only) to reduce selector/churn pressure.

Suggested order: run slice smoke-test first (fast to implement) to confirm rendering is the dominant cost; then instrument message handlers if long `message` tasks persist; then throttle playback updates.

Repro steps (to validate improvements)
-------------------------------------
1. Ensure DEV flags set in console: `window.__DEV_DISABLE_PERSISTENCE = true` and `window.__DEV_DISABLE_REGIONS = true`.
2. Full page reload.
3. Scenario A: Click waveform seek; measure perceived latency and collect `perfMonitor` output.
4. Scenario B: Start playback for 10s; collect timeline and console violations.
5. Attach `perf.json` and console logs here.


Appendix — raw console violations
--------------------------------
(Full list as provided by user, kept verbatim for forensic purposes)

```
5[Violation] 'message' handler took <N>ms
chunk-UZOKQUDP.js?v=3e69bafe:377 [Violation] 'message' handler took 945ms
chunk-UZOKQUDP.js?v=3e69bafe:377 [Violation] 'message' handler took 1074ms
chunk-UZOKQUDP.js?v=3e69bafe:377 [Violation] 'message' handler took 1165ms
chunk-UZOKQUDP.js?v=3e69bafe:377 [Violation] 'message' handler took 888ms
chunk-UZOKQUDP.js?v=3e69bafe:377 [Violation] 'message' handler took 926ms
10[Violation] 'seeking' handler took <N>ms
chunk-UZOKQUDP.js?v=3e69bafe:18625 [Violation] 'seeking' handler took 942ms
chunk-UZOKQUDP.js?v=3e69bafe:18625 [Violation] 'seeking' handler took 918ms
chunk-UZOKQUDP.js?v=3e69bafe:18625 [Violation] 'seeking' handler took 1896ms
chunk-UZOKQUDP.js?v=3e69bafe:18625 [Violation] 'seeking' handler took 1760ms
chunk-UZOKQUDP.js?v=3e69bafe:18625 [Violation] 'seeking' handler took 1814ms
chunk-UZOKQUDP.js?v=3e69bafe:18625 [Violation] 'seeking' handler took 1782ms
chunk-UZOKQUDP.js?v=3e69bafe:18625 [Violation] 'seeking' handler took 2018ms
chunk-UZOKQUDP.js?v=3e69bafe:18625 [Violation] 'seeking' handler took 914ms
chunk-UZOKQUDP.js?v=3e69bafe:18625 [Violation] 'seeking' handler took 1890ms
chunk-UZOKQUDP.js?v=3e69bafe:18625 [Violation] 'seeking' handler took 1835ms
chunk-UZOKQUDP.js?v=3e69bafe:18625 [Violation] 'click' handler took 1887ms
chunk-UZOKQUDP.js?v=3e69bafe:18625 [Violation] 'keydown' handler took 981ms
21[Violation] 'requestAnimationFrame' handler took <N>ms
chunk-UZOKQUDP.js?v=3e69bafe:18625 [Violation] 'requestAnimationFrame' handler took 2073ms
chunk-UZOKQUDP.js?v=3e69bafe:18625 [Violation] 'requestAnimationFrame' handler took 1017ms
chunk-UZOKQUDP.js?v=3e69bafe:18625 [Violation] 'requestAnimationFrame' handler took 2185ms
chunk-UZOKQUDP.js?v=3e69bafe:18625 [Violation] 'requestAnimationFrame' handler took 895ms
chunk-UZOKQUDP.js?v=3e69bafe:18625 [Violation] 'requestAnimationFrame' handler took 902ms
chunk-UZOKQUDP.js?v=3e69bafe:18625 [Violation] 'requestAnimationFrame' handler took 1818ms
chunk-UZOKQUDP.js?v=3e69bafe:18625 [Violation] 'requestAnimationFrame' handler took 907ms
chunk-UZOKQUDP.js?v=3e69bafe:18625 [Violation] 'requestAnimationFrame' handler took 1853ms
chunk-UZOKQUDP.js?v=3e69bafe:18625 [Violation] 'requestAnimationFrame' handler took 1822ms
chunk-UZOKQUDP.js?v=3e69bafe:18625 [Violation] 'requestAnimationFrame' handler took 2045ms
chunk-UZOKQUDP.js?v=3e69bafe:18625 [Violation] 'requestAnimationFrame' handler took 905ms
chunk-UZOKQUDP.js?v=3e69bafe:18625 [Violation] 'requestAnimationFrame' handler took 872ms
chunk-UZOKQUDP.js?v=3e69bafe:18625 [Violation] 'requestAnimationFrame' handler took 857ms
chunk-UZOKQUDP.js?v=3e69bafe:18625 [Violation] 'requestAnimationFrame' handler took 883ms
chunk-UZOKQUDP.js?v=3e69bafe:18625 [Violation] 'requestAnimationFrame' handler took 892ms
chunk-UZOKQUDP.js?v=3e69bafe:18625 [Violation] 'requestAnimationFrame' handler took 1868ms
chunk-UZOKQUDP.js?v=3e69bafe:18625 [Violation] 'requestAnimationFrame' handler took 911ms
chunk-UZOKQUDP.js?v=3e69bafe:18625 [Violation] 'requestAnimationFrame' handler took 897ms
chunk-UZOKQUDP.js?v=3e69bafe:18625 [Violation] 'requestAnimationFrame' handler took 1800ms
chunk-UZOKQUDP.js?v=3e69bafe:18625 [Violation] 'requestAnimationFrame' handler took 1823ms
chunk-UZOKQUDP.js?v=3e69bafe:18625 [Violation] 'requestAnimationFrame' handler took 917ms
chunk-UZOKQUDP.js?v=3e69bafe:18625 [Violation] 'requestAnimationFrame' handler took 905ms
chunk-UZOKQUDP.js?v=3e69bafe:18625 [Violation] 'requestAnimationFrame' handler took 897ms
chunk-UZOKQUDP.js?v=3e69bafe:18625 [Violation] 'requestAnimationFrame' handler took 1818ms
chunk-UZOKQUDP.js?v=3e69bafe:18625 [Violation] 'timeupdate' handler took 2083ms
chunk-UZOKQUDP.js?v=3e69bafe:18625 [Violation] 'keydown' handler took 1194ms
chunk-UZOKQUDP.js?v=3e69bafe:18625 [Violation] 'click' handler took 1976ms
```
