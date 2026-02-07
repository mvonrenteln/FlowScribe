/**
 * OpenAI Provider Helpers Tests
 */

import { describe, expect, it } from "vitest";
import { isGpt5Model, normalizeOpenAITemperature } from "../openai";

describe("OpenAI provider helpers", () => {
  describe("isGpt5Model", () => {
    it("detects GPT-5 model variants", () => {
      expect(isGpt5Model("gpt-5")).toBe(true);
      expect(isGpt5Model("gpt-5-mini")).toBe(true);
      expect(isGpt5Model("gpt-5-codex")).toBe(true);
      expect(isGpt5Model("gpt-5.1")).toBe(true);
      expect(isGpt5Model("GPT-5-CODEX")).toBe(true);
    });

    it("returns false for non-GPT-5 models", () => {
      expect(isGpt5Model("gpt-4o")).toBe(false);
      expect(isGpt5Model("o1")).toBe(false);
      expect(isGpt5Model("llama3.2")).toBe(false);
    });
  });

  describe("normalizeOpenAITemperature", () => {
    it("forces temperature to 1 for GPT-5 models", () => {
      expect(normalizeOpenAITemperature("gpt-5-mini", 0.2)).toBe(1);
      expect(normalizeOpenAITemperature("gpt-5", 2)).toBe(1);
    });

    it("clamps temperature for non-GPT-5 models", () => {
      expect(normalizeOpenAITemperature("gpt-4o", -1)).toBe(0);
      expect(normalizeOpenAITemperature("gpt-4o", 3)).toBe(2);
      expect(normalizeOpenAITemperature("gpt-4o", 0.55)).toBe(0.55);
    });
  });
});
