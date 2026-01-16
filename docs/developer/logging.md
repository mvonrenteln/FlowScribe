## Logging (developer guide)

**Location:** `client/src/lib/logging/loggingService.ts`

### Summary

- A general-purpose `Logger` used by services and UI components.
- Default namespace: `AI`. You can override the namespace per logger.

### Import

Recommended import:

```ts
import { createLogger } from "@/lib/logging";
```

### Create and use a logger

```ts
const logger = createLogger({ feature: "MyFeature" });
logger.info("Started");
logger.debug("Details", { count: 3 });
```

### Enable debug logging

- Global (default namespace `AI`):

```ts
import { enableGlobalDebug } from "@/lib/logging";
enableGlobalDebug(); // enables debug for namespace 'AI'
// or for a custom namespace:
enableGlobalDebug("MyNamespace");
```

- Feature-specific:

```ts
import { enableFeatureDebug } from "@/lib/logging";
enableFeatureDebug("MyFeature");
// or with a namespace:
enableFeatureDebug("MyFeature", "MyNamespace");
```

### Other utilities

- `disableGlobalDebug(namespace?)` — disable global debug flag
- `disableFeatureDebug(feature, namespace?)` — disable feature debug flag
- `setGlobalLogLevel(level)` — set global log level (`"debug"|"info"|"warn"|"error"`)
- `getLogLevel()` — access underlying `loglevel` export

### Where to use

- Import from `@/lib/logging` in `client/src/lib/**` (services/utilities)
- Import from `@/lib/logging` in `client/src/components/**` (UI components)

---

## perfMonitor (DEV-only performance tracing)

**Location:** `client/src/lib/logging/perfMonitor.ts`

`perfMonitor` is a lightweight DEV-only tool for marking and measuring short-lived code paths (seek events, scroll effects, filter/render work).

### Import

```ts
import { perfMonitor, mark, measure, time, timeAsync } from "@/lib/logging";
```

### API (examples)

- Mark an event (instant):

```ts
mark("seek-start", { time: 12.3, source: "transcript" });
```

- Measure synchronous block:

```ts
time("render-filter", () => {
  // expensive filter work
}, { segments: segments.length });
```

- Measure asynchronous operation:

```ts
await timeAsync("persist-session", async () => {
  await persistToLocalStorage(payload);
});
```

- Export metrics from browser console:

```js
copy(window.perfMonitor.exportMetrics()); // copies JSON to clipboard
window.perfMonitor.clear(); // clear recorded events
```

Notes:

- `perfMonitor` is only active in DEV builds (`import.meta.env.DEV`).
- Keep marks/measures focused and small to make analysis easier.

---

## Quick Start: Chrome DevTools (no code changes)

This quick guide is intended for junior developers who want to enable logging and capture perfMonitor traces without editing source code.

### 1) Start the DEV server

```bash
npm run dev
# open the URL shown by Vite (e.g. http://localhost:5173)
```

### 2) Open Chrome DevTools

- Open DevTools (`F12` or `Cmd+Option+I`) and select the `Console` tab.

### 3) Enable debug logging (Console)

Set the global/feature flags used by the logger implementation:

```js
// Enable debug for default namespace 'AI'
window.__AIDebugMode = true;

// Or enable debug for a specific feature (replace MyFeature)
window.__AIMyFeatureDebug = true;
```

After setting the flags, reload or perform the action that triggers the component to see `debug` logs.

### 4) Use `perfMonitor` from Console

```js
// Confirm availability
console.log(!!window.perfMonitor);

// Export recorded events (copies JSON to clipboard)
copy(window.perfMonitor.exportMetrics());

// Clear recorded events
window.perfMonitor.clear();
```

### 5) Reproduce scenario and collect data

- Trigger the user actions you want to measure: seek, playback, interactive scroll, or open/close dialogs.
- Export metrics afterward and paste into a file (e.g. `perf.json`) for CLI analysis.

Example CLI analysis:

```bash
cat perf.json | jq '.[] | select(.name=="scroll-effect") | .duration'
```

## analyze-perf CLI (local analysis)

We've included a small Node helper to summarize `perfMonitor` exports and optionally produce CSV or a simple ASCII histogram.

File: `docs/developer/analyze-perf.js`

Usage examples:

- Basic summary

```bash
npm run analyze-perf -- perf.json
```

- Write CSV summary of event counts/averages

```bash
npm run analyze-perf -- perf.json --csv out.csv
```

- Filter to a single event name and show histogram of durations (10 buckets)

```bash
npm run analyze-perf -- perf.json --event scroll-effect --histogram --buckets 12
```

- Show top 50 events by count

```bash
npm run analyze-perf -- perf.json --top 50
```

Notes:
- The script reads a JSON array exported from `window.perfMonitor.exportMetrics()`.
- If you used `copy(window.perfMonitor.exportMetrics())` in Chrome, paste the clipboard into a file named `perf.json` in your project root.
- On macOS you can paste from clipboard into a file with:

```bash
pbpaste > perf.json
```

Example output (abridged):

```
Perf Summary
============
Total events (after filter): 1234
Unique event types: 12

Top event types by count:
- scroll-effect: count=430 avg=5.20ms max=123.45ms
- playback-update: count=320 avg=1.10ms max=9.80ms
...

Top slow events overall:
scroll-effect 123.45ms {"segmentId":"s-123"}
persist-session 98.72ms {}
...

Event kinds: { mark: 600, measure: 580, time: 54 }

Wrote CSV to out.csv

Duration histogram:
0.00 - 12.34 ms | ########## (200)
12.34 - 24.68 ms | ##### (120)
...
```

Advanced: the CSV output contains three columns: `name,count,avg,max`. You can open it in Excel or import into analysis tools.

If you want richer analysis (percentiles, time-series plotting), copy the `perf.json` into your analysis environment and use Python / pandas or a notebook.

### Tips and troubleshooting

- If console logs are missing:
  - Make sure the Console log level is set to `Verbose` (no filters).
  - Some logs are `debug` level and require enabling the debug flag before the code runs.

- If `window.perfMonitor` is undefined:
  - Ensure you are running a DEV server and not a production build.

- If `perfMonitor` shows no events:
  - Verify the code path is instrumented (search for `mark("seek-start")`, `time("playback-update")`, etc.).
  - Reproduce the event while DevTools is open; some events only trigger during user interactions.



