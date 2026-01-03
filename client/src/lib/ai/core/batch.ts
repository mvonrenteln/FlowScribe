/**
 * Batch Processing Utilities
 *
 * Generic utilities for batch processing in AI features.
 * These are cross-cutting concerns used by multiple features.
 *
 * @module ai/core/batch
 */

// ==================== Batch Preparation ====================

/**
 * Slice an array into a batch starting at given index.
 *
 * @param items - Source array
 * @param startIndex - Start index (0-based)
 * @param batchSize - Maximum batch size
 * @returns Sliced array
 *
 * @example
 * ```ts
 * const batch = sliceBatch([1,2,3,4,5], 2, 2);
 * // [3, 4]
 * ```
 */
export function sliceBatch<T>(items: T[], startIndex: number, batchSize: number): T[] {
  const endIndex = Math.min(startIndex + batchSize, items.length);
  return items.slice(startIndex, endIndex);
}

/**
 * Prepare a batch with transformation.
 *
 * @param items - Source array
 * @param startIndex - Start index
 * @param batchSize - Maximum batch size
 * @param transform - Transform function for each item
 * @returns Transformed batch
 *
 * @example
 * ```ts
 * const batch = prepareBatch(segments, 0, 10, s => ({
 *   id: s.id,
 *   text: s.text
 * }));
 * ```
 */
export function prepareBatch<T, R>(
  items: T[],
  startIndex: number,
  batchSize: number,
  transform: (item: T) => R,
): R[] {
  return sliceBatch(items, startIndex, batchSize).map(transform);
}

// ==================== Filtering ====================

/**
 * Filter options for segment-like items.
 */
export interface FilterOptions<T> {
  /** Only include items matching these values (empty = all) */
  includeValues?: string[];
  /** Function to get the value to filter on */
  getValue: (item: T) => string;
  /** Exclude items where this returns true */
  excludeIf?: (item: T) => boolean;
  /** Case-insensitive matching (default: true) */
  caseInsensitive?: boolean;
}

/**
 * Filter items based on criteria.
 *
 * @param items - Items to filter
 * @param options - Filter options
 * @returns Filtered items
 *
 * @example
 * ```ts
 * const filtered = filterItems(segments, {
 *   includeValues: ["Alice", "Bob"],
 *   getValue: s => s.speaker,
 *   excludeIf: s => s.confirmed,
 * });
 * ```
 */
export function filterItems<T>(items: T[], options: FilterOptions<T>): T[] {
  const { includeValues = [], getValue, excludeIf, caseInsensitive = true } = options;

  const normalizedInclude = caseInsensitive
    ? includeValues.map((v) => v.toLowerCase())
    : includeValues;

  return items.filter((item) => {
    // Check exclusion condition
    if (excludeIf?.(item)) {
      return false;
    }

    // Check inclusion list (if specified)
    if (normalizedInclude.length > 0) {
      const value = getValue(item);
      const normalizedValue = caseInsensitive ? value.toLowerCase() : value;
      return normalizedInclude.includes(normalizedValue);
    }

    return true;
  });
}

/**
 * Convenience function for filtering segment-like items.
 *
 * @param segments - Segments to filter
 * @param selectedSpeakers - Only include these speakers (empty = all)
 * @param excludeConfirmed - Exclude confirmed segments
 * @returns Filtered segments
 */
export function filterSegments<T extends { speaker: string; confirmed?: boolean }>(
  segments: T[],
  selectedSpeakers: string[],
  excludeConfirmed: boolean,
): T[] {
  return filterItems(segments, {
    includeValues: selectedSpeakers,
    getValue: (s) => s.speaker,
    excludeIf: excludeConfirmed ? (s) => s.confirmed === true : undefined,
  });
}

// ==================== Mapping ====================

/**
 * Build a map from an array of items.
 *
 * @param items - Source items
 * @param getKey - Function to get key
 * @param getValue - Function to get value (default: identity)
 * @returns Map
 *
 * @example
 * ```ts
 * const speakerMap = buildMap(segments, s => s.id, s => s.speaker);
 * // Map { "seg-1" => "Alice", "seg-2" => "Bob" }
 * ```
 */
export function buildMap<T, K, V>(
  items: T[],
  getKey: (item: T) => K,
  getValue: (item: T) => V,
): Map<K, V> {
  const map = new Map<K, V>();
  for (const item of items) {
    map.set(getKey(item), getValue(item));
  }
  return map;
}

// ==================== Batch Iteration ====================

/**
 * Calculate batch information for iteration.
 *
 * @param totalItems - Total number of items
 * @param batchSize - Size of each batch
 * @returns Array of batch info objects
 */
export function calculateBatches(
  totalItems: number,
  batchSize: number,
): Array<{ index: number; start: number; end: number; size: number }> {
  const batches: Array<{ index: number; start: number; end: number; size: number }> = [];
  let batchIndex = 0;

  for (let start = 0; start < totalItems; start += batchSize) {
    const end = Math.min(start + batchSize, totalItems);
    batches.push({
      index: batchIndex++,
      start,
      end,
      size: end - start,
    });
  }

  return batches;
}
