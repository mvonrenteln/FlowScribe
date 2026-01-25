# Array Utilities

This document describes small utility helpers added to `client/src/lib/arrayUtils.ts`.

## Provided functions

- `indexById(arr)`
  - Builds and returns a `Map<string, number>` mapping element `id` to its index in `arr`.
  - Keeps the first-seen index when duplicate ids are present.

- `mapById(arr)`
  - Builds and returns a `Map<string, T>` mapping element `id` to the element itself.
  - Keeps the first-seen element when duplicate ids are present.

## Rationale

Repeating `arr.findIndex(x => x.id === id)` is O(n) per lookup, and can be costly
when performed multiple times during render. These helpers provide O(1) lookup
and are intended to be memoized with `useMemo` in React components to avoid
repeated linear scans.

## Usage

In React components memoize the result:

```ts
const indexMap = useMemo(() => indexById(filteredSegments), [filteredSegments]);
const originalIndex = indexMap.get(segment.id) ?? -1;
```

Prefer `mapById` when you need to access the full element by id rather than its index.

## Guideline: Memoize and Prefer O(1) Access

- For hot render paths (e.g. transcript lists, search, merge operations) prefer building a map once and reusing it rather than repeatedly calling `find`/`findIndex`.
- Use `useMemo` in React components to memoize maps derived from arrays: `useMemo(() => indexById(arr), [arr])`.
- If a lookup map is used by non-React code paths, build it once in the calling scope and pass it down; avoid recreating the map inside tight loops or per-call.
- Add unit tests that would catch regressions if the map-building is accidentally removed or rebuilt per lookup.
