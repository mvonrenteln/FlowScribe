/**
 * Settings Storage Tests
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  addProviderToSettings,
  DEFAULT_SETTINGS,
  getDefaultProvider,
  initializeSettings,
  type PersistedSettings,
  readSettings,
  removeProviderFromSettings,
  updateProviderInSettings,
  writeSettings,
} from "../settingsStorage";

describe("settingsStorage", () => {
  let localStorageMock: Record<string, string>;

  beforeEach(() => {
    localStorageMock = {};
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(
      (key) => localStorageMock[key] ?? null,
    );
    vi.spyOn(Storage.prototype, "setItem").mockImplementation((key, value) => {
      localStorageMock[key] = value;
    });
    vi.spyOn(Storage.prototype, "removeItem").mockImplementation((key) => {
      delete localStorageMock[key];
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("readSettings", () => {
    it("returns null when no settings stored", () => {
      expect(readSettings()).toBeNull();
    });

    it("returns null for invalid JSON", () => {
      localStorageMock["flowscribe:settings"] = "not json";
      expect(readSettings()).toBeNull();
    });

    it("returns null for wrong version", () => {
      localStorageMock["flowscribe:settings"] = JSON.stringify({ version: 999 });
      expect(readSettings()).toBeNull();
    });

    it("returns parsed settings for valid data", () => {
      const settings: PersistedSettings = {
        ...DEFAULT_SETTINGS,
        aiBatchSize: 20,
      };
      localStorageMock["flowscribe:settings"] = JSON.stringify(settings);

      const result = readSettings();
      expect(result).not.toBeNull();
      expect(result?.aiBatchSize).toBe(20);
    });
  });

  describe("writeSettings", () => {
    it("writes settings to localStorage", () => {
      const settings: PersistedSettings = {
        ...DEFAULT_SETTINGS,
        aiBatchSize: 15,
      };

      const result = writeSettings(settings);
      expect(result).toBe(true);

      const stored = JSON.parse(localStorageMock["flowscribe:settings"]);
      expect(stored.aiBatchSize).toBe(15);
    });
  });

  describe("initializeSettings", () => {
    it("returns existing settings if present", () => {
      const existing: PersistedSettings = {
        ...DEFAULT_SETTINGS,
        aiBatchSize: 25,
      };
      localStorageMock["flowscribe:settings"] = JSON.stringify(existing);

      const result = initializeSettings();
      expect(result.aiBatchSize).toBe(25);
    });

    it("returns defaults when no settings exist", () => {
      const result = initializeSettings();
      expect(result.version).toBe(1);
      expect(result.aiProviders.length).toBeGreaterThan(0);
    });

    it("migrates from legacy global state", () => {
      localStorageMock["flowscribe:global"] = JSON.stringify({
        aiSpeakerConfig: {
          ollamaUrl: "http://custom:11434",
          model: "mistral",
          batchSize: 5,
        },
      });

      const result = initializeSettings();
      expect(result.aiProviders[0].baseUrl).toBe("http://custom:11434");
      expect(result.aiProviders[0].model).toBe("mistral");
      expect(result.aiBatchSize).toBe(5);
      expect(result.migratedFromLegacy).toBe(true);
    });
  });

  describe("getDefaultProvider", () => {
    it("returns provider by defaultAIProviderId", () => {
      const settings: PersistedSettings = {
        ...DEFAULT_SETTINGS,
        aiProviders: [
          { id: "a", type: "ollama", name: "A", baseUrl: "http://a", model: "m" },
          { id: "b", type: "ollama", name: "B", baseUrl: "http://b", model: "m" },
        ],
        defaultAIProviderId: "b",
      };

      const result = getDefaultProvider(settings);
      expect(result?.id).toBe("b");
    });

    it("falls back to isDefault flag", () => {
      const settings: PersistedSettings = {
        ...DEFAULT_SETTINGS,
        aiProviders: [
          { id: "a", type: "ollama", name: "A", baseUrl: "http://a", model: "m" },
          { id: "b", type: "ollama", name: "B", baseUrl: "http://b", model: "m", isDefault: true },
        ],
        defaultAIProviderId: undefined,
      };

      const result = getDefaultProvider(settings);
      expect(result?.id).toBe("b");
    });

    it("falls back to first provider", () => {
      const settings: PersistedSettings = {
        ...DEFAULT_SETTINGS,
        aiProviders: [
          { id: "a", type: "ollama", name: "A", baseUrl: "http://a", model: "m" },
          { id: "b", type: "ollama", name: "B", baseUrl: "http://b", model: "m" },
        ],
        defaultAIProviderId: undefined,
      };

      const result = getDefaultProvider(settings);
      expect(result?.id).toBe("a");
    });

    it("returns null for empty providers", () => {
      const settings: PersistedSettings = {
        ...DEFAULT_SETTINGS,
        aiProviders: [],
      };

      const result = getDefaultProvider(settings);
      expect(result).toBeNull();
    });
  });

  describe("updateProviderInSettings", () => {
    it("updates existing provider", () => {
      const settings: PersistedSettings = {
        ...DEFAULT_SETTINGS,
        aiProviders: [{ id: "a", type: "ollama", name: "A", baseUrl: "http://a", model: "m1" }],
      };

      const result = updateProviderInSettings(settings, "a", { model: "m2" });
      expect(result.aiProviders[0].model).toBe("m2");
      expect(result.aiProviders[0].name).toBe("A");
    });

    it("does not modify other providers", () => {
      const settings: PersistedSettings = {
        ...DEFAULT_SETTINGS,
        aiProviders: [
          { id: "a", type: "ollama", name: "A", baseUrl: "http://a", model: "m1" },
          { id: "b", type: "ollama", name: "B", baseUrl: "http://b", model: "m1" },
        ],
      };

      const result = updateProviderInSettings(settings, "a", { name: "Updated" });
      expect(result.aiProviders[0].name).toBe("Updated");
      expect(result.aiProviders[1].name).toBe("B");
    });
  });

  describe("addProviderToSettings", () => {
    it("adds new provider", () => {
      const settings: PersistedSettings = {
        ...DEFAULT_SETTINGS,
        aiProviders: [],
      };

      const result = addProviderToSettings(settings, {
        id: "new",
        type: "openai",
        name: "New Provider",
        baseUrl: "https://api.openai.com/v1",
        model: "gpt-4o",
        apiKey: "sk-test",
      });

      expect(result.aiProviders).toHaveLength(1);
      expect(result.aiProviders[0].name).toBe("New Provider");
    });

    it("sets default when marked as default", () => {
      const settings: PersistedSettings = {
        ...DEFAULT_SETTINGS,
        aiProviders: [
          { id: "a", type: "ollama", name: "A", baseUrl: "http://a", model: "m", isDefault: true },
        ],
        defaultAIProviderId: "a",
      };

      const result = addProviderToSettings(settings, {
        id: "b",
        type: "openai",
        name: "B",
        baseUrl: "https://api.openai.com/v1",
        model: "gpt-4o",
        isDefault: true,
      });

      expect(result.aiProviders[0].isDefault).toBe(false);
      expect(result.aiProviders[1].isDefault).toBe(true);
      expect(result.defaultAIProviderId).toBe("b");
    });
  });

  describe("removeProviderFromSettings", () => {
    it("removes provider", () => {
      const settings: PersistedSettings = {
        ...DEFAULT_SETTINGS,
        aiProviders: [
          { id: "a", type: "ollama", name: "A", baseUrl: "http://a", model: "m" },
          { id: "b", type: "ollama", name: "B", baseUrl: "http://b", model: "m" },
        ],
      };

      const result = removeProviderFromSettings(settings, "a");
      expect(result.aiProviders).toHaveLength(1);
      expect(result.aiProviders[0].id).toBe("b");
    });

    it("updates default when removing default provider", () => {
      const settings: PersistedSettings = {
        ...DEFAULT_SETTINGS,
        aiProviders: [
          { id: "a", type: "ollama", name: "A", baseUrl: "http://a", model: "m" },
          { id: "b", type: "ollama", name: "B", baseUrl: "http://b", model: "m" },
        ],
        defaultAIProviderId: "a",
      };

      const result = removeProviderFromSettings(settings, "a");
      expect(result.defaultAIProviderId).toBe("b");
    });
  });
});
