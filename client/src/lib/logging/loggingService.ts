/**
 * General Logging Service
 *
 * Centralized logging for application operations with configurable log levels.
 * Supports debug mode for detailed output during development.
 * Uses loglevel library for better performance and features.
 *
 * This implementation preserves the previous AI-focused API but is usable by
 * any consumer. By default the namespace is `AI` to remain backward
 * compatible; callers can provide a different `namespace` in `LoggerOptions`.
 *
 * @module logging/loggingService
 */

import log from "loglevel";

export type LogLevel = "debug" | "info" | "warn" | "error";

export interface LogContext {
  [key: string]: unknown;
}

export interface LoggerOptions {
  /** Feature name for log prefix */
  feature: string;
  /** Optional namespace (defaults to 'AI' for backward compatibility) */
  namespace?: string;
  /** Minimum log level to output */
  minLevel?: LogLevel;
}

/**
 * Logger instance for a specific feature/namespace
 */
export class Logger {
  private readonly logger: log.Logger;
  private readonly feature: string;
  private readonly namespace: string;
  private readonly basePrefix: string;

  constructor(options: LoggerOptions) {
    this.feature = options.feature;
    this.namespace = options.namespace ?? "AI";
    this.basePrefix = `[${this.namespace}:${this.feature}]`;
    this.logger = log.getLogger(`${this.namespace}:${options.feature}`);

    // Set level based on debug flags or provided minLevel
    this.updateLevel(options.minLevel);
  }

  /** Update logger level based on debug flags */
  private updateLevel(minLevel?: LogLevel): void {
    if (this.isDebugEnabled) {
      this.logger.setLevel("debug");
    } else if (minLevel) {
      this.logger.setLevel(minLevel);
    } else {
      this.logger.setLevel("info");
    }
  }

  /** Check if debug mode is enabled for this feature/namespace */
  get isDebugEnabled(): boolean {
    const globalFlag = `__${this.namespace}DebugMode`;
    const featureFlag = `__${this.namespace}${this.feature}Debug`;
    const globalDebug = (globalThis as Record<string, unknown>)[globalFlag] === true;
    const featureDebug = (globalThis as Record<string, unknown>)[featureFlag] === true;
    return globalDebug || featureDebug;
  }

  debug(message: string, context?: LogContext): void {
    if (!this.isDebugEnabled) {
      return;
    }

    this.logWithPrefix("debug", message, context);
  }

  info(message: string, context?: LogContext): void {
    this.logWithPrefix("info", message, context);
  }

  warn(message: string, context?: LogContext): void {
    this.logWithPrefix("warn", message, context);
  }

  error(message: string, context?: LogContext): void {
    this.logWithPrefix("error", message, context);
  }

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

export function createLogger(options: LoggerOptions): Logger {
  return new Logger(options);
}

export function enableGlobalDebug(namespace = "AI"): void {
  const key = `__${namespace}DebugMode`;
  (globalThis as Record<string, unknown>)[key] = true;
  log.setLevel("debug");
}

export function disableGlobalDebug(namespace = "AI"): void {
  const key = `__${namespace}DebugMode`;
  (globalThis as Record<string, unknown>)[key] = false;
  log.setLevel("info");
}

export function enableFeatureDebug(feature: string, namespace = "AI"): void {
  const key = `__${namespace}${feature}Debug`;
  (globalThis as Record<string, unknown>)[key] = true;
  const logger = log.getLogger(`${namespace}:${feature}`);
  logger.setLevel("debug");
}

export function disableFeatureDebug(feature: string, namespace = "AI"): void {
  const key = `__${namespace}${feature}Debug`;
  (globalThis as Record<string, unknown>)[key] = false;
  const logger = log.getLogger(`${namespace}:${feature}`);
  logger.setLevel("info");
}

export function setGlobalLogLevel(level: LogLevel): void {
  log.setLevel(level);
}

export function getLogLevel(): typeof log {
  return log;
}
