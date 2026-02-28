/**
 * Pure functions for glossary import/export.
 *
 * Format (pipe-delimited, one entry per line):
 *   Term | variant1, variant2 | false positives: fp1, fp2
 *
 * - The first section is always the term.
 * - Remaining sections that start with "false positive(s):" are false-positive lists.
 * - All other sections are variant lists.
 */

import type { LexiconEntry } from "@/lib/store/types";

/** Split a comma-separated string into a trimmed, non-empty array. */
export const parseList = (value: string): string[] =>
  value
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean);

/**
 * Strip one or more leading "false positive(s):" labels.
 *
 * Exported files can accumulate nested prefixes across export/import cycles
 * (e.g. "false positives: false positives: X"), so we strip iteratively.
 */
export const stripFalsePositiveLabel = (value: string): string => {
  let stripped = value.trim();
  while (/^false positives?:\s*/i.test(stripped)) {
    stripped = stripped.replace(/^false positives?:\s*/i, "").trim();
  }
  return stripped;
};

/** Parse a full glossary file into lexicon entries. */
export function parseGlossaryFile(content: string): LexiconEntry[] {
  return content
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const parts = line.split("|").map((p) => p.trim());
      const term = parts[0] ?? "";
      const variants: string[] = [];
      const falsePositives: string[] = [];

      for (let i = 1; i < parts.length; i += 1) {
        const part = parts[i];
        if (!part) continue;
        if (/^false positives?:/i.test(part)) {
          falsePositives.push(...parseList(stripFalsePositiveLabel(part)));
        } else {
          variants.push(...parseList(part));
        }
      }

      return { term, variants, falsePositives };
    });
}

/** Serialize lexicon entries into the pipe-delimited export format. */
export function serializeGlossaryFile(entries: LexiconEntry[]): string {
  return entries
    .map((entry) => {
      const variantsPart = entry.variants.length > 0 ? ` | ${entry.variants.join(", ")}` : "";
      const fpPart =
        entry.falsePositives.length > 0
          ? ` | false positives: ${entry.falsePositives.join(", ")}`
          : "";
      return `${entry.term}${variantsPart}${fpPart}`;
    })
    .join("\n");
}
