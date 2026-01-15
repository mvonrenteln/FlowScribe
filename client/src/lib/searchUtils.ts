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
import XRegExp from "xregexp";

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
      const source = trimmedQuery;
      const containsW = /\\[wW]/.test(source);

      if (containsW) {
        // Use XRegExp to build a Unicode-aware regex. XRegExp supports
        // the `\p{L}` style via its addons and handles many edge cases.
        try {
          // Replace \w/\W with XRegExp token for Unicode letters/numbers
          // XRegExp supports Unicode categories when using its `unicode` flag.
          const unicodeWordClass = "[\\p{L}\\p{M}\\p{N}_]";
          const unicodeNonWordClass = "[^\\p{L}\\p{M}\\p{N}_]";
          const replaced = source
            .replace(/\\w/g, unicodeWordClass)
            .replace(/\\W/g, unicodeNonWordClass);

          // Build with XRegExp so that `\p{L}` works across environments
          const rx = XRegExp(replaced, "gi");
          if (/^\^?\.([*+])\$?$/.test(rx.source)) return null;
          // Convert XRegExp to native RegExp for the rest of the codebase
          return new RegExp(rx.source, rx.flags);
        } catch (_e) {
          // Fall back to native behavior if XRegExp fails for any reason
          const rx = new RegExp(trimmedQuery, "gi");
          if (/^\^?\.([*+])\$?$/.test(rx.source)) return null;
          return rx;
        }
      }

      const rx = new RegExp(trimmedQuery, "gi");
      if (/^\^?\.([*+])\$?$/.test(rx.source)) return null;
      return rx;
    }
    return new RegExp(`(${escapeRegExp(trimmedQuery)})`, "gi");
  } catch (_e) {
    // Invalid user regexes are expected input (typed by user) and
    // occur frequently during interactive editing. Don't spam the
    // test output — just return null to indicate an unusable regex.
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
