/**
 * @vitest-environment jsdom
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  createLogger,
  disableFeatureDebug,
  disableGlobalDebug,
  enableFeatureDebug,
  enableGlobalDebug,
} from "../loggingService";

describe("AILogger", () => {
  beforeEach(() => {
    // Reset global debug flags
    disableGlobalDebug();
    disableFeatureDebug("TestFeature");

    // Spy on console methods
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("Basic Logging", () => {
    it("should log info messages", () => {
      const logger = createLogger({ feature: "TestFeature" });
      logger.info("Test message");

      expect(console.log).toHaveBeenCalledWith("[AI:TestFeature]", "Test message");
    });

    it("should log warn messages", () => {
      const logger = createLogger({ feature: "TestFeature" });
      logger.warn("Warning message");

      expect(console.warn).toHaveBeenCalledWith("[AI:TestFeature]", "Warning message");
    });

    it("should log error messages", () => {
      const logger = createLogger({ feature: "TestFeature" });
      logger.error("Error message");

      expect(console.error).toHaveBeenCalledWith("[AI:TestFeature]", "Error message");
    });

    it("should include context when provided", () => {
      const logger = createLogger({ feature: "TestFeature" });
      const context = { count: 42, status: "ok" };
      logger.info("With context", context);

      expect(console.log).toHaveBeenCalledWith("[AI:TestFeature]", "With context", context);
    });
  });

  describe("Debug Mode", () => {
    it("should not log debug messages by default", () => {
      const logger = createLogger({ feature: "TestFeature" });
      logger.debug("Debug message");

      expect(console.log).not.toHaveBeenCalled();
    });

    it("should log debug messages when global debug is enabled", () => {
      enableGlobalDebug();
      const logger = createLogger({ feature: "TestFeature" });
      logger.debug("Debug message");

      expect(console.log).toHaveBeenCalledWith("[AI:TestFeature][DEBUG]", "Debug message");
    });

    it("should log debug messages when feature debug is enabled", () => {
      enableFeatureDebug("TestFeature");
      const logger = createLogger({ feature: "TestFeature" });
      logger.debug("Debug message");

      expect(console.log).toHaveBeenCalledWith("[AI:TestFeature][DEBUG]", "Debug message");
    });

    it("should respect isDebugEnabled property", () => {
      const logger = createLogger({ feature: "TestFeature" });
      expect(logger.isDebugEnabled).toBe(false);

      enableFeatureDebug("TestFeature");
      expect(logger.isDebugEnabled).toBe(true);

      disableFeatureDebug("TestFeature");
      enableGlobalDebug();
      expect(logger.isDebugEnabled).toBe(true);
    });
  });

  describe("Log Level Filtering", () => {
    it("should respect minimum log level", () => {
      const logger = createLogger({ feature: "TestFeature", minLevel: "warn" });

      logger.info("Info message");
      expect(console.log).not.toHaveBeenCalled();

      logger.warn("Warn message");
      expect(console.warn).toHaveBeenCalled();
    });

    it("should allow debug when minLevel is debug and debug is enabled", () => {
      enableFeatureDebug("TestFeature");
      const logger = createLogger({ feature: "TestFeature", minLevel: "debug" });

      logger.debug("Debug message");
      expect(console.log).toHaveBeenCalled();
    });
  });

  describe("Feature Isolation", () => {
    it("should not enable debug for other features", () => {
      enableFeatureDebug("Feature1");

      const logger1 = createLogger({ feature: "Feature1" });
      const logger2 = createLogger({ feature: "Feature2" });

      logger1.debug("Feature 1 debug");
      expect(console.log).toHaveBeenCalledTimes(1);

      logger2.debug("Feature 2 debug");
      expect(console.log).toHaveBeenCalledTimes(1); // Still 1, not 2
    });

    it("should use different prefixes for different features", () => {
      const logger1 = createLogger({ feature: "Feature1" });
      const logger2 = createLogger({ feature: "Feature2" });

      logger1.info("Message 1");
      expect(console.log).toHaveBeenCalledWith("[AI:Feature1]", "Message 1");

      logger2.info("Message 2");
      expect(console.log).toHaveBeenCalledWith("[AI:Feature2]", "Message 2");
    });
  });
});
