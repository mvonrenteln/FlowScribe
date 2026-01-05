import type { Word } from "@/lib/store";
import { wordLeadingRegex, wordTrailingRegex } from "@/lib/wordBoundaries";

export function buildReplacementText(
  words: Word[],
  index: number,
  replacement: string,
  partIndex?: number,
) {
  const nextText = words.map((item) => item.word);
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
