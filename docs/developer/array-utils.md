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
