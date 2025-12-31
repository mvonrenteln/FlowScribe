/**
 * Text Diff Utilities
 *
 * Functions for computing and displaying text differences.
 * Used for showing AI revision changes in a side-by-side view.
 */

import type { TextChange } from "@/lib/store/types";

// ==================== Types ====================

export interface DiffSegment {
  type: "equal" | "insert" | "delete";
  text: string;
}

export type { TextChange };

// ==================== Simple Diff Algorithm ====================

/**
 * Compute a simple character-level diff between two strings.
 * Uses a basic LCS-based approach for clarity and reliability.
 *
 * For production, consider using a library like `fast-diff` or `diff-match-patch`.
 */
export function computeDiff(original: string, revised: string): DiffSegment[] {
  // Simple word-based diff for better readability
  const originalWords = tokenize(original);
  const revisedWords = tokenize(revised);

  const lcs = longestCommonSubsequence(originalWords, revisedWords);
  const result: DiffSegment[] = [];

  let origIdx = 0;
  let revIdx = 0;
  let lcsIdx = 0;

  while (origIdx < originalWords.length || revIdx < revisedWords.length) {
    // Collect deletions (in original but not in LCS)
    while (
      origIdx < originalWords.length &&
      (lcsIdx >= lcs.length || originalWords[origIdx] !== lcs[lcsIdx])
    ) {
      result.push({ type: "delete", text: originalWords[origIdx] });
      origIdx++;
    }

    // Collect insertions (in revised but not in LCS)
    while (
      revIdx < revisedWords.length &&
      (lcsIdx >= lcs.length || revisedWords[revIdx] !== lcs[lcsIdx])
    ) {
      result.push({ type: "insert", text: revisedWords[revIdx] });
      revIdx++;
    }

    // Collect equal parts (in both and in LCS)
    if (lcsIdx < lcs.length) {
      result.push({ type: "equal", text: lcs[lcsIdx] });
      origIdx++;
      revIdx++;
      lcsIdx++;
    }
  }

  // Merge adjacent segments of the same type
  return mergeAdjacentSegments(result);
}

/**
 * Tokenize text into words while preserving whitespace.
 */
function tokenize(text: string): string[] {
  const tokens: string[] = [];
  let current = "";
  let inWord = false;

  for (const char of text) {
    const isWhitespace = /\s/.test(char);

    if (isWhitespace) {
      if (current) {
        tokens.push(current);
        current = "";
      }
      // Include whitespace as separate token to preserve spacing
      tokens.push(char);
      inWord = false;
    } else {
      current += char;
      inWord = true;
    }
  }

  if (current) {
    tokens.push(current);
  }

  return tokens;
}

/**
 * Compute the Longest Common Subsequence of two arrays.
 */
function longestCommonSubsequence<T>(a: T[], b: T[]): T[] {
  const m = a.length;
  const n = b.length;

  // DP table
  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (a[i - 1] === b[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
      }
    }
  }

  // Backtrack to find LCS
  const lcs: T[] = [];
  let i = m;
  let j = n;

  while (i > 0 && j > 0) {
    if (a[i - 1] === b[j - 1]) {
      lcs.unshift(a[i - 1]);
      i--;
      j--;
    } else if (dp[i - 1][j] > dp[i][j - 1]) {
      i--;
    } else {
      j--;
    }
  }

  return lcs;
}

/**
 * Merge adjacent segments of the same type.
 */
function mergeAdjacentSegments(segments: DiffSegment[]): DiffSegment[] {
  if (segments.length === 0) return [];

  const merged: DiffSegment[] = [];
  let current = { ...segments[0] };

  for (let i = 1; i < segments.length; i++) {
    const seg = segments[i];
    if (seg.type === current.type) {
      current.text += seg.text;
    } else {
      merged.push(current);
      current = { ...seg };
    }
  }

  merged.push(current);
  return merged;
}

// ==================== TextChange Conversion ====================

/**
 * Convert diff segments to TextChange array for storage.
 */
export function computeTextChanges(original: string, revised: string): TextChange[] {
  const diff = computeDiff(original, revised);
  const changes: TextChange[] = [];
  let position = 0;

  for (const segment of diff) {
    switch (segment.type) {
      case "delete":
        changes.push({
          type: "delete",
          position,
          length: segment.text.length,
          oldText: segment.text,
        });
        // Position doesn't advance for deletions
        break;

      case "insert":
        changes.push({
          type: "insert",
          position,
          newText: segment.text,
        });
        position += segment.text.length;
        break;

      case "equal":
        position += segment.text.length;
        break;
    }
  }

  return changes;
}

/**
 * Count the number of meaningful changes (ignoring whitespace-only).
 */
export function countChanges(changes: TextChange[]): number {
  return changes.filter((c) => {
    const text = c.oldText ?? c.newText ?? "";
    return text.trim().length > 0;
  }).length;
}

/**
 * Create a human-readable summary of changes.
 */
export function summarizeChanges(
  changes: TextChange[],
  original: string,
  revised: string,
): string {
  if (original === revised) {
    return "No changes";
  }

  const meaningfulChanges = countChanges(changes);

  if (meaningfulChanges === 0) {
    return "Whitespace changes only";
  }

  if (meaningfulChanges === 1) {
    return "1 change";
  }

  return `${meaningfulChanges} changes`;
}

// ==================== Display Helpers ====================

/**
 * Get diff segments for the original text (showing deletions).
 */
export function getOriginalDiffSegments(original: string, revised: string): DiffSegment[] {
  const diff = computeDiff(original, revised);
  return diff.filter((s) => s.type !== "insert");
}

/**
 * Get diff segments for the revised text (showing insertions).
 */
export function getRevisedDiffSegments(original: string, revised: string): DiffSegment[] {
  const diff = computeDiff(original, revised);
  return diff.filter((s) => s.type !== "delete");
}

/**
 * Check if there are any meaningful differences between two texts.
 */
export function hasDifferences(original: string, revised: string): boolean {
  return original !== revised;
}

