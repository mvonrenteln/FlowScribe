import { describe, expect, it } from "vitest";
import type { AIRevisionConfig, AISpeakerConfig } from "@/lib/store/types";
import {
  arePersistenceSelectionsEqual,
  getPersistTimeBucket,
  type PersistenceSelection,
} from "@/lib/store/utils/persistenceSelector";

const baseSpeakerConfig: AISpeakerConfig = {
  ollamaUrl: "",
  model: "",
  batchSize: 1,
  prompts: [],
  activePromptId: "",
};

const baseRevisionConfig: AIRevisionConfig = {
  prompts: [],
  defaultPromptId: null,
  quickAccessPromptIds: [],
};

const baseSelection: PersistenceSelection = {
  sessionKey: "session-1",
  audioRef: null,
  transcriptRef: null,
  segments: [],
  speakers: [],
  tags: [],
  chapters: [],
  selectedSegmentId: null,
  selectedChapterId: null,
  currentTime: 0,
  currentTimeBucket: 0,
  isPlaying: false,
  isWhisperXFormat: false,
  sessionKind: "current",
  sessionLabel: null,
  baseSessionKey: null,
  lexiconEntries: [],
  lexiconThreshold: 0.5,
  lexiconHighlightUnderline: false,
  lexiconHighlightBackground: false,
  lexiconSessionIgnores: [],
  spellcheckEnabled: false,
  spellcheckLanguages: [],
  spellcheckIgnoreWords: [],
  spellcheckCustomEnabled: false,
  aiSpeakerConfig: baseSpeakerConfig,
  aiRevisionConfig: baseRevisionConfig,
};

describe("getPersistTimeBucket", () => {
  it("buckets playing time by the playing threshold", () => {
    expect(getPersistTimeBucket(0.9, true)).toBe(0);
    expect(getPersistTimeBucket(1.0, true)).toBe(1);
    expect(getPersistTimeBucket(2.4, true)).toBe(2);
  });

  it("buckets paused time by the paused threshold", () => {
    expect(getPersistTimeBucket(0.24, false)).toBe(0);
    expect(getPersistTimeBucket(0.25, false)).toBe(1);
    expect(getPersistTimeBucket(1.01, false)).toBe(4);
  });
});

describe("arePersistenceSelectionsEqual", () => {
  it("ignores small time changes within the same bucket", () => {
    const left: PersistenceSelection = { ...baseSelection, currentTimeBucket: 4 };
    const right: PersistenceSelection = { ...baseSelection, currentTimeBucket: 4 };
    expect(arePersistenceSelectionsEqual(left, right)).toBe(true);
  });

  it("detects changes to persisted selection fields", () => {
    const updated = { ...baseSelection, selectedSegmentId: "seg-2" };
    expect(arePersistenceSelectionsEqual(baseSelection, updated)).toBe(false);
  });
});
