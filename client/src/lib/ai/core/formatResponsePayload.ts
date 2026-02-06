/**
 * Normalize AI raw response into a compact string payload for error contexts.
 */
export function formatResponsePayload(rawResponse: unknown, fallback?: string): string | undefined {
  if (typeof rawResponse === "string") {
    const trimmed = rawResponse.trim();
    if (trimmed.length > 0) {
      return trimmed;
    }
  }
  if (rawResponse !== undefined) {
    try {
      return JSON.stringify(rawResponse);
    } catch {
      // Ignore serialization errors and fall back to fallback text.
    }
  }
  if (typeof fallback === "string" && fallback.trim().length > 0) {
    return fallback.trim();
  }
  return undefined;
}
