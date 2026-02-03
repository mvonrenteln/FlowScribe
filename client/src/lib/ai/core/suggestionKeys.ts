/**
 * Suggestion key helpers for AI batch de-duplication.
 *
 * @module ai/core/suggestionKeys
 */

/**
 * Create a suggestion key for segment-based suggestions.
 *
 * @param segmentId - Segment ID
 * @returns Stable key for segment-level suggestions
 */
export function createSegmentSuggestionKey(segmentId: string): string {
  return segmentId;
}

/**
 * Create a suggestion key for merge pair suggestions.
 *
 * @param segmentIds - Ordered segment IDs for the pair
 * @returns Stable key for merge pair suggestions
 */
export function createMergePairKey(segmentIds: string[]): string {
  return `${segmentIds[0] ?? ""}|${segmentIds[1] ?? ""}`;
}

/**
 * Create a suggestion key for chapter range suggestions.
 *
 * @param startSegmentId - Starting segment ID
 * @param endSegmentId - Ending segment ID
 * @returns Stable key for chapter range suggestions
 */
export function createChapterSuggestionKey(startSegmentId: string, endSegmentId: string): string {
  return `${startSegmentId}|${endSegmentId}`;
}

/**
 * Build a Set of suggestion keys from items.
 *
 * @param items - Items to index
 * @param keyForItem - Key builder for each item
 * @returns Set of suggestion keys
 */
export function buildSuggestionKeySet<T>(
  items: T[],
  keyForItem: (item: T) => string | null | undefined,
): Set<string> {
  const keys = new Set<string>();
  for (const item of items) {
    const key = keyForItem(item);
    if (key) {
      keys.add(key);
    }
  }
  return keys;
}

/**
 * Filter items to only those missing from the provided key set.
 *
 * @param items - Items to filter
 * @param existingKeys - Keys that should be excluded
 * @param keyForItem - Key builder for each item
 * @returns Filtered items without duplicates
 */
export function filterByMissingKeys<T>(
  items: T[],
  existingKeys: Set<string>,
  keyForItem: (item: T) => string | null | undefined,
): T[] {
  return items.filter((item) => {
    const key = keyForItem(item);
    return !key || !existingKeys.has(key);
  });
}
