/**
 * Utilities for working with rewritten paragraph text.
 *
 * @module lib/rewriteParagraphs
 */

/**
 * Split rewritten text into paragraphs (double newline separated).
 */
export const splitRewrittenParagraphs = (text: string): string[] =>
  text.split(/\n\n+/).filter((p) => p.trim().length > 0);

/**
 * Replace a paragraph at an index and re-join the full rewritten text.
 */
export const replaceParagraphAtIndex = (
  text: string,
  index: number,
  nextParagraph: string,
): string => {
  const paragraphs = splitRewrittenParagraphs(text);
  if (index < 0 || index >= paragraphs.length) {
    return text;
  }
  const updated = [...paragraphs];
  updated[index] = nextParagraph;
  return updated.join("\n\n");
};

/**
 * Get previous paragraphs for context.
 */
export const getPreviousParagraphs = (
  paragraphs: string[],
  index: number,
  count: number,
): string[] => {
  if (index <= 0 || count <= 0) return [];
  const start = Math.max(0, index - count);
  return paragraphs.slice(start, index);
};
