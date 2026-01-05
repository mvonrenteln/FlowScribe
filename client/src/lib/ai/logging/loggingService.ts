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

  constructor(options: LoggerOptions) {
    this.feature = options.feature;
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
    const globalDebug = (globalThis as any).__AIDebugMode === true;
    const featureDebug = (globalThis as any)[`__AI${this.feature}Debug`] === true;
    return globalDebug || featureDebug;
  }

  /**
   * Log debug message (only if debug enabled)
   */
  debug(message: string, context?: LogContext): void {
    if (context && Object.keys(context).length > 0) {
      this.logger.debug(message, context);
    } else {
      this.logger.debug(message);
    }
  }

  /**
   * Log info message
   */
  info(message: string, context?: LogContext): void {
    if (context && Object.keys(context).length > 0) {
      this.logger.info(message, context);
    } else {
      this.logger.info(message);
    }
  }

  /**
   * Log warning message
   */
  warn(message: string, context?: LogContext): void {
    if (context && Object.keys(context).length > 0) {
      this.logger.warn(message, context);
    } else {
      this.logger.warn(message);
    }
  }

  /**
   * Log error message
   */
  error(message: string, context?: LogContext): void {
    if (context && Object.keys(context).length > 0) {
      this.logger.error(message, context);
    } else {
      this.logger.error(message);
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
  (globalThis as any).__AIDebugMode = true;
  log.setLevel("debug");
}

/**
 * Disable debug mode globally
 */
export function disableGlobalDebug(): void {
  (globalThis as any).__AIDebugMode = false;
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
  (globalThis as any)[`__AI${feature}Debug`] = true;
  const logger = log.getLogger(`AI:${feature}`);
  logger.setLevel("debug");
}

/**
 * Disable debug mode for a specific feature
 */
export function disableFeatureDebug(feature: string): void {
  (globalThis as any)[`__AI${feature}Debug`] = false;
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
