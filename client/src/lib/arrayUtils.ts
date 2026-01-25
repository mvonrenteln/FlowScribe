/**
 * Utility helpers for working with arrays of objects that have an `id` string.
 *
 * These helpers are intended to produce stable, testable and efficient
 * lookups (O(1) by id) instead of repeated `Array.prototype.findIndex` calls.
 */

export type WithId = { id: string };

/**
 * Build a Map from `id` -> index for a given array.
 *
 * Returns a new Map where each key is the element's `id` and the value is
 * the index of that element in the provided array. Duplicate ids keep the
 * first-seen index.
 *
 * @example
 * const map = indexById([{id: 'a'}, {id: 'b'}]);
 * map.get('b') // 1
 */
export function indexById<T extends WithId>(arr: readonly T[]): Map<string, number> {
  const map = new Map<string, number>();
  for (let i = 0; i < arr.length; i++) {
    const id = arr[i].id;
    if (!map.has(id)) map.set(id, i);
  }
  return map;
}

/**
 * Build a Map from `id` -> element for a given array.
 *
 * Useful if you need to quickly access items by id. Duplicate ids keep
 * the first-seen value.
 */
export function mapById<T extends WithId>(arr: readonly T[]): Map<string, T> {
  const map = new Map<string, T>();
  for (const item of arr) {
    if (!map.has(item.id)) map.set(item.id, item);
  }
  return map;
}
