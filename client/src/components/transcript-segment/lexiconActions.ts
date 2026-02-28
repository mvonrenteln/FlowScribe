import type { Word } from "@/lib/store";
import { wordLeadingRegex, wordTrailingRegex } from "@/lib/wordBoundaries";

export function buildReplacementText(
  words: Word[],
  index: number,
  replacement: string,
  partIndex?: number,
  spanLength?: number,
) {
  const nextText = words.map((item) => item.word);

  // Multi-word span replacement: replace the first word and remove the
  // remaining words in the span so that e.g. "Shere Khan" → "Sherkan"
  // produces a single token instead of "Sherkan Khan".
  if (spanLength !== undefined && spanLength > 1) {
    const first = nextText[index] ?? "";
    const leading = wordLeadingRegex.exec(first)?.[0] ?? "";
    const last = nextText[index + spanLength - 1] ?? "";
    const trailing = wordTrailingRegex.exec(last)?.[0] ?? "";
    nextText[index] = `${leading}${replacement}${trailing}`;
    nextText.splice(index + 1, spanLength - 1);
    return nextText.join(" ");
  }

  const original = nextText[index] ?? "";
  const leading = wordLeadingRegex.exec(original)?.[0] ?? "";
  const trailing = wordTrailingRegex.exec(original)?.[0] ?? "";
  const core = original.slice(leading.length, original.length - trailing.length);
  if (partIndex === undefined || !core.includes("-")) {
    nextText[index] = `${leading}${replacement}${trailing}`;
    return nextText.join(" ");
  }
  const parts = core.split("-");
  if (partIndex < 0 || partIndex >= parts.length) {
    nextText[index] = `${leading}${replacement}${trailing}`;
    return nextText.join(" ");
  }
  parts[partIndex] = replacement;
  nextText[index] = `${leading}${parts.join("-")}${trailing}`;
  return nextText.join(" ");
}

export function getHyphenTarget(value: string, partIndex?: number) {
  if (partIndex === undefined) return value;
  const leading = wordLeadingRegex.exec(value)?.[0] ?? "";
  const trailing = wordTrailingRegex.exec(value)?.[0] ?? "";
  const core = value.slice(leading.length, value.length - trailing.length);
  if (!core.includes("-")) return value;
  const parts = core.split("-");
  const part = parts[partIndex];
  return part ?? value;
}
