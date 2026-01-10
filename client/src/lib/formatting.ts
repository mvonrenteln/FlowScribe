/**
 * Format a duration given in milliseconds into a human-readable string.
 *
 * Rules:
 * - If `durationMs` is falsy (undefined/null/0) returns the dash "—".
 * - Durations < 1s are shown with one decimal place (e.g. `0.1s`).
 * - Durations >= 1s show whole seconds without decimal places (e.g. `12s`).
 * - For durations >= 60s the format is `XmYs` (minutes and whole seconds).
 *
 * Examples:
 * - 12345 -> "12s"
 * - 197150 -> "3m17s"
 * - undefined -> "—"
 */
export function formatDurationMs(durationMs?: number): string {
  if (!durationMs) return "—";

  // For durations under 1 second, show one decimal place (e.g. 0.1s).
  if (durationMs < 1000) {
    // Round to nearest tenth of a second using integer math to avoid
    // floating-point edge cases (e.g. 150ms -> 0.2s).
    const secsOneDecimal = Math.round(durationMs / 100) / 10;
    if (secsOneDecimal >= 1) return `1s`;
    return `${secsOneDecimal.toFixed(1)}s`;
  }

  // For durations >= 1s use whole seconds (rounded) and show minutes when appropriate.
  const totalSeconds = Math.round(durationMs / 1000);
  if (totalSeconds >= 60) {
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds - minutes * 60;
    return `${minutes}m${seconds}s`;
  }
  return `${totalSeconds}s`;
}

export default formatDurationMs;
