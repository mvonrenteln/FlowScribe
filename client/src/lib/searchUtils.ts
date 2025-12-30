/**
 * Search utilities for robust text matching and normalization.
 * Follows Single Responsibility Principle by encapsulating search logic.
 */

/**
 * Normalizes text for search by:
 * 1. Unicode NFC normalization (canonical decomposition followed by canonical composition)
 * 2. Lowercasing
 * 3. Collapsing multiple whitespaces into one
 */
export function normalizeForSearch(text: string): string {
  if (!text) return "";
  return text.normalize("NFC").toLowerCase().replace(/\s+/g, " ");
}

/**
 * Escapes special characters for use in a regular expression.
 */
export function escapeRegExp(string: string): string {
  return string.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Creates a case-insensitive search regex.
 * If isRegex is true, it attempts to parse the query as a regex.
 * If isRegex is false, it treats the query as a literal string.
 */
export function createSearchRegex(query: string, isRegex: boolean): RegExp | null {
  const trimmedQuery = query.trim();
  if (!trimmedQuery) return null;

  // Treat obviously "match-everything" patterns as invalid so the app
  // doesn't try to execute expensive/global matches on transient input.
  // Examples:
  //  - ".*" or ".+" (optionally wrapped with ^ and $)
  //  - "^.*$" or "^. +$" (with anchors)
  //  - Repeated wildcard groups like ".*.*"
  // We use a simple heuristic rather than full regex parsing.
  const normalized = trimmedQuery.replace(/^\^/, "").replace(/\$$/, "");
  const matchEverythingPatterns = [".*", ".+", ".*.*", ".+.+"];
  if (matchEverythingPatterns.includes(normalized)) return null;

  try {
    if (isRegex) {
      const rx = new RegExp(`(${trimmedQuery})`, "gi");
      // Reject clear "match everything" regexes like (.*) or (.+),
      // possibly wrapped with anchors like (^.*$) which would result in '(^.*$)'.
      if (/^\(\^?\.([*+])\$?\)$/.test(rx.source)) return null;
      return rx;
    }
    return new RegExp(`(${escapeRegExp(trimmedQuery)})`, "gi");
  } catch (e) {
    console.warn("Invalid search regex:", e);
    return null;
  }
}

/**
 * Identifies all occurrences of a regex match in a text.
 * Returns an array of start/end indices.
 */
export function findMatchesInText(
  text: string,
  regex: RegExp,
): Array<{ start: number; end: number; match: string }> {
  if (!text || !regex) return [];

  const matches: Array<{ start: number; end: number; match: string }> = [];
  const localRegex = new RegExp(regex.source, regex.flags); // Ensure it has 'g' and fresh state

  let match: RegExpExecArray | null;
  // biome-ignore lint/suspicious/noAssignInExpressions: standard regex iteration pattern
  while ((match = localRegex.exec(text)) !== null) {
    if (match.index === localRegex.lastIndex) {
      localRegex.lastIndex++; // Prevent infinite loop on empty matches
    }
    matches.push({
      start: match.index,
      end: localRegex.lastIndex,
      match: match[0],
    });
  }

  return matches;
}
