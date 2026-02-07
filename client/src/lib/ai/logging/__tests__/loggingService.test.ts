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
  getLogLevel,
} from "@/lib/logging";

describe("AILogger", () => {
  beforeEach(() => {
    // Reset global debug flags
    disableGlobalDebug();
    disableFeatureDebug("TestFeature");
    getLogLevel().setLevel("info");
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("Basic Logging", () => {
    it("should log info messages", () => {
      const logger = createLogger({ feature: "TestFeature" });
      const infoSpy = vi
        .spyOn(getLogLevel().getLogger("AI:TestFeature"), "info")
        .mockImplementation(() => {});
      logger.info("Test message");

      expect(infoSpy).toHaveBeenCalledWith("[AI:TestFeature]", "Test message");
    });

    it("should log warn messages", () => {
      const logger = createLogger({ feature: "TestFeature" });
      const warnSpy = vi
        .spyOn(getLogLevel().getLogger("AI:TestFeature"), "warn")
        .mockImplementation(() => {});
      logger.warn("Warning message");

      expect(warnSpy).toHaveBeenCalledWith("[AI:TestFeature]", "Warning message");
    });

    it("should log error messages", () => {
      const logger = createLogger({ feature: "TestFeature" });
      const errorSpy = vi
        .spyOn(getLogLevel().getLogger("AI:TestFeature"), "error")
        .mockImplementation(() => {});
      logger.error("Error message");

      expect(errorSpy).toHaveBeenCalledWith("[AI:TestFeature]", "Error message");
    });

    it("should include context when provided", () => {
      const logger = createLogger({ feature: "TestFeature" });
      const context = { count: 42, status: "ok" };
      const infoSpy = vi
        .spyOn(getLogLevel().getLogger("AI:TestFeature"), "info")
        .mockImplementation(() => {});
      logger.info("With context", context);

      expect(infoSpy).toHaveBeenCalledWith("[AI:TestFeature]", "With context", context);
    });
  });

  describe("Debug Mode", () => {
    it("should not log debug messages by default", () => {
      const logger = createLogger({ feature: "TestFeature" });
      const debugSpy = vi
        .spyOn(getLogLevel().getLogger("AI:TestFeature"), "debug")
        .mockImplementation(() => {});
      logger.debug("Debug message");

      expect(debugSpy).not.toHaveBeenCalled();
    });

    it("should log debug messages when global debug is enabled", () => {
      enableGlobalDebug();
      const logger = createLogger({ feature: "TestFeature" });
      const debugSpy = vi
        .spyOn(getLogLevel().getLogger("AI:TestFeature"), "debug")
        .mockImplementation(() => {});
      logger.debug("Debug message");

      expect(debugSpy).toHaveBeenCalledWith("[AI:TestFeature][DEBUG]", "Debug message");
    });

    it("should log debug messages when feature debug is enabled", () => {
      enableFeatureDebug("TestFeature");
      const logger = createLogger({ feature: "TestFeature" });
      const debugSpy = vi
        .spyOn(getLogLevel().getLogger("AI:TestFeature"), "debug")
        .mockImplementation(() => {});
      logger.debug("Debug message");

      expect(debugSpy).toHaveBeenCalledWith("[AI:TestFeature][DEBUG]", "Debug message");
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
      const logLevel = getLogLevel();
      const loglevelLogger = logLevel.getLogger("AI:TestFeature");
      const warnSpy = vi.spyOn(loglevelLogger, "warn").mockImplementation(() => {});

      expect(loglevelLogger.getLevel()).toBe(logLevel.levels.WARN);

      logger.warn("Warn message");
      expect(warnSpy).toHaveBeenCalledWith("[AI:TestFeature]", "Warn message");
    });

    it("should allow debug when minLevel is debug and debug is enabled", () => {
      enableFeatureDebug("TestFeature");
      const logger = createLogger({ feature: "TestFeature", minLevel: "debug" });
      const debugSpy = vi
        .spyOn(getLogLevel().getLogger("AI:TestFeature"), "debug")
        .mockImplementation(() => {});

      logger.debug("Debug message");
      expect(debugSpy).toHaveBeenCalled();
    });
  });

  describe("Feature Isolation", () => {
    it("should not enable debug for other features", () => {
      enableFeatureDebug("Feature1");

      const logger1 = createLogger({ feature: "Feature1" });
      const logger2 = createLogger({ feature: "Feature2" });
      const debugSpy1 = vi
        .spyOn(getLogLevel().getLogger("AI:Feature1"), "debug")
        .mockImplementation(() => {});
      const debugSpy2 = vi
        .spyOn(getLogLevel().getLogger("AI:Feature2"), "debug")
        .mockImplementation(() => {});

      logger1.debug("Feature 1 debug");
      expect(debugSpy1).toHaveBeenCalledTimes(1);

      logger2.debug("Feature 2 debug");
      expect(debugSpy2).not.toHaveBeenCalled();
    });

    it("should use different prefixes for different features", () => {
      const logger1 = createLogger({ feature: "Feature1" });
      const logger2 = createLogger({ feature: "Feature2" });
      const infoSpy1 = vi
        .spyOn(getLogLevel().getLogger("AI:Feature1"), "info")
        .mockImplementation(() => {});
      const infoSpy2 = vi
        .spyOn(getLogLevel().getLogger("AI:Feature2"), "info")
        .mockImplementation(() => {});

      logger1.info("Message 1");
      expect(infoSpy1).toHaveBeenCalledWith("[AI:Feature1]", "Message 1");

      logger2.info("Message 2");
      expect(infoSpy2).toHaveBeenCalledWith("[AI:Feature2]", "Message 2");
    });
  });
});
