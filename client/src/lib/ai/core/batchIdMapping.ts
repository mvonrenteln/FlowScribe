/**
 * Batch ID Mapping Utilities
 *
 * Generic utilities for mapping between simple numeric IDs (for AI prompts)
 * and real application IDs. Useful for any AI feature that processes batches
 * of items where complex IDs might confuse smaller models.
 *
 * @module ai/core/batchIdMapping
 */

// ==================== Types ====================

/**
 * Mapping info for batch processing with simple IDs.
 * Maps simple numeric IDs (1, 2, 3...) to real IDs.
 */
export interface BatchIdMapping<T = string> {
  /** Map from simple ID (1-based) to real ID */
  simpleToReal: Map<number, T>;
  /** Map from real ID to simple ID */
  realToSimple: Map<T, number>;
}

/**
 * Extended mapping with pair tracking.
 * Useful for features that analyze pairs of items.
 */
export interface BatchPairMapping<T = string> extends BatchIdMapping<T> {
  /** Pair index to ID tuple */
  pairToIds: Map<number, [T, T]>;
}

// ==================== Creation Functions ====================

/**
 * Create ID mappings for a batch of items.
 * Assigns simple 1-based IDs for use in prompts.
 *
 * @param items - Items in the batch
 * @param getId - Function to extract ID from item
 * @returns BatchIdMapping object
 *
 * @example
 * ```ts
 * const segments = [{ id: "seg-335" }, { id: "seg-336" }];
 * const mapping = createBatchIdMapping(segments, (s) => s.id);
 * // mapping.simpleToReal: { 1 → "seg-335", 2 → "seg-336" }
 * // mapping.realToSimple: { "seg-335" → 1, "seg-336" → 2 }
 * ```
 */
export function createBatchIdMapping<TItem, TId = string>(
  items: TItem[],
  getId: (item: TItem) => TId,
): BatchIdMapping<TId> {
  const simpleToReal = new Map<number, TId>();
  const realToSimple = new Map<TId, number>();

  items.forEach((item, idx) => {
    const simpleId = idx + 1; // 1-based
    const realId = getId(item);
    simpleToReal.set(simpleId, realId);
    realToSimple.set(realId, simpleId);
  });

  return { simpleToReal, realToSimple };
}

/**
 * Create pair mapping for batch processing.
 * Extends basic ID mapping with pair tracking.
 *
 * @param items - Items in the batch
 * @param getId - Function to extract ID from item
 * @returns BatchPairMapping object
 */
export function createBatchPairMapping<TItem, TId = string>(
  items: TItem[],
  getId: (item: TItem) => TId,
): BatchPairMapping<TId> {
  const base = createBatchIdMapping(items, getId);
  return {
    ...base,
    pairToIds: new Map(),
  };
}

// ==================== Conversion Functions ====================

/**
 * Convert a simple ID to a real ID using the mapping.
 *
 * @param simpleId - Simple 1-based ID
 * @param mapping - ID mapping
 * @returns Real ID or undefined if not found
 */
export function simpleToRealId<T>(simpleId: number, mapping: BatchIdMapping<T>): T | undefined {
  return mapping.simpleToReal.get(simpleId);
}

/**
 * Convert a real ID to a simple ID using the mapping.
 *
 * @param realId - Real application ID
 * @param mapping - ID mapping
 * @returns Simple ID or undefined if not found
 */
export function realToSimpleId<T>(realId: T, mapping: BatchIdMapping<T>): number | undefined {
  return mapping.realToSimple.get(realId);
}

/**
 * Convert an array of IDs (which may be simple numbers or real IDs)
 * to an array of real IDs.
 *
 * @param ids - Array of IDs (numbers, strings, or mixed)
 * @param mapping - ID mapping
 * @returns Array of real IDs
 */
export function normalizeIds<T = string>(ids: unknown[], mapping: BatchIdMapping<T>): T[] {
  return ids
    .map((id) => {
      // If it's a number, try to map from simple ID
      if (typeof id === "number") {
        return mapping.simpleToReal.get(id);
      }
      // If it's a string that looks like a number, try to parse and map
      if (typeof id === "string") {
        const numId = parseInt(id, 10);
        if (!Number.isNaN(numId) && mapping.simpleToReal.has(numId)) {
          return mapping.simpleToReal.get(numId);
        }
        // Check if it's already a real ID
        if (mapping.realToSimple.has(id as unknown as T)) {
          return id as unknown as T;
        }
      }
      return undefined;
    })
    .filter((id): id is T => id !== undefined);
}

