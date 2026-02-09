import { beforeEach, describe, expect, it } from "vitest";
import { useTranscriptStore } from "@/lib/store";
import { resetStore } from "./storeTestUtils";

describe("Lexicon slice", () => {
  beforeEach(() => {
    resetStore();
  });

  it("manages lexicon terms and threshold", () => {
    const { addLexiconEntry, removeLexiconEntry, setLexiconThreshold } =
      useTranscriptStore.getState();

    addLexiconEntry("Zwergenbär");
    addLexiconEntry("zwergenbär");
    addLexiconEntry("  ");

    let state = useTranscriptStore.getState();
    expect(state.lexiconEntries).toEqual([
      { term: "Zwergenbär", variants: [], falsePositives: [] },
    ]);

    removeLexiconEntry("ZWErgenbär");
    state = useTranscriptStore.getState();
    expect(state.lexiconEntries).toEqual([]);

    setLexiconThreshold(0.9);
    expect(useTranscriptStore.getState().lexiconThreshold).toBeCloseTo(0.9);
  });

  it("updates a lexicon entry and its variants", () => {
    useTranscriptStore.getState().addLexiconEntry("Glymbar", ["Glimmer"]);

    useTranscriptStore
      .getState()
      .updateLexiconEntry("Glymbar", "Glymbar", ["Glimmer", "Klimbar"], ["Glimmer"]);

    const { lexiconEntries } = useTranscriptStore.getState();
    expect(lexiconEntries).toEqual([
      { term: "Glymbar", variants: ["Glimmer", "Klimbar"], falsePositives: ["Glimmer"] },
    ]);
  });

  it("adds lexicon false positives and clamps thresholds", () => {
    const { setLexiconThreshold, addLexiconEntry, updateLexiconEntry, addLexiconFalsePositive } =
      useTranscriptStore.getState();

    addLexiconEntry("   ");
    updateLexiconEntry("missing", "   ");
    addLexiconFalsePositive("missing", "   ");

    setLexiconThreshold(0.1);
    expect(useTranscriptStore.getState().lexiconThreshold).toBe(0.5);

    setLexiconThreshold(2);
    expect(useTranscriptStore.getState().lexiconThreshold).toBe(0.99);

    expect(useTranscriptStore.getState().lexiconEntries).toEqual([]);
  });

  it("stores session-scoped ignores for uncertain glossary matches", () => {
    const { addLexiconSessionIgnore } = useTranscriptStore.getState();

    addLexiconSessionIgnore("Welt", "Welt");
    addLexiconSessionIgnore("Welt", "Welt");
    addLexiconSessionIgnore("  ", " ");

    expect(useTranscriptStore.getState().lexiconSessionIgnores).toHaveLength(1);
  });
});
