import { normalizeTranscript } from "@/lib/transcript/normalizeTranscript";

describe("normalizeTranscript", () => {
  it("ensures segments have tags array when missing or undefined", () => {
    const input: unknown = {
      id: "t1",
      segments: [
        { id: "s1", text: "one", tags: undefined },
        { id: "s2", text: "two" },
      ],
    };

    const out = normalizeTranscript(input as any);

    expect(out.segments[0].tags).toEqual([]);
    expect(out.segments[1].tags).toEqual([]);
  });
});
