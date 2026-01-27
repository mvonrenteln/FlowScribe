import { parseResponse } from "../parsing/responseParser";
import type { SimpleSchema } from "../parsing/types";

const truncatedChapters = `{
  "chapters": [
    {
      "title": "Speculation about Chimera Attack and Observations",
      "summary": "The group discusses why the chimeras did not attack and what factors may have influenced their behavior.",
      "tags": ["condense"],
      "start": 1,
      "end": 7,
      "notes": "Relevant background discussion, but contains repetition — can be trimmed."
    },
    {
      "title": "Planning Dinner and Gathering Supplies",
      "summary": "The group decides to prepare a meal from available provisions and organizes the necessary tasks.",
      "tags": ["keep"],
      "start": 8,
      "end": 21,
      "notes": "Core action: meal preparation and role assignments."
    },
    {
      "title": "Rules Discussion About Spells",
      "summary": "Players talk through which spells are available and clarify rule details.",
      "tags": ["delete"],
      "start": 22,
      "end": 38,
      "notes": "Purely meta discussion of spell mechanics; no in-world events."
    },
    {
      "title": "Cooking, Flute Music, and Atmosphere",
      "summary": "Sherkan cooks while Durrandir plays the flute; the group enjoys the meal together.",
      "tags": ["keep"],
      "start": 39,
      "end": 48,
      "notes": "Important narrative moment: shared meal and musical ambiance."
    },
    {
      "title": "Dice Roll and Positioning (See <attachments> above for file contents. You may not need to search or read the file again.)"
`;

describe("reproduce truncated chapters recovery", () => {
  it("recovers complete array items and marks MALFORMED", () => {
    const itemSchema: SimpleSchema = {
      type: "object",
      properties: {
        title: { type: "string" },
        summary: { type: "string" },
        tags: { type: "array", items: { type: "string" } },
        start: { type: "number" },
        end: { type: "number" },
      },
      required: ["title"],
    };

    const schema: SimpleSchema = {
      type: "object",
      properties: { chapters: { type: "array", items: itemSchema } },
      required: ["chapters"],
    };

    const result = parseResponse<{ chapters: unknown[] }>(truncatedChapters, {
      schema,
      recoverPartial: true,
      jsonOptions: { lenient: false },
    });

    expect(result.success).toBe(true);
    expect(result.data).toBeDefined();
    expect(result.metadata.parseStatus).toBe("MALFORMED");
    // Expect the parser to recover the four fully-formed chapter objects
    expect(Array.isArray(result.data!.chapters)).toBe(true);
    expect(result.data!.chapters.length).toBe(4);
  });
});
