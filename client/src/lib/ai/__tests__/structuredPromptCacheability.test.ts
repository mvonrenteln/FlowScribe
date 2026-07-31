/**
 * Structured Prompt Cacheability Tests
 *
 * Characterization gates proving that the three structured-batch feature
 * system prompts (speaker classification, segment merge, chapter detection)
 * remain free of runtime placeholders. `OpenAIProvider` derives its mandatory
 * prompt-cache key from the exact ordered system-message content, so any
 * runtime value leaking into a system prompt would silently fragment the
 * cache. These tests assert the invariant established by Plans 1 and 2;
 * they intentionally do not change any production prompt code.
 *
 * @module ai/__tests__/structuredPromptCacheability
 */

import { describe, expect, it } from "vitest";
import {
  CHAPTER_DETECTION_SYSTEM_PROMPT,
  CHAPTER_DETECTION_USER_PROMPT_TEMPLATE,
  chapterDetectionConfig,
} from "../features/chapterDetection/config";
import {
  MERGE_ANALYSIS_SYSTEM_PROMPT,
  MERGE_ANALYSIS_USER_TEMPLATE,
  MERGE_ANALYSIS_USER_TEMPLATE_SIMPLE,
  segmentMergeConfig,
} from "../features/segmentMerge/config";
import {
  SPEAKER_SYSTEM_PROMPT,
  SPEAKER_USER_PROMPT_TEMPLATE,
  speakerClassificationConfig,
} from "../features/speaker/config";
import { compileTemplate, extractPlaceholders } from "../prompts/promptBuilder";
import type { PromptVariables } from "../prompts/types";

const runtimeVariablesA: PromptVariables = {
  speakers: "Alice, Bob",
  segments: "1: Hello",
  maxTimeGap: 1,
  enableSmoothing: false,
  batchIndex: 1,
  totalBatches: 2,
  batchSize: 10,
  minChapterLength: 1,
  maxChapterLength: 5,
  tagsAvailable: "intro",
  previousChapter: "",
};

const runtimeVariablesB: PromptVariables = {
  speakers: "Zed, Yara, Xander",
  segments: "42: Completely different transcript content",
  maxTimeGap: 999,
  enableSmoothing: true,
  batchIndex: 7,
  totalBatches: 42,
  batchSize: 500,
  minChapterLength: 20,
  maxChapterLength: 200,
  tagsAvailable: "wrap-up, q-and-a",
  previousChapter: "Chapter 3: The Reckoning",
};

/**
 * Structured feature fixtures under test: each entry pairs a feature's
 * config object with its exported default system-prompt constant and the
 * runtime placeholders that must appear only in its user template.
 */
const structuredFeatures = [
  {
    name: "speaker classification",
    config: speakerClassificationConfig,
    defaultSystemPrompt: SPEAKER_SYSTEM_PROMPT,
    runtimePlaceholders: ["speakers", "segments"],
  },
  {
    name: "segment merge",
    config: segmentMergeConfig,
    defaultSystemPrompt: MERGE_ANALYSIS_SYSTEM_PROMPT,
    runtimePlaceholders: ["segments", "maxTimeGap", "enableSmoothing"],
  },
  {
    name: "chapter detection",
    config: chapterDetectionConfig,
    defaultSystemPrompt: CHAPTER_DETECTION_SYSTEM_PROMPT,
    runtimePlaceholders: [
      "batchIndex",
      "totalBatches",
      "batchSize",
      "minChapterLength",
      "maxChapterLength",
      "tagsAvailable",
      "segments",
      "previousChapter",
    ],
  },
] as const;

