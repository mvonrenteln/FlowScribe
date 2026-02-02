/**
 * Feature Registry Tests
 *
 * Tests for the AI feature registration system.
 */

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  clearRegistry,
  getAllFeatures,
  getFeature,
  getFeatureOrThrow,
  getFeaturesByCategory,
  getRegistrySize,
  hasFeature,
  registerDefaultFeatures,
  registerFeature,
  unregisterFeature,
} from "../core/featureRegistry";
import type { AIFeatureConfig, AIFeatureType } from "../core/types";

describe("Feature Registry", () => {
  // Clear registry before each test
  beforeEach(() => {
    clearRegistry();
  });

  afterEach(() => {
    clearRegistry();
  });

  const testFeature: AIFeatureConfig = {
    id: "text-revision",
    name: "Text Revision",
    category: "text",
    systemPrompt: "You are an editor.",
    userPromptTemplate: "Edit: {{text}}",
    batchable: true,
    streamable: false,
    defaultBatchSize: 1,
    requiresConfirmation: true,
    availablePlaceholders: ["text"],
  };

  const anotherFeature: AIFeatureConfig = {
    id: "speaker-classification",
    name: "Speaker Classification",
    category: "metadata",
    systemPrompt: "You classify speakers.",
    userPromptTemplate: "Classify: {{segments}}",
    batchable: true,
    streamable: false,
    defaultBatchSize: 15,
    requiresConfirmation: true,
    availablePlaceholders: ["segments", "speakers"],
  };

  const unregisteredFeatureId: AIFeatureType = "segment-merge";

  describe("registerFeature", () => {
    it("should register a new feature", () => {
      registerFeature(testFeature);
      expect(hasFeature("text-revision")).toBe(true);
    });

    it("should throw when registering duplicate", () => {
      registerFeature(testFeature);
      expect(() => registerFeature(testFeature)).toThrow("already registered");
    });

    it("should allow registering multiple features", () => {
      registerFeature(testFeature);
      registerFeature(anotherFeature);
      expect(getRegistrySize()).toBe(2);
    });
  });

  describe("getFeature", () => {
    it("should return registered feature", () => {
      registerFeature(testFeature);
      const feature = getFeature("text-revision");
      expect(feature).toEqual(testFeature);
    });

    it("should return undefined for unregistered feature", () => {
      const feature = getFeature(unregisteredFeatureId);
      expect(feature).toBeUndefined();
    });
  });

  describe("getFeatureOrThrow", () => {
    it("should return registered feature", () => {
      registerFeature(testFeature);
      const feature = getFeatureOrThrow("text-revision");
      expect(feature).toEqual(testFeature);
    });

    it("should throw for unregistered feature", () => {
      expect(() => getFeatureOrThrow(unregisteredFeatureId)).toThrow("not registered");
    });
  });

  describe("hasFeature", () => {
    it("should return true for registered feature", () => {
      registerFeature(testFeature);
      expect(hasFeature("text-revision")).toBe(true);
    });

    it("should return false for unregistered feature", () => {
      expect(hasFeature("text-revision")).toBe(false);
    });
  });

  describe("getAllFeatures", () => {
    it("should return empty array when no features registered", () => {
      expect(getAllFeatures()).toEqual([]);
    });

    it("should return all registered features", () => {
      registerFeature(testFeature);
      registerFeature(anotherFeature);

      const features = getAllFeatures();
      expect(features).toHaveLength(2);
      expect(features.map((f) => f.id)).toContain("text-revision");
      expect(features.map((f) => f.id)).toContain("speaker-classification");
    });
  });

  describe("getFeaturesByCategory", () => {
    it("should return features of specified category", () => {
      registerFeature(testFeature);
      registerFeature(anotherFeature);

      const textFeatures = getFeaturesByCategory("text");
      expect(textFeatures).toHaveLength(1);
      expect(textFeatures[0].id).toBe("text-revision");

      const metadataFeatures = getFeaturesByCategory("metadata");
      expect(metadataFeatures).toHaveLength(1);
      expect(metadataFeatures[0].id).toBe("speaker-classification");
    });

    it("should return empty array for category with no features", () => {
      registerFeature(testFeature);
      const exportFeatures = getFeaturesByCategory("export");
      expect(exportFeatures).toEqual([]);
    });
  });

  describe("unregisterFeature", () => {
    it("should remove registered feature", () => {
      registerFeature(testFeature);
      expect(hasFeature("text-revision")).toBe(true);

      const removed = unregisterFeature("text-revision");
      expect(removed).toBe(true);
      expect(hasFeature("text-revision")).toBe(false);
    });

    it("should return false for unregistered feature", () => {
      const removed = unregisterFeature(unregisteredFeatureId);
      expect(removed).toBe(false);
    });
  });

  describe("clearRegistry", () => {
    it("should remove all features", () => {
      registerFeature(testFeature);
      registerFeature(anotherFeature);
      expect(getRegistrySize()).toBe(2);

      clearRegistry();
      expect(getRegistrySize()).toBe(0);
      expect(getAllFeatures()).toEqual([]);
    });
  });

  describe("getRegistrySize", () => {
    it("should return correct count", () => {
      expect(getRegistrySize()).toBe(0);

      registerFeature(testFeature);
      expect(getRegistrySize()).toBe(1);

      registerFeature(anotherFeature);
      expect(getRegistrySize()).toBe(2);
    });
  });

  describe("registerDefaultFeatures", () => {
    it("should register built-in features including chapter reformulation", () => {
      registerDefaultFeatures();

      expect(hasFeature("speaker-classification")).toBe(true);
      expect(hasFeature("text-revision")).toBe(true);
      expect(hasFeature("segment-merge")).toBe(true);
      expect(hasFeature("chapter-reformulation")).toBe(true);
    });
  });
});
