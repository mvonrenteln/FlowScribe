# Player-Transcript Synchronization Architecture

## Overview

This document describes the architectural relationship between the WaveformPlayer (audio) and the TranscriptEditor (text), focusing on state synchronization, seek operations, and common pitfalls.

## Core Components

### State Flow Diagram

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│                              Zustand Store                                  │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐ │
│  │ currentTime  │  │selectedSegmentId│ │ seekRequest │  │    isPlaying    │ │
│  └──────────────┘  └──────────────┘  └──────────────┘  └──────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
         ▲                   ▲                  │                   │
         │                   │                  │                   │
         │                   │                  ▼                   ▼
┌────────┴────────┐  ┌───────┴───────┐  ┌──────────────┐  ┌──────────────────┐
│ WaveformPlayer  │  │TranscriptEditor│ │ WaveformPlayer│ │  WaveformPlayer  │
│ (timeupdate)    │  │ (selection)   │  │ (seek)       │  │  (play/pause)    │
└─────────────────┘  └───────────────┘  └──────────────┘  └──────────────────┘
```

### Key Principles

1. **WaveformPlayer is the source of truth for `currentTime`**
   - The waveform player emits `timeupdate` events during playback
   - These events update `currentTime` in the store
   - The transcript reacts to `currentTime` changes to highlight active segments/words

2. **Transcript operations use `seekToTime` for navigation**
   - When user clicks a segment or uses arrow keys
   - `seekToTime` does TWO things synchronously:
     1. `setCurrentTime(time)` - updates the store immediately
     2. `requestSeek(time)` - tells the waveform to seek

3. **`activeSegment` is derived from `currentTime`**
   - Calculated via `useMemo` based on which segment contains `currentTime`
   - Used for word highlighting during playback

4. **Selection sync happens automatically via useEffect**
   - When `activeSegment` changes (due to time changes)
   - And `activeSegment.id !== selectedSegmentId`
   - The selection is updated to match the active segment

## The Seek Architecture

### Types of Seek Operations

| Operation        | Trigger                      | Method                           | Updates currentTime?            |
| ---------------- | ---------------------------- | -------------------------------- | ------------------------------- |
| Arrow navigation | User presses Up/Down         | `selectPrevious/NextSegment()`   | Yes (via `seekToTime`)          |
| Segment click    | User clicks segment          | `onSelect()` handler             | Yes (via `seekToTime`)          |
| Waveform click   | User clicks waveform         | `handleWaveformSeek()`           | Yes (via `setCurrentTime`)      |
| Skip buttons     | User clicks J/L or buttons   | `handleSkipBack/Forward()`       | Yes (via `requestSeek` only*)   |
| Playback         | Audio plays                  | `timeupdate` event               | Yes (via `setCurrentTime`)      |

*Skip operations use `requestSeek` only because the waveform will update `currentTime` via its event.

### Why `seekToTime` Uses Both `setCurrentTime` AND `requestSeek`

This is the critical insight that prevents race conditions:

```typescript
const seekToTime = useCallback(
  (time: number) => {
    setCurrentTime(time);   // Update store immediately (sync)
    requestSeek(time);      // Tell waveform to seek (async)
  },
  [requestSeek, setCurrentTime],
);
```

**Without `setCurrentTime`:**

1. User presses ArrowDown
2. `setSelectedSegmentId("segment-2")` is called
3. `requestSeek(segment2.start)` is called (async, waveform will seek)
4. But `currentTime` is still at segment-1's position
5. `activeSegment` still points to segment-1
6. The sync useEffect sees `activeSegment.id !== selectedSegmentId`
7. It "corrects" the selection back to segment-1! ❌

**With `setCurrentTime`:**

1. User presses ArrowDown
2. `setSelectedSegmentId("segment-2")` is called
3. `setCurrentTime(segment2.start)` is called (sync, immediate)
4. `activeSegment` now points to segment-2
5. The sync useEffect sees `activeSegment.id === selectedSegmentId`
6. No correction needed, selection stays at segment-2! ✅

## The Selection Sync Effect

Located in `useScrollAndSelection.ts`:

```typescript
useEffect(() => {
  if (isTranscriptEditing()) return;
  if (!activeSegment || !isActiveSegmentVisible) return;

  if (activeSegment.id !== selectedSegmentId) {
    setSelectedSegmentId(activeSegment.id);
  }
}, [
  activeSegment,
  isActiveSegmentVisible,
  isTranscriptEditing,
  selectedSegmentId,
  setSelectedSegmentId,
]);
```

### Purpose

- During playback: keeps selection in sync with the current playback position
- After seeks: ensures selection matches where we sought to
- With filters: updates selection when the active segment becomes visible/invisible

### Why No `isPlaying` Check?

The effect runs regardless of playback state because:

1. **During playback**: Time changes → activeSegment changes → selection follows
2. **After seeks**: `seekToTime` updates time AND selection together, so the effect finds them already in sync
3. **With waveform clicks**: `handleWaveformSeek` updates time, effect updates selection

The key is that transcript-initiated seeks (arrow keys, segment clicks) use `seekToTime` which updates BOTH time and selection synchronously, preventing the effect from "fighting" the selection.

## Common Pitfalls

### Pitfall 1: Using Only `requestSeek` for Navigation

**Wrong:**

```typescript
const selectNextSegment = useCallback(() => {
  setSelectedSegmentId(segment.id);
  requestSeek(segment.start);  // ❌ Only async seek
}, ...);
```

**Correct:**

```typescript
const selectNextSegment = useCallback(() => {
  setSelectedSegmentId(segment.id);
  seekToTime(segment.start);   // ✅ Sync time update + async seek
}, ...);
```

### Pitfall 2: Adding `isPlaying` Check to Selection Sync

**Wrong thinking:** "The effect only needs to run during playback"

**Reality:** The effect needs to run after ALL time changes, not just playback. When a user clicks on the waveform, we want the selection to update even while paused.

The effect doesn't cause problems for navigation because `seekToTime` updates the time to match the selection BEFORE the effect runs.

### Pitfall 3: Forgetting onMouseDown Handler When Refactoring

When splitting `TranscriptSegment.tsx` into smaller components, the `onMouseDown` handler on the word container can be forgotten:

**On main (correct):**

```tsx
<div
  onMouseDown={(event) => {
    // Only prevent default for single clicks, not double clicks
    if (event.detail === 1) {
      event.preventDefault();
    }
  }}
  className="text-base leading-relaxed outline-none"
