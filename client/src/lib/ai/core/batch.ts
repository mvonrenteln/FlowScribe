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

// ==================== Concurrency ====================

export interface OrderedConcurrencyOptions<T> {
  /** Maximum number of tasks running concurrently */
  concurrency: number;
  /** Abort signal for cancellation */
  signal?: AbortSignal;
  /** Called when a task completes, in input order */
  onItemComplete?: (index: number, result: T) => void;
  /** Called when a task fails, in input order */
  onItemError?: (index: number, error: Error) => void;
  /** Called when progress updates (emitted count, total) */
  onProgress?: (processed: number, total: number) => void;
  /** Yield to the main thread after this many emissions (default: 50) */
  yieldEvery?: number;
}

/**
 * Run async tasks with limited concurrency while preserving completion order.
 *
 * Tasks execute in parallel up to the provided concurrency, but callbacks
 * are emitted strictly in input order to keep batch logs deterministic.
 */
export async function runConcurrentOrdered<T>(
  tasks: Array<() => Promise<T>>,
  options: OrderedConcurrencyOptions<T>,
): Promise<Array<PromiseSettledResult<T> | undefined>> {
  const total = tasks.length;
  const results: Array<PromiseSettledResult<T> | undefined> = new Array(total);
  const concurrency = Math.max(1, options.concurrency);
  const yieldEvery = Math.max(1, options.yieldEvery ?? 50);

  let active = 0;
  let nextIndex = 0;
  let nextToEmit = 0;
  let stopScheduling = false;
  let emittedSinceYield = 0;

  const emitReady = async () => {
    while (nextToEmit < total && results[nextToEmit]) {
      const result = results[nextToEmit];
      if (result?.status === "fulfilled") {
        options.onItemComplete?.(nextToEmit, result.value);
      } else if (result?.status === "rejected") {
        options.onItemError?.(nextToEmit, toError(result.reason));
      }
      options.onProgress?.(nextToEmit + 1, total);
      nextToEmit++;
      emittedSinceYield++;
      if (emittedSinceYield >= yieldEvery) {
        emittedSinceYield = 0;
        await yieldToMainThread();
      }
    }
  };

  return new Promise((resolve) => {
    const schedule = () => {
      if (options.signal?.aborted) {
        stopScheduling = true;
      }

      while (!stopScheduling && active < concurrency && nextIndex < total) {
        const currentIndex = nextIndex++;
        active++;

        tasks[currentIndex]()
          .then((value) => {
            results[currentIndex] = { status: "fulfilled", value };
          })
          .catch((reason) => {
            results[currentIndex] = { status: "rejected", reason };
          })
          .finally(() => {
            active--;
            if (options.signal?.aborted) {
              stopScheduling = true;
            }
            // NOTE: emitReady is async and intentionally fire-and-forget. This means
            // runConcurrentOrdered can resolve before all ordered callbacks emit if
            // emitReady yields (e.g., large batches with yieldEvery). Callers must
            // not assume onItemComplete/onItemError or ordered results are fully
            // flushed at resolve time.
            void emitReady();
            if ((nextIndex >= total || stopScheduling) && active === 0) {
              resolve(results);
              return;
            }
            schedule();
          });
      }

      if ((nextIndex >= total || stopScheduling) && active === 0) {
        resolve(results);
      }
    };

    if (total === 0) {
      resolve(results);
      return;
    }

    schedule();
  });
}

function toError(reason: unknown): Error {
  if (reason instanceof Error) return reason;
  if (typeof reason === "string") return new Error(reason);
  return new Error("Unknown error");
}

export interface BatchCoordinatorOptions<TInput, TPrepared, TResult> {
  /** Inputs to prepare */
  inputs: TInput[];
  /** Prepare a work item (return null to skip) */
  prepare: (input: TInput, index: number) => TPrepared | null;
  /** Execute a prepared work item */
  execute: (prepared: TPrepared, index: number) => Promise<TResult>;
  /** Maximum number of concurrent executions */
  concurrency: number;
  /** Abort signal for cancellation */
  signal?: AbortSignal;
  /** Yield to the main thread after this many prepare steps (default: 50) */
  prepareYieldEvery?: number;
  /** Yield to the main thread after this many completion emissions (default: 50) */
  emitYieldEvery?: number;
  /** Called after each prepared item */
  onPrepared?: (preparedCount: number, total: number) => void;
  /** Called when a prepared item completes, in prepared order */
  onItemComplete?: (index: number, result: TResult) => void;
  /** Called when a prepared item errors, in prepared order */
  onItemError?: (index: number, error: Error) => void;
  /** Called when progress updates (processed, totalPrepared) */
  onProgress?: (processed: number, totalPrepared: number) => void;
}

export interface BatchCoordinatorResult<TResult> {
  /** All results, aligned with prepared order */
  results: Array<PromiseSettledResult<TResult> | undefined>;
  /** Number of prepared items */
  preparedCount: number;
}

/**
 * Optional batch coordinator that separates preparation from execution,
 * yielding to the main thread to keep the UI responsive.
 */
export async function runBatchCoordinator<TInput, TPrepared, TResult>(
  options: BatchCoordinatorOptions<TInput, TPrepared, TResult>,
): Promise<BatchCoordinatorResult<TResult>> {
  const {
    inputs,
    prepare,
    execute,
    concurrency,
    signal,
    prepareYieldEvery = 50,
    emitYieldEvery = 50,
    onPrepared,
    onItemComplete,
    onItemError,
    onProgress,
  } = options;

  const prepared: Array<{ index: number; value: TPrepared }> = [];
  const total = inputs.length;

  for (let i = 0; i < total; i++) {
    if (signal?.aborted) {
      break;
    }
    const preparedItem = prepare(inputs[i], i);
    if (preparedItem !== null) {
      prepared.push({ index: i, value: preparedItem });
      onPrepared?.(prepared.length, total);
    }
    if (i > 0 && i % prepareYieldEvery === 0) {
      await yieldToMainThread();
    }
  }

  const tasks = prepared.map((item) => () => execute(item.value, item.index));
  const results = await runConcurrentOrdered(tasks, {
    concurrency,
    signal,
    yieldEvery: emitYieldEvery,
    onItemComplete: (preparedIndex, result) => {
      const originalIndex = prepared[preparedIndex]?.index ?? preparedIndex;
      onItemComplete?.(originalIndex, result);
    },
    onItemError: (preparedIndex, error) => {
      const originalIndex = prepared[preparedIndex]?.index ?? preparedIndex;
      onItemError?.(originalIndex, error);
    },
    onProgress,
  });

  return { results, preparedCount: prepared.length };
}

/**
 * Yield execution back to the main thread / event loop, allowing pending UI work
 * or other queued tasks to run before continuing.
 *
 * In browsers, this prefers window.requestAnimationFrame (when available) to
 * schedule continuation at the next repaint; otherwise it falls back to
 * setTimeout(..., 0) which schedules a macrotask on the event loop.
 *
 * Useful for breaking up long-running work, letting the renderer update, or
 * avoiding UI jank by yielding control between iterations of an async loop.
 *
 * Note: requestAnimationFrame can be throttled or paused in background tabs,
 * and neither mechanism guarantees precise timing — only that control is yielded.
 *
 * @returns A Promise that resolves after yielding to the main thread.
 */
export async function yieldToMainThread(): Promise<void> {
  if (typeof window !== "undefined" && "requestAnimationFrame" in window) {
    await new Promise<void>((resolve) => {
      window.requestAnimationFrame(() => resolve());
    });
    return;
  }

  await new Promise<void>((resolve) => setTimeout(resolve, 0));
}
