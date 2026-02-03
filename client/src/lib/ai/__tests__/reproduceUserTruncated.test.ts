import { describe, expect, it } from "vitest";
import { parseResponse } from "@/lib/ai/parsing/responseParser";
import type { SimpleSchema } from "../parsing/types";

describe("reproduce truncated chapters (user sample)", () => {
  it("recovers chapters and marks MALFORMED instead of fatal", () => {
    const truncated = `{
  "chapters": [
    {
      "title": "Biestbeschreibung & Durrandirs erster Plan",
      "summary": "Marc beschreibt das bedrohliche Biest, Daniel erklärt Durrandirs Überlegung, ob es zerstört oder kontaktiert werden soll.",
      "tags": ["keep"],
      "start": 1,
      "end": 5,
      "notes": "Einführung des Antagonisten und Durrandirs Grundmotivation – essentiell für die Geschichte."
    },
    {
      "title": "Durrandirs Zauber und Unsicherheit",
      "summary": "Durrandir bereitet seine Aktionen vor, wirft Zweifel auf das Zeichen des Biests und plant einen Zauber für die Pfeile.",
      "tags": ["keep"],
      "start": 6,
      "end": 10,
      "notes": "Wichtig für das kommende Kampfsetup, zeigt Durrandirs Vorgehensweise."
    },
    {
      "title": "Pfeilverwand",
      "summary": "...",
      "tags": ["keep"],
      "start": 11,
      "end": 15,
      "notes": "Starts here but truncated..."
    }
    `;

    const schema = {
      type: "object",
      properties: {
        chapters: {
          type: "array",
          items: {
            type: "object",
            properties: {
              title: { type: "string" },
              summary: { type: "string" },
              tags: { type: "array", items: { type: "string" } },
              start: { type: "number" },
              end: { type: "number" },
              notes: { type: "string" },
            },
            required: ["title", "start", "end"],
          },
        },
      },
      required: ["chapters"],
    } as const;

    const schemaTyped: SimpleSchema = schema as unknown as SimpleSchema;

    const result = parseResponse<{ chapters: unknown[] }>(truncated, {
      schema: schemaTyped,
      jsonOptions: { lenient: true },
      recoverPartial: true,
    });

    expect(result.success).toBe(true);
    expect(result.data).toBeDefined();
    expect(result.metadata.parseStatus).toBe("MALFORMED");
    expect(result.data?.chapters.length).toBeGreaterThanOrEqual(2);
  });
});
