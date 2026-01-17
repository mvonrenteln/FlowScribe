import type { Segment } from "@/lib/store";

const DEFAULT_PERCENTILE = 0.1;
const DEFAULT_MAX_THRESHOLD = 0.4;

/**
 * Compute the auto low-confidence threshold based on word scores.
 *
 * Uses a linear-time selection to match the previous percentile behavior without sorting
 * the entire score list.
 */
export const computeAutoConfidenceThreshold = (
  segments: Segment[],
  percentile: number = DEFAULT_PERCENTILE,
  maxThreshold: number = DEFAULT_MAX_THRESHOLD,
): number | null => {
  const scores: number[] = [];

  for (const segment of segments) {
    for (const word of segment.words) {
      if (typeof word.score === "number") {
        scores.push(word.score);
      }
    }
  }

  if (scores.length === 0) return null;

  const targetIndex = Math.min(
    scores.length - 1,
    Math.max(0, Math.floor(scores.length * percentile)),
  );
  const selected = selectKth(scores, targetIndex);
  return Math.min(maxThreshold, selected);
};

const selectKth = (values: number[], targetIndex: number): number => {
  let left = 0;
  let right = values.length - 1;

  while (left <= right) {
    if (left === right) return values[left];

    const pivotIndex = partition(values, left, right, (left + right) >> 1);

    if (targetIndex === pivotIndex) {
      return values[pivotIndex];
    }

    if (targetIndex < pivotIndex) {
      right = pivotIndex - 1;
    } else {
      left = pivotIndex + 1;
    }
  }

  return values[targetIndex];
};

const partition = (values: number[], left: number, right: number, pivotIndex: number): number => {
  const pivotValue = values[pivotIndex];
  swap(values, pivotIndex, right);

  let storeIndex = left;
  for (let i = left; i < right; i += 1) {
    if (values[i] < pivotValue) {
      swap(values, storeIndex, i);
      storeIndex += 1;
    }
  }

  swap(values, right, storeIndex);
  return storeIndex;
};

const swap = (values: number[], left: number, right: number): void => {
  if (left === right) return;
  const temp = values[left];
  values[left] = values[right];
  values[right] = temp;
};
