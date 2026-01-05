/**
 * AI Logging Service
 *
 * Centralized logging for AI operations with configurable log levels.
 * Supports debug mode for detailed output during development.
 * Uses loglevel library for better performance and features.
 *
 * @module ai/logging/loggingService
 */

import log from "loglevel";

export type LogLevel = "debug" | "info" | "warn" | "error";

export interface LogContext {
  [key: string]: unknown;
}

export interface LoggerOptions {
  /**
   * Feature name for log prefix
   */
  feature: string;
  /**
   * Minimum log level to output
   */
  minLevel?: LogLevel;
}

/**
 * AI Logger instance for a specific feature
 */
export class AILogger {
  private readonly logger: log.Logger;
  private readonly feature: string;
  private readonly basePrefix: string;

  constructor(options: LoggerOptions) {
    this.feature = options.feature;
    this.basePrefix = `[AI:${this.feature}]`;
    this.logger = log.getLogger(`AI:${options.feature}`);

    // Set level based on debug flags or provided minLevel
    this.updateLevel(options.minLevel);
  }

  /**
   * Update logger level based on debug flags
   */
  private updateLevel(minLevel?: LogLevel): void {
    if (this.isDebugEnabled) {
      this.logger.setLevel("debug");
    } else if (minLevel) {
      this.logger.setLevel(minLevel);
    } else {
      this.logger.setLevel("info");
    }
  }

  /**
   * Check if debug mode is enabled for this feature
   */
  get isDebugEnabled(): boolean {
    const globalDebug = (globalThis as Record<string, unknown>).__AIDebugMode === true;
    const featureDebug =
      (globalThis as Record<string, unknown>)[`__AI${this.feature}Debug`] === true;
    return globalDebug || featureDebug;
  }

  /**
   * Log debug message (only if debug enabled)
   */
  debug(message: string, context?: LogContext): void {
    if (!this.isDebugEnabled) {
      return;
    }

    this.logWithPrefix("debug", message, context);
  }

  /**
   * Log info message
   */
  info(message: string, context?: LogContext): void {
    this.logWithPrefix("info", message, context);
  }

  /**
   * Log warning message
   */
  warn(message: string, context?: LogContext): void {
    this.logWithPrefix("warn", message, context);
  }

  /**
   * Log error message
   */
  error(message: string, context?: LogContext): void {
    this.logWithPrefix("error", message, context);
  }

  /**
   * Format log arguments with feature prefix and optional context
   */
  private logWithPrefix(level: LogLevel, message: string, context?: LogContext): void {
    const prefix = level === "debug" ? `${this.basePrefix}[DEBUG]` : this.basePrefix;
    const hasContext = context && Object.keys(context).length > 0;
    const args = hasContext ? [prefix, message, context] : [prefix, message];

    switch (level) {
      case "debug":
        this.logger.debug(...args);
        break;
      case "info":
        this.logger.info(...args);
        break;
      case "warn":
        this.logger.warn(...args);
        break;
      case "error":
        this.logger.error(...args);
        break;
    }
  }
}

/**
 * Create a logger instance for a feature
 *
 * @example
 * ```ts
 * const logger = createLogger({ feature: "SegmentMerge" });
 * logger.info("Starting analysis");
 * logger.debug("Detailed debug info", { segments: 10 });
 * ```
 */
export function createLogger(options: LoggerOptions): AILogger {
  return new AILogger(options);
}

/**
 * Enable debug mode globally for all AI features
 */
export function enableGlobalDebug(): void {
  (globalThis as Record<string, unknown>).__AIDebugMode = true;
  log.setLevel("debug");
}

/**
 * Disable debug mode globally
 */
export function disableGlobalDebug(): void {
  (globalThis as Record<string, unknown>).__AIDebugMode = false;
  log.setLevel("info");
}

/**
 * Enable debug mode for a specific feature
 *
 * @example
 * ```ts
 * enableFeatureDebug("SegmentMerge");
 * // Now logger.debug() calls will output
 * ```
 */
export function enableFeatureDebug(feature: string): void {
  (globalThis as Record<string, unknown>)[`__AI${feature}Debug`] = true;
  const logger = log.getLogger(`AI:${feature}`);
  logger.setLevel("debug");
}

/**
 * Disable debug mode for a specific feature
 */
export function disableFeatureDebug(feature: string): void {
  (globalThis as Record<string, unknown>)[`__AI${feature}Debug`] = false;
  const logger = log.getLogger(`AI:${feature}`);
  logger.setLevel("info");
}

/**
 * Set global log level for all loggers
 */
export function setGlobalLogLevel(level: LogLevel): void {
  log.setLevel(level);
}

/**
 * Get the underlying loglevel instance for advanced usage
 */
export function getLogLevel(): typeof log {
  return log;
}
