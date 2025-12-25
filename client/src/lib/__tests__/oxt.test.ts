import JSZip from "jszip";
import { describe, expect, it } from "vitest";
import { extractHunspellFromOxt, listHunspellPairsFromOxt } from "@/lib/oxt";

describe("extractHunspellFromOxt", () => {
  it("extracts a hunspell dictionary pair", async () => {
    const zip = new JSZip();
    zip.file("dictionaries/de_DE.aff", "AFF");
    zip.file("dictionaries/de_DE.dic", "DIC");
    const buffer = await zip.generateAsync({ type: "arraybuffer" });

    const result = await extractHunspellFromOxt(buffer);

    expect(result.name.toLowerCase()).toContain("de");
    expect(result.aff).toBe("AFF");
    expect(result.dic).toBe("DIC");
  });

  it("lists multiple hunspell pairs", async () => {
    const zip = new JSZip();
    zip.file("dictionaries/first.aff", "AFF1");
    zip.file("dictionaries/first.dic", "DIC1");
    zip.file("dictionaries/second.aff", "AFF2");
    zip.file("dictionaries/second.dic", "DIC2");
    const buffer = await zip.generateAsync({ type: "arraybuffer" });

    const pairs = await listHunspellPairsFromOxt(buffer);

    expect(pairs.map((pair) => pair.name)).toEqual(["first", "second"]);
  });
});
