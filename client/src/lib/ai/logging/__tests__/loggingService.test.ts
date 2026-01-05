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
  let logSpy: ReturnType<typeof vi.spyOn>;
  let debugSpy: ReturnType<typeof vi.spyOn>;
  let infoSpy: ReturnType<typeof vi.spyOn>;
  let warnSpy: ReturnType<typeof vi.spyOn>;
  let errorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    // Reset global debug flags
    disableGlobalDebug();
    disableFeatureDebug("TestFeature");

    // Spy on console methods
    logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    debugSpy = vi.spyOn(console, "debug").mockImplementation(() => {});
    infoSpy = vi.spyOn(console, "info").mockImplementation(() => {});
    warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("Basic Logging", () => {
    it("should log info messages", () => {
      const logger = createLogger({ feature: "TestFeature" });
      logger.info("Test message");

      expect(infoSpy).toHaveBeenCalledWith("[AI:TestFeature]", "Test message");
    });

    it("should log warn messages", () => {
      const logger = createLogger({ feature: "TestFeature" });
      logger.warn("Warning message");

      expect(warnSpy).toHaveBeenCalledWith("[AI:TestFeature]", "Warning message");
    });

    it("should log error messages", () => {
      const logger = createLogger({ feature: "TestFeature" });
      logger.error("Error message");

      expect(errorSpy).toHaveBeenCalledWith("[AI:TestFeature]", "Error message");
    });

    it("should include context when provided", () => {
      const logger = createLogger({ feature: "TestFeature" });
      const context = { count: 42, status: "ok" };
      logger.info("With context", context);

      expect(infoSpy).toHaveBeenCalledWith("[AI:TestFeature]", "With context", context);
    });
  });

  describe("Debug Mode", () => {
    it("should not log debug messages by default", () => {
      const logger = createLogger({ feature: "TestFeature" });
      logger.debug("Debug message");

      expect(logSpy).not.toHaveBeenCalled();
      expect(debugSpy).not.toHaveBeenCalled();
    });

    it("should log debug messages when global debug is enabled", () => {
      enableGlobalDebug();
      const logger = createLogger({ feature: "TestFeature" });
      logger.debug("Debug message");

      const debugCalls = [...logSpy.mock.calls, ...debugSpy.mock.calls];
      expect(debugCalls).toContainEqual(["[AI:TestFeature][DEBUG]", "Debug message"]);
    });

    it("should log debug messages when feature debug is enabled", () => {
      enableFeatureDebug("TestFeature");
      const logger = createLogger({ feature: "TestFeature" });
      logger.debug("Debug message");

      const debugCalls = [...logSpy.mock.calls, ...debugSpy.mock.calls];
      expect(debugCalls).toContainEqual(["[AI:TestFeature][DEBUG]", "Debug message"]);
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
      expect(infoSpy).not.toHaveBeenCalled();

      logger.warn("Warn message");
      expect(warnSpy).toHaveBeenCalled();
    });

    it("should allow debug when minLevel is debug and debug is enabled", () => {
      enableFeatureDebug("TestFeature");
      const logger = createLogger({ feature: "TestFeature", minLevel: "debug" });

      logger.debug("Debug message");
      expect([...logSpy.mock.calls, ...debugSpy.mock.calls].length).toBeGreaterThan(0);
    });
  });

  describe("Feature Isolation", () => {
    it("should not enable debug for other features", () => {
      enableFeatureDebug("Feature1");

      const logger1 = createLogger({ feature: "Feature1" });
      const logger2 = createLogger({ feature: "Feature2" });

      logger1.debug("Feature 1 debug");
      expect([...logSpy.mock.calls, ...debugSpy.mock.calls]).toHaveLength(1);

      logger2.debug("Feature 2 debug");
      expect([...logSpy.mock.calls, ...debugSpy.mock.calls]).toHaveLength(1);
    });

    it("should use different prefixes for different features", () => {
      const logger1 = createLogger({ feature: "Feature1" });
      const logger2 = createLogger({ feature: "Feature2" });

      logger1.info("Message 1");
      expect(infoSpy).toHaveBeenCalledWith("[AI:Feature1]", "Message 1");

      logger2.info("Message 2");
      expect(infoSpy).toHaveBeenCalledWith("[AI:Feature2]", "Message 2");
    });
  });
});
