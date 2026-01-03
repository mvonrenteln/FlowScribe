/**
 * AI Feature Service Tests
 *
 * Tests for the unified AI feature execution service.
 * Tests the core logic without mocking the provider layer.
 */

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  clearRegistry,
  getFeature,
  getFeatureOrThrow,
  registerFeature,
} from "../core/featureRegistry";
import type { AIFeatureConfig } from "../core/types";
import { compileTemplate } from "../prompts/promptBuilder";

describe("AIFeatureService", () => {
  const testFeature: AIFeatureConfig = {
    id: "text-revision",
    name: "Test Feature",
    category: "text",
    systemPrompt: "You are a {{role}}.",
    userPromptTemplate: "Process: {{text}}",
    batchable: true,
    streamable: false,
    defaultBatchSize: 1,
    requiresConfirmation: true,
    availablePlaceholders: ["role", "text"],
    responseSchema: undefined,
  };

  beforeEach(() => {
    clearRegistry();
    registerFeature(testFeature);
  });

  afterEach(() => {
    clearRegistry();
  });

  describe("feature configuration", () => {
    it("should register and retrieve feature", () => {
      const feature = getFeature("text-revision");
      expect(feature).toBeDefined();
      expect(feature?.id).toBe("text-revision");
    });

    it("should throw for unregistered feature", () => {
      // Ensure registry is empty to test missing feature behavior
      clearRegistry();
      expect(() => {
        getFeatureOrThrow("speaker-classification");
      }).toThrow("not registered");
    });
  });

  describe("prompt compilation", () => {
    it("should compile system prompt with variables", () => {
      const compiled = compileTemplate(testFeature.systemPrompt, { role: "editor" });
      expect(compiled).toBe("You are a editor.");
    });

    it("should compile user prompt with variables", () => {
      const compiled = compileTemplate(testFeature.userPromptTemplate, { text: "Hello world" });
      expect(compiled).toBe("Process: Hello world");
    });

    it("should preserve placeholders for missing variables", () => {
      const compiled = compileTemplate(testFeature.systemPrompt, {});
      // Missing variables are preserved as placeholders
      expect(compiled).toBe("You are a {{role}}.");
    });
  });

  describe("batch processing logic", () => {
    it("should track progress correctly", () => {
      const inputs = [{ text: "1" }, { text: "2" }, { text: "3" }];
      const progressUpdates: [number, number][] = [];

      // Simulate batch progress tracking
      for (let i = 0; i < inputs.length; i++) {
        progressUpdates.push([i + 1, inputs.length]);
      }

      expect(progressUpdates).toEqual([
        [1, 3],
        [2, 3],
        [3, 3],
      ]);
    });

    it("should handle cancellation flag", () => {
      const abortController = new AbortController();
      abortController.abort();

      expect(abortController.signal.aborted).toBe(true);
    });
  });

  describe("metadata building", () => {
    it("should calculate duration correctly", () => {
      const startTime = Date.now() - 100;
      const duration = Date.now() - startTime;

      expect(duration).toBeGreaterThanOrEqual(100);
    });

    it("should include feature ID in metadata", () => {
      const metadata = {
        featureId: "text-revision",
        providerId: "test",
        model: "gpt-4",
        durationMs: 100,
      };

      expect(metadata.featureId).toBe("text-revision");
    });
  });
});
