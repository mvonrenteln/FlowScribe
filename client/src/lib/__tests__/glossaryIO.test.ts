import { describe, expect, it } from "vitest";
import type { LexiconEntry } from "@/lib/store/types";
import {
  parseGlossaryFile,
  parseList,
  serializeGlossaryFile,
  stripFalsePositiveLabel,
} from "../glossaryIO";

describe("glossaryIO", () => {
  // ---------------------------------------------------------------------------
  // parseList
  // ---------------------------------------------------------------------------
  describe("parseList", () => {
    it("splits comma-separated values and trims whitespace", () => {
      expect(parseList(" foo , bar , baz ")).toEqual(["foo", "bar", "baz"]);
    });

    it("filters empty segments", () => {
      expect(parseList("a,,b,")).toEqual(["a", "b"]);
    });

    it("returns empty array for blank input", () => {
      expect(parseList("  ")).toEqual([]);
    });
  });

  // ---------------------------------------------------------------------------
  // stripFalsePositiveLabel
  // ---------------------------------------------------------------------------
  describe("stripFalsePositiveLabel", () => {
    it("strips a single label", () => {
      expect(stripFalsePositiveLabel("false positives: foo, bar")).toBe("foo, bar");
    });

    it("strips double-nested labels from corrupted export cycles", () => {
      expect(stripFalsePositiveLabel("false positives: false positives: foo")).toBe("foo");
    });

    it("strips triple-nested labels", () => {
      expect(
        stripFalsePositiveLabel("false positives: false positives: false positives: foo"),
      ).toBe("foo");
    });

    it("handles singular 'false positive:' label", () => {
      expect(stripFalsePositiveLabel("false positive: foo")).toBe("foo");
    });

    it("handles leading whitespace", () => {
      expect(stripFalsePositiveLabel("  false positives: foo")).toBe("foo");
    });

    it("returns value unchanged when no label present", () => {
      expect(stripFalsePositiveLabel("foo, bar")).toBe("foo, bar");
    });
  });

  // ---------------------------------------------------------------------------
  // parseGlossaryFile
  // ---------------------------------------------------------------------------
  describe("parseGlossaryFile", () => {
    it("parses term-only lines", () => {
      expect(parseGlossaryFile("Alpha\nBeta")).toEqual([
        { term: "Alpha", variants: [], falsePositives: [] },
        { term: "Beta", variants: [], falsePositives: [] },
      ]);
    });

    it("parses term with variants", () => {
      expect(parseGlossaryFile("Amina | Almina")).toEqual([
        { term: "Amina", variants: ["Almina"], falsePositives: [] },
      ]);
    });

    it("parses term with variants and false positives", () => {
      expect(parseGlossaryFile("Dschinn | Gin, Djin | false positives: ein, drin")).toEqual([
        { term: "Dschinn", variants: ["Gin", "Djin"], falsePositives: ["ein", "drin"] },
      ]);
    });

    it("parses term with false positives but no variants", () => {
      expect(parseGlossaryFile("Gor | false positives: vor, gar")).toEqual([
        { term: "Gor", variants: [], falsePositives: ["vor", "gar"] },
      ]);
    });

    it("handles double false-positive labels from corrupted exports", () => {
      const line = "Glymbar | Limba | false positives: false positives: Lumpen, immer";
      expect(parseGlossaryFile(line)).toEqual([
        { term: "Glymbar", variants: ["Limba"], falsePositives: ["Lumpen", "immer"] },
      ]);
    });

    it("handles duplicated false-positive sections", () => {
      const line = "Chimären | false positives: Chimäre | false positives: Chimäre";
      expect(parseGlossaryFile(line)).toEqual([
        { term: "Chimären", variants: [], falsePositives: ["Chimäre", "Chimäre"] },
      ]);
    });

    it("classifies sections starting with 'false positives:' as fp, not variants", () => {
      const line = "Tierkunde | false positives: erkunden | false positives: Tierpfade";
      const result = parseGlossaryFile(line);
      expect(result[0].variants).toEqual([]);
      expect(result[0].falsePositives).toEqual(["erkunden", "Tierpfade"]);
    });

    it("skips blank lines and trims whitespace", () => {
      expect(parseGlossaryFile("  Alpha  \n\n  Beta  \n")).toEqual([
        { term: "Alpha", variants: [], falsePositives: [] },
        { term: "Beta", variants: [], falsePositives: [] },
      ]);
    });

    it("handles Windows line endings", () => {
      expect(parseGlossaryFile("A\r\nB\r\n")).toEqual([
        { term: "A", variants: [], falsePositives: [] },
        { term: "B", variants: [], falsePositives: [] },
      ]);
    });
  });

  // ---------------------------------------------------------------------------
  // serializeGlossaryFile
  // ---------------------------------------------------------------------------
  describe("serializeGlossaryFile", () => {
    it("serializes term-only entry", () => {
      const entries: LexiconEntry[] = [{ term: "Alpha", variants: [], falsePositives: [] }];
      expect(serializeGlossaryFile(entries)).toBe("Alpha");
    });

    it("serializes entry with variants", () => {
      const entries: LexiconEntry[] = [{ term: "A", variants: ["B", "C"], falsePositives: [] }];
      expect(serializeGlossaryFile(entries)).toBe("A | B, C");
    });

    it("serializes entry with false positives", () => {
      const entries: LexiconEntry[] = [{ term: "A", variants: [], falsePositives: ["x", "y"] }];
      expect(serializeGlossaryFile(entries)).toBe("A | false positives: x, y");
    });

    it("serializes entry with variants and false positives", () => {
      const entries: LexiconEntry[] = [{ term: "A", variants: ["B"], falsePositives: ["x"] }];
      expect(serializeGlossaryFile(entries)).toBe("A | B | false positives: x");
    });

    it("does not inject extra 'false positives:' label into values", () => {
      const entries: LexiconEntry[] = [
        { term: "Sherkan", variants: ["Sher Khan"], falsePositives: ["Schwerter", "heran"] },
      ];
      const line = serializeGlossaryFile(entries);
      expect(line).toBe("Sherkan | Sher Khan | false positives: Schwerter, heran");
      expect(line.match(/false positives:/g)).toHaveLength(1);
    });
  });

  // ---------------------------------------------------------------------------
  // Roundtrip: export → import
  // ---------------------------------------------------------------------------
  describe("roundtrip (export → import)", () => {
    const ENTRIES: LexiconEntry[] = [
      { term: "Amina", variants: ["Almina"], falsePositives: [] },
      { term: "Aurelia", variants: [], falsePositives: [] },
      {
        term: "Borbarad",
        variants: ["Borbra", "Borbara", "Bauberat"],
        falsePositives: ["Borbra."],
      },
      { term: "Chimären", variants: [], falsePositives: ["Chimäre"] },
      {
        term: "Dschinn",
        variants: ["Gin", "Djin"],
        falsePositives: ["ein", "drin", "Ischina"],
      },
      { term: "Gor", variants: [], falsePositives: ["vor", "gar"] },
      {
        term: "Sherkan",
        variants: ["Scherkan", "Sher Khan", "Shere Khan"],
        falsePositives: ["Schwerter", "heran"],
      },
    ];

    it("produces identical entries after one roundtrip", () => {
      const exported = serializeGlossaryFile(ENTRIES);
      const imported = parseGlossaryFile(exported);
      expect(imported).toEqual(ENTRIES);
    });

    it("is stable across multiple roundtrips", () => {
      let entries = ENTRIES;
      for (let cycle = 0; cycle < 5; cycle += 1) {
        const exported = serializeGlossaryFile(entries);
        entries = parseGlossaryFile(exported);
      }
      expect(entries).toEqual(ENTRIES);
    });

    it("recovers clean data from a corrupted file with double labels", () => {
      const corrupted = [
        "Glymbar | Limba | false positives: false positives: Lumpen, immer",
        "Hesinde | Häsinde | false positives: false positives: Hände, Feinde",
        "Gor | false positives: vor, gar | false positives: vor, gar",
      ].join("\n");

      const imported = parseGlossaryFile(corrupted);

      expect(imported[0]).toEqual({
        term: "Glymbar",
        variants: ["Limba"],
        falsePositives: ["Lumpen", "immer"],
      });
      expect(imported[1]).toEqual({
        term: "Hesinde",
        variants: ["Häsinde"],
        falsePositives: ["Hände", "Feinde"],
      });
      expect(imported[2]).toEqual({
        term: "Gor",
        variants: [],
        falsePositives: ["vor", "gar", "vor", "gar"],
      });

      // Re-export must be clean (no double labels)
      const reExported = serializeGlossaryFile(imported);
      expect(reExported).not.toContain("false positives: false positives:");
    });
  });
});