/**
 * Parse an ID reference that may be in various formats:
 * - Simple number: 1, 2, 3
 * - String number: "1", "2", "3"
 * - Range/pair string: "1-2", "131-132"
 * - Real ID: "seg-335"
 *
 * @param ref - ID reference to parse
 * @param mapping - ID mapping
 * @returns Array of real IDs, or empty array if unparseable
 */
export function parseIdReference<T = string>(ref: unknown, mapping: BatchIdMapping<T>): T[] {
  if (ref === undefined || ref === null) {
    return [];
  }

  // Handle numbers directly
  if (typeof ref === "number") {
    const realId = mapping.simpleToReal.get(ref);
    return realId !== undefined ? [realId] : [];
  }

  // Handle strings
  if (typeof ref === "string") {
    // Check for range format "A-B"
    if (ref.includes("-")) {
      const parts = ref.split("-");
      const results: T[] = [];
      for (const part of parts) {
        const numId = parseInt(part.trim(), 10);
        if (!Number.isNaN(numId)) {
          const realId = mapping.simpleToReal.get(numId);
          if (realId !== undefined) {
            results.push(realId);
          }
        }
      }
      if (results.length > 0) {
        return results;
      }
    }

    // Check if it's a simple number string
    const numId = parseInt(ref, 10);
    if (!Number.isNaN(numId) && String(numId) === ref.trim()) {
      const realId = mapping.simpleToReal.get(numId);
      if (realId !== undefined) {
        return [realId];
      }
    }

    // Check if it's already a real ID
    if (mapping.realToSimple.has(ref as unknown as T)) {
      return [ref as unknown as T];
    }
  }

  return [];
}

/**
 * Add a pair to the pair mapping.
 *
 * @param pairIndex - Index of the pair (1-based)
 * @param idA - First ID in the pair (real ID)
 * @param idB - Second ID in the pair (real ID)
 * @param mapping - Pair mapping to update
 */
export function addPair<T>(pairIndex: number, idA: T, idB: T, mapping: BatchPairMapping<T>): void {
  mapping.pairToIds.set(pairIndex, [idA, idB]);
}

/**
 * Get pair IDs by pair index.
 *
 * @param pairIndex - Index of the pair
 * @param mapping - Pair mapping
 * @returns Tuple of IDs or undefined if not found
 */
export function getPairIds<T>(pairIndex: number, mapping: BatchPairMapping<T>): [T, T] | undefined {
  return mapping.pairToIds.get(pairIndex);
}

// ==================== Serialization ====================

/**
 * Serialize a batch mapping to JSON for transport (e.g., in prompt variables).
 * Only includes the mapping entries, not the full Map objects.
 *
 * @param mapping - Batch mapping to serialize
 * @returns JSON-serializable object
 */
export function serializeBatchMapping<T>(mapping: BatchIdMapping<T>): {
  entries: Array<{ simple: number; real: T }>;
} {
  const entries: Array<{ simple: number; real: T }> = [];
  for (const [simple, real] of mapping.simpleToReal) {
    entries.push({ simple, real });
  }
  return { entries };
}

/**
 * Serialize pair mapping to JSON for transport.
 *
 * @param mapping - Pair mapping to serialize
 * @returns JSON-serializable object with pairs
 */
export function serializePairMapping<T>(mapping: BatchPairMapping<T>): {
  pairs: Array<{ pairIndex: number; ids: [T, T] }>;
} {
  const pairs: Array<{ pairIndex: number; ids: [T, T] }> = [];
  for (const [pairIndex, ids] of mapping.pairToIds) {
    pairs.push({ pairIndex, ids });
  }
  return { pairs };
}

/**
 * Deserialize a batch mapping from JSON.
 *
 * @param data - Serialized mapping data
 * @returns Reconstructed BatchIdMapping
 */
export function deserializeBatchMapping<T>(data: {
  entries: Array<{ simple: number; real: T }>;
}): BatchIdMapping<T> {
  const simpleToReal = new Map<number, T>();
  const realToSimple = new Map<T, number>();

  for (const { simple, real } of data.entries) {
    simpleToReal.set(simple, real);
    realToSimple.set(real, simple);
  }

  return { simpleToReal, realToSimple };
}

