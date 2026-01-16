/**
 * Backwards-compatible re-exports for AI logging.
 * Prefer importing from `@/lib/logging` for application-wide logging.
 */

export type { LogContext, LoggerOptions, LogLevel } from "@/lib/logging";
export {
  createLogger,
  disableFeatureDebug,
  disableGlobalDebug,
  enableFeatureDebug,
  enableGlobalDebug,
  getLogLevel,
  setGlobalLogLevel,
} from "@/lib/logging";