describe("structured prompt cacheability", () => {
  describe.each(structuredFeatures)("$name", ({
    config,
    defaultSystemPrompt,
    runtimePlaceholders,
  }) => {
    it("has a system prompt with zero placeholders", () => {
      expect(extractPlaceholders(config.systemPrompt)).toEqual([]);
    });

    it("uses the feature's exported default system-prompt constant unchanged", () => {
      expect(config.systemPrompt).toBe(defaultSystemPrompt);
    });

    it("compiles identically regardless of runtime variable content", () => {
      const compiledA = compileTemplate(config.systemPrompt, runtimeVariablesA);
      const compiledB = compileTemplate(config.systemPrompt, runtimeVariablesB);

      expect(compiledA).toBe(compiledB);
    });

    it("never renders availablePlaceholders as template syntax in the system prompt", () => {
      for (const placeholder of config.availablePlaceholders) {
        expect(config.systemPrompt).not.toContain(`{{${placeholder}}}`);
        expect(config.systemPrompt).not.toContain(`{{#if ${placeholder}}}`);
        expect(config.systemPrompt).not.toContain(`{{#each ${placeholder}}}`);
      }
    });

    it("keeps runtime placeholders in the user template", () => {
      const userPlaceholders = extractPlaceholders(config.userPromptTemplate);

      for (const placeholder of runtimePlaceholders) {
        expect(userPlaceholders).toContain(placeholder);
      }
    });
  });

  describe("speaker classification XML structure (Task 2)", () => {
    it("wraps the response contract and recognition rules in the system prompt, and the dynamic bodies in the user template, each exactly once", () => {
      for (const tag of ["response_contract", "speaker_recognition_rules"]) {
        const openCount = (SPEAKER_SYSTEM_PROMPT.match(new RegExp(`<${tag}>`, "g")) ?? []).length;
        const closeCount = (SPEAKER_SYSTEM_PROMPT.match(new RegExp(`</${tag}>`, "g")) ?? []).length;
        expect(openCount).toBe(1);
        expect(closeCount).toBe(1);
      }

      for (const tag of ["available_speakers", "sections_to_classify"]) {
        const openCount = (SPEAKER_USER_PROMPT_TEMPLATE.match(new RegExp(`<${tag}>`, "g")) ?? [])
          .length;
        const closeCount = (SPEAKER_USER_PROMPT_TEMPLATE.match(new RegExp(`</${tag}>`, "g")) ?? [])
          .length;
        expect(openCount).toBe(1);
        expect(closeCount).toBe(1);
      }
    });

    it("still compiles the system prompt identically regardless of runtime variable content with XML tags present", () => {
      const compiledA = compileTemplate(SPEAKER_SYSTEM_PROMPT, runtimeVariablesA);
      const compiledB = compileTemplate(SPEAKER_SYSTEM_PROMPT, runtimeVariablesB);

      expect(compiledA).toBe(compiledB);
      expect(compiledA).toContain("<response_contract>");
      expect(compiledA).toContain("<speaker_recognition_rules>");
    });
  });

  describe("segment merge XML structure (Task 3)", () => {
    it("wraps merge rules and the response contract in the system prompt, each exactly once", () => {
      for (const tag of ["merge_rules", "response_contract"]) {
        const openCount = (MERGE_ANALYSIS_SYSTEM_PROMPT.match(new RegExp(`<${tag}>`, "g")) ?? [])
          .length;
        const closeCount = (MERGE_ANALYSIS_SYSTEM_PROMPT.match(new RegExp(`</${tag}>`, "g")) ?? [])
          .length;
        expect(openCount).toBe(1);
        expect(closeCount).toBe(1);
      }
    });

    it("wraps {{segments}} and conditional smoothing rules in both built-in user templates, each exactly once", () => {
      for (const template of [MERGE_ANALYSIS_USER_TEMPLATE, MERGE_ANALYSIS_USER_TEMPLATE_SIMPLE]) {
        for (const tag of ["segments_for_context", "smoothing_rules"]) {
          const openCount = (template.match(new RegExp(`<${tag}>`, "g")) ?? []).length;
          const closeCount = (template.match(new RegExp(`</${tag}>`, "g")) ?? []).length;
          expect(openCount).toBe(1);
          expect(closeCount).toBe(1);
        }
      }
    });

    it("still compiles the system prompt identically regardless of runtime variable content with XML tags present", () => {
      const compiledA = compileTemplate(MERGE_ANALYSIS_SYSTEM_PROMPT, runtimeVariablesA);
      const compiledB = compileTemplate(MERGE_ANALYSIS_SYSTEM_PROMPT, runtimeVariablesB);

      expect(compiledA).toBe(compiledB);
      expect(compiledA).toContain("<merge_rules>");
      expect(compiledA).toContain("<response_contract>");
    });
  });

  it("retains runtime placeholders in both segment-merge user-template variants", () => {
    const runtimePlaceholders = ["segments", "maxTimeGap", "enableSmoothing"];

    for (const template of [MERGE_ANALYSIS_USER_TEMPLATE, MERGE_ANALYSIS_USER_TEMPLATE_SIMPLE]) {
      const placeholders = extractPlaceholders(template);

      for (const placeholder of runtimePlaceholders) {
        expect(placeholders).toContain(placeholder);
      }
    }
  });

  describe("chapter detection XML structure (Task 4)", () => {
    it("wraps only the response contract in the system prompt, exactly once", () => {
      const openCount = (CHAPTER_DETECTION_SYSTEM_PROMPT.match(/<response_contract>/g) ?? [])
        .length;
      const closeCount = (CHAPTER_DETECTION_SYSTEM_PROMPT.match(/<\/response_contract>/g) ?? [])
        .length;
      expect(openCount).toBe(1);
      expect(closeCount).toBe(1);
    });

    it("wraps tagsAvailable, previousChapter, and segments in the user template, each exactly once", () => {
      for (const tag of ["available_tag_ids", "previous_chapter_context", "transcript_segments"]) {
        const openCount = (
          CHAPTER_DETECTION_USER_PROMPT_TEMPLATE.match(new RegExp(`<${tag}>`, "g")) ?? []
        ).length;
        const closeCount = (
          CHAPTER_DETECTION_USER_PROMPT_TEMPLATE.match(new RegExp(`</${tag}>`, "g")) ?? []
        ).length;
        expect(openCount).toBe(1);
        expect(closeCount).toBe(1);
      }
    });

    it("omits the previous-chapter-context tag entirely when there is no previous chapter", () => {
      const compiled = compileTemplate(CHAPTER_DETECTION_USER_PROMPT_TEMPLATE, {
        ...runtimeVariablesA,
        previousChapter: "",
      });

      expect(compiled).not.toContain("<previous_chapter_context>");
      expect(compiled).not.toContain("</previous_chapter_context>");
    });

    it("still compiles the system prompt identically regardless of runtime variable content with XML tags present", () => {
      const compiledA = compileTemplate(CHAPTER_DETECTION_SYSTEM_PROMPT, runtimeVariablesA);
      const compiledB = compileTemplate(CHAPTER_DETECTION_SYSTEM_PROMPT, runtimeVariablesB);

      expect(compiledA).toBe(compiledB);
      expect(compiledA).toContain("<response_contract>");
    });
  });

  describe("compiled message stability across sentinel changes", () => {
    it("speaker classification: user message changes, system message stays exact", () => {
      const compiledSystemA = compileTemplate(SPEAKER_SYSTEM_PROMPT, runtimeVariablesA);
      const compiledSystemB = compileTemplate(SPEAKER_SYSTEM_PROMPT, runtimeVariablesB);
      const compiledUserA = compileTemplate(SPEAKER_USER_PROMPT_TEMPLATE, runtimeVariablesA);
      const compiledUserB = compileTemplate(SPEAKER_USER_PROMPT_TEMPLATE, runtimeVariablesB);

      expect(compiledSystemA).toBe(compiledSystemB);
      expect(compiledSystemA).toBe(SPEAKER_SYSTEM_PROMPT.trim());
      expect(compiledUserA).not.toBe(compiledUserB);
    });

    it("segment merge: user message changes, system message stays exact", () => {
      const compiledSystemA = compileTemplate(MERGE_ANALYSIS_SYSTEM_PROMPT, runtimeVariablesA);
      const compiledSystemB = compileTemplate(MERGE_ANALYSIS_SYSTEM_PROMPT, runtimeVariablesB);
      const compiledUserA = compileTemplate(MERGE_ANALYSIS_USER_TEMPLATE, runtimeVariablesA);
      const compiledUserB = compileTemplate(MERGE_ANALYSIS_USER_TEMPLATE, runtimeVariablesB);

      expect(compiledSystemA).toBe(compiledSystemB);
      expect(compiledSystemA).toBe(MERGE_ANALYSIS_SYSTEM_PROMPT.trim());
      expect(compiledUserA).not.toBe(compiledUserB);
    });

    it("chapter detection: user message changes, system message stays exact", () => {
      const compiledSystemA = compileTemplate(CHAPTER_DETECTION_SYSTEM_PROMPT, runtimeVariablesA);
      const compiledSystemB = compileTemplate(CHAPTER_DETECTION_SYSTEM_PROMPT, runtimeVariablesB);
      const compiledUserA = compileTemplate(
        CHAPTER_DETECTION_USER_PROMPT_TEMPLATE,
        runtimeVariablesA,
      );
      const compiledUserB = compileTemplate(
        CHAPTER_DETECTION_USER_PROMPT_TEMPLATE,
        runtimeVariablesB,
      );

      expect(compiledSystemA).toBe(compiledSystemB);
      expect(compiledSystemA).toBe(CHAPTER_DETECTION_SYSTEM_PROMPT.trim());
      expect(compiledUserA).not.toBe(compiledUserB);
    });
  });
});