/**
 * Minimal typed shape for raw AI suggestion items.
 * Features may include additional fields, but these are the common ones
 * we inspect for ID extraction.
 */
export interface RawAIItem {
  pairIndex?: number | string;
  pairId?: number | string;
  pair?: number | string;
  mergeId?: number | string;
  segmentIds?: Array<number | string>;
  segmentId?: number | string;
  segmentA?: { id?: number | string } | null;
  segmentB?: { id?: number | string } | null;
  ids?: Array<number | string>;
  // allow additional properties
  [key: string]: unknown;
}

/**
 * Extract real IDs from a raw AI suggestion in a generic, data-agnostic way.
 * Returns an array of two or more IDs (T[]) or null when not extractable.
 * This function only focuses on ID extraction and is intentionally data-agnostic.
 */
export function extractSegmentIdsGeneric<T = string>(
  raw: RawAIItem,
  mapping: BatchPairMapping<T> | BatchIdMapping<T>,
): T[] | null {
  const debugEnabled =
    typeof globalThis !== "undefined" &&
    (globalThis as Record<string, unknown>).__AISegmentMergeDebug === true;

  const tryParseRef = (ref: unknown): T[] => {
    if (ref === undefined || ref === null) return [];

    // If mapping supports pairs, try pair-to-ids lookup first
    if ((mapping as BatchPairMapping<T>).pairToIds) {
      const pairMap = (mapping as BatchPairMapping<T>).pairToIds;
      const num = typeof ref === "number" ? ref : parseInt(String(ref), 10);
      if (!Number.isNaN(num) && pairMap.has(num)) {
        return [...(pairMap.get(num) as [T, T])];
      }
      // range like "A-B" where A/B are simple numeric IDs
      if (typeof ref === "string" && ref.includes("-")) {
        const parts = (ref as string)
          .split("-")
          .map((p) => parseInt(p.trim(), 10))
          .filter((n) => !Number.isNaN(n));
        if (parts.length >= 2) {
          const a = (mapping as BatchIdMapping<T>).simpleToReal.get(parts[0]);
          const b = (mapping as BatchIdMapping<T>).simpleToReal.get(parts[1]);
          if (a !== undefined && b !== undefined) return [a, b];
        }
      }
    }

    // Array of ids (simple or real)
    if (Array.isArray(ref)) {
      const ids = normalizeIds(ref, mapping as BatchIdMapping<T>);
      if (ids.length > 0) return ids;
    }

    // Try parsing generic id reference (numbers, string numbers, real IDs)
    const parsed = parseIdReference(ref, mapping as BatchIdMapping<T>);
    if (parsed.length > 0) return parsed;

    return [];
  };

  // Try fields in order of likelihood
  let ids: T[] = [];

  // 1) pairIndex / pairId / pair
  ids = tryParseRef(raw.pairIndex ?? raw.pairId ?? raw.pair);

  // 2) mergeId (could be "A-B" where A/B are simple IDs, or a numeric pairIndex)
  if (ids.length < 2 && raw.mergeId !== undefined) {
    ids = tryParseRef(raw.mergeId);
  }

  // 3) explicit segmentIds array
  if (ids.length < 2 && Array.isArray(raw.segmentIds)) {
    ids = normalizeIds(raw.segmentIds, mapping as BatchIdMapping<T>);
  }

  // 4) segmentA/segmentB objects
  if (ids.length < 2 && raw.segmentA?.id && raw.segmentB?.id) {
    const aRef = raw.segmentA.id;
    const bRef = raw.segmentB.id;
    const a = parseIdReference(aRef, mapping as BatchIdMapping<T>);
    const b = parseIdReference(bRef, mapping as BatchIdMapping<T>);
    if (a.length === 1 && b.length === 1) {
      ids = [a[0], b[0]];
    } else {
      // fallback to raw strings
      ids = [String(aRef) as unknown as T, String(bRef) as unknown as T];
    }
  }

  // 5) ids field (simple numeric ids)
  if (ids.length < 2 && Array.isArray(raw.ids)) {
    ids = normalizeIds(raw.ids, mapping as BatchIdMapping<T>);
  }

  if (ids.length < 2) {
    if (debugEnabled) {
      console.warn(
        "[extractSegmentIdsGeneric] Unable to extract two segment IDs from raw suggestion",
        raw,
      );
    }
    return null;
  }

  return ids;
}
