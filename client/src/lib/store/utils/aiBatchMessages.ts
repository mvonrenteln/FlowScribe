/**
 * Normalize batch issue messages for compact summaries.
 */
export function normalizeBatchIssueMessage(message: string): string {
  let normalized = message.trim();

  normalized = normalized.replace(/^Batch\s+\d+\s+failed:\s*/i, "");
  normalized = normalized.replace(/^Batch\s+\d+\s+failed\.?\s*/i, "");
  normalized = normalized.replace(/\.$/, "");

  return normalized;
}
