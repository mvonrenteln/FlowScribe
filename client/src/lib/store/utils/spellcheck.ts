import { wordEdgeRegex } from "@/lib/wordBoundaries";
import type { SpellcheckLanguage } from "../types";

const normalizeSpellcheckIgnoreWord = (value: string) =>
  value.replace(wordEdgeRegex, "").trim().toLowerCase();

export const normalizeSpellcheckIgnoreWords = (values: string[]) => {
  const seen = new Set<string>();
  return values
    .map((value) => normalizeSpellcheckIgnoreWord(value))
    .filter((value) => {
      if (!value || seen.has(value)) return false;
      seen.add(value);
      return true;
    });
};

export const normalizeSpellcheckLanguages = (value: unknown): SpellcheckLanguage[] => {
  if (value == null) return ["de"];
  const raw = typeof value === "string" ? value.split(",") : Array.isArray(value) ? value : [];
  const next = raw
    .map((lang) => String(lang).trim())
    .filter((lang): lang is SpellcheckLanguage => lang === "de" || lang === "en");
  const unique = Array.from(new Set(next));
  return unique;
};

export const resolveSpellcheckSelection = (
  languages: SpellcheckLanguage[],
  customEnabled: boolean,
): { languages: SpellcheckLanguage[]; customEnabled: boolean } => {
  if (customEnabled) {
    return { languages: [], customEnabled: true };
  }
  if (languages.includes("de")) {
    return { languages: ["de"], customEnabled: false };
  }
  if (languages.includes("en")) {
    return { languages: ["en"], customEnabled: false };
  }
  return { languages: ["de"], customEnabled: false };
};