>
  {/* words */}
</div>
```

**Why it matters:**

- Without this handler, clicking on words causes text selection
- This interferes with the intended click behavior (seek, split)
- The check for `event.detail === 1` allows double-click to work for text selection in edit mode

### Pitfall 4: Removing Tests Without Understanding Root Cause

During debugging, it may seem like tests are "outdated" when they fail. Always verify on a clean branch before removing tests.

**Mistake made during debugging:**

1. Tests failed on the refactored branch
2. Checked if they fail on main (with local changes still applied!)
3. Saw they failed on "main" (actually main + local changes)
4. Concluded tests were outdated and deleted them

**Correct approach:**

1. Stash or discard local changes
2. Checkout clean main branch
3. Run tests on clean main
4. If they pass on clean main, the local changes broke them

## Component Refactoring Considerations

When refactoring `TranscriptSegment.tsx` into smaller components:

### Hooks to Extract

- `useSegmentEditing`: Click/double-click handling, edit mode, keyboard navigation
  - Must include `clickTimeoutRef` for single/double-click differentiation
  - Must export `handleSegmentClick`, `handleSegmentDoubleClick`, `handleSelectKeyDown`

### Components to Extract

- `WordList`: Word rendering and interaction
  - Must include `onMouseDown` handler to prevent text selection
- `SegmentHeader`: Timestamp, speaker, actions
- `SegmentStatusBar`: Confirmation status, bookmarks

### Critical Implementation Details

1. **Double-click timeout**: The `clickTimeoutRef` pattern must be preserved
2. **Event ordering**: Double-click must cancel pending single-click BEFORE preventDefault
3. **Text selection prevention**: `onMouseDown` with `event.detail === 1` check
4. **Edit mode body marker**: `document.body.dataset.transcriptEditing` for hotkey blocking

## Performance Considerations

### Why This Architecture Doesn't Cause Re-render Loops

1. **`activeSegment` is memoized**: Only recalculates when `segments` or `currentTime` changes
2. **Handler caching**: `handlerCacheRef` in `useSegmentSelection` prevents handler recreation
3. **Segment memoization**: `TranscriptSegment` uses `React.memo` with `arePropsEqual`
4. **Waveform segments ref**: `waveSegmentsRef` prevents unnecessary waveform re-renders

### The Original Performance Problem (Commit 3b27291)

Before the fix, `useTranscriptPlayback` had:

- `findSegmentAtTime()` - Found segment at current time
- `syncSelectionForTime()` - Updated time AND selection

This caused:

1. Every time change triggered segment finding
2. Every segment find triggered selection update
3. Selection updates triggered re-renders
4. Re-renders caused more time updates (via effects)

**Solution in 3b27291:**

- Removed `findSegmentAtTime()` and `syncSelectionForTime()` from playback hooks
- Selection sync moved to `useScrollAndSelection` with proper guards
- Seek operations use `seekToTime` to update both atomically

## Testing Considerations

### Tests That Verify This Architecture

1. **`updates selection within the active speaker filter as time changes`**
   - Verifies: Selection follows activeSegment when time changes externally
   - Uses: `setState({ currentTime: 1.5 })` to simulate time change

2. **`updates selected segment after wave interaction while paused`**
   - Verifies: Waveform click updates selection even when paused
   - Uses: `waveSurferMock.handlers.get("interaction")` to simulate click

3. **`scrolls to the next segment when using arrow navigation while paused`**
   - Verifies: Arrow navigation works while paused
   - Uses: `fireEvent.keyDown(window, { key: "ArrowDown" })`

### Mock Requirements

The WaveSurfer mock must:

1. Store event handlers for later invocation
2. Allow triggering `interaction` events to simulate clicks
3. Not actually seek (mocked `setTime`)

## Summary

| Component               | Responsibility                                                                |
| ----------------------- | ----------------------------------------------------------------------------- |
| `WaveformPlayer`        | Source of truth for time, emits timeupdate, handles seek requests             |
| `useSegmentSelection`   | Navigation (arrow keys), segment handlers, `seekToTime` helper                |
| `useScrollAndSelection` | Selection sync effect, scroll-to-segment logic                                |
| `useTranscriptPlayback` | Play/pause, skip, playback-specific seeks                                     |
| Zustand Store           | Central state: currentTime, selectedSegmentId, seekRequest, isPlaying         |

The key insight is that **time and selection must be updated together** for transcript-initiated operations to prevent the selection sync effect from "correcting" user navigation.

## Performance Analysis

### Current Implementation Status

✅ **Implemented Correctly:**

- `TranscriptSegment` uses `React.memo` with custom `arePropsEqual`
- Handler caching via `handlerCacheRef` for stable function references
- `filteredSegments` uses `useMemo` for memoization
- `lexiconMatchesBySegment` uses `useMemo` for expensive matching
- `waveformSegments` uses ref-based caching to prevent waveform re-renders

### Known Performance Bottlenecks

#### 1. Linear Search for activeSegment (O(n) per render)

**Location:** `useScrollAndSelection.ts` line 37

```typescript
const activeSegment = segments.find((s) => currentTime >= s.start && currentTime <= s.end);
```

**Impact:** Called on every render. During playback with 60fps updates, this runs 60x/second on potentially thousands of segments.

**Mitigation:** Segments are sorted by time, so binary search would be O(log n). However, the current implementation works because:

- The find typically exits early (segments are sorted)
- The check is simple (two comparisons)
- For 1000 segments at 60fps = 60,000 comparisons/second - still fast

**Recommendation:** Monitor with profiler. If slow, implement binary search:

```typescript
// Optimization: Binary search since segments are sorted by start time
const activeSegment = useMemo(() => {
  let low = 0, high = segments.length - 1;
  while (low <= high) {
    const mid = Math.floor((low + high) / 2);
    const seg = segments[mid];
    if (currentTime >= seg.start && currentTime <= seg.end) return seg;
    if (currentTime < seg.start) high = mid - 1;
    else low = mid + 1;
  }
  return undefined;
}, [segments, currentTime]);
```

#### 2. isActiveSegmentVisible Linear Search (O(n))

**Location:** `useScrollAndSelection.ts` line 38-41

```typescript
const isActiveSegmentVisible = useMemo(() => {
  return filteredSegments.some((segment) => segment.id === activeSegment.id);
}, [activeSegment, filteredSegments]);
```

**Impact:** Medium - only runs when activeSegment or filteredSegments change.

**Optimization:** Use a Set for O(1) lookup:

```typescript
const filteredSegmentIds = useMemo(
  () => new Set(filteredSegments.map(s => s.id)),
  [filteredSegments]
);
const isActiveSegmentVisible = activeSegment ? filteredSegmentIds.has(activeSegment.id) : false;
```

#### 3. Handler Recreation for Merge Operations (Memoization Breaker!)

**Location:** `useSegmentSelection.ts` lines 212-227

```typescript
handlers.onMergeWithPrevious = index > 0 && previousSegment && areAdjacent(...)
  ? () => { ... }  // NEW function on every call!
  : undefined;
```

**Impact:** HIGH - Creates new function references on every `segmentHandlers` useMemo call, breaking `arePropsEqual` memoization for ALL segments.

**Current Mitigation:** This is intentional because merge handlers depend on adjacency which can change when filtering. The trade-off is:

- Correct behavior (merge only allowed for adjacent segments)
- Some re-renders when handlers array changes

**Possible Optimization:** Cache merge handlers similar to other handlers, and only recreate when adjacency changes.

#### 4. onSelect Linear Search (O(n) per click)

**Location:** `useSegmentSelection.ts` line 195

```typescript
onSelect: () => {
  const current = useTranscriptStore.getState().segments.find((s) => s.id === segment.id);
  ...
}
```

**Impact:** Low - only runs on user click, not during playback.

**Reason for Implementation:** Gets fresh segment data from store to ensure correct timing even if local copy is stale.

#### 5. Active Word Index Linear Search (O(m) per time change)

**Location:** `useSegmentSelection.ts` line 166

```typescript
return activeSegment.words.findIndex((w) => currentTime >= w.start && currentTime <= w.end);
```

**Impact:** Medium - Runs on every time change, but only searches within one segment's words (typically 5-50 words).

### Complexity Summary

| Operation                    | Complexity  | Frequency                | Impact         |
| ---------------------------- | ----------- | ------------------------ | -------------- |
| Find activeSegment           | O(n)        | Every render             | Medium         |
| Check isActiveSegmentVisible | O(m)        | On segment/filter change | Low            |
| Find activeWordIndex         | O(w)        | Every time change        | Low            |
| Filter segments              | O(n × w)    | On filter change         | Low (memoized) |
| Lexicon matching             | O(n × w × l)| On text/lexicon change   | Low (memoized) |
| Handler creation             | O(m)        | On segments change       | Medium         |
| Segment rendering            | O(m)        | On any change            | High (memoized)|

Where: n = total segments, m = filtered segments, w = words per segment, l = lexicon entries

### Recommendations

1. **No immediate action needed** - Current implementation handles typical transcripts (100-500 segments) well
2. **Monitor with React DevTools Profiler** for transcripts >1000 segments
3. **Consider virtualization** (react-window) for transcripts >500 segments
4. **Consider binary search** for activeSegment if profiling shows it as bottleneck
5. **Consider Set for filteredSegmentIds** for faster visibility checks
