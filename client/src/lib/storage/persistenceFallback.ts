import type { PersistedGlobalState, PersistedSessionsState } from "@/lib/store/types";

const FALLBACK_MAX_JSON_CHARS = 250_000;
const FALLBACK_IDLE_TIMEOUT_MS = 2_000;

const isQuotaExceeded = (error: unknown): boolean => {
  if (error instanceof DOMException) {
    return error.name === "QuotaExceededError" || error.code === 22;
  }
  return false;
};

const dispatchQuotaExceeded = () => {
  try {
    globalThis.window?.dispatchEvent?.(new CustomEvent("flowscribe:storage-quota-exceeded"));
  } catch {
    // ignore in non-browser environments
  }
};

/**
 * Fallback persistence handler for environments where Web Workers are unavailable
 * (file:// protocol, CSP worker-src restrictions, test environments, embedded webviews,
 * or enterprise security policies).
 *
 * Defers JSON serialization and localStorage writes to idle time when possible,
 * with version tracking to prevent stale deferred writes from overwriting newer state.
 */
export const createFallbackPersister = (sessionsStorageKey: string, globalStorageKey: string) => {
  let latestFallbackJobId = 0;

  return (
    sessionsToPersist: PersistedSessionsState,
    globalToPersist: PersistedGlobalState,
  ): void => {
    latestFallbackJobId += 1;
    const currentFallbackJobId = latestFallbackJobId;

    const syncFallback = () => {
      // Only persist if this is still the latest fallback job
      if (currentFallbackJobId !== latestFallbackJobId) return;

      try {
        const sessionsJson = JSON.stringify(sessionsToPersist);
        const globalJson = JSON.stringify(globalToPersist);
        const totalChars = sessionsJson.length + globalJson.length;

        if (totalChars > FALLBACK_MAX_JSON_CHARS) {
          console.warn("Large sync fallback persistence payload; expect main-thread work.", {
            totalChars,
          });
        }

        window.localStorage.setItem(sessionsStorageKey, sessionsJson);
        window.localStorage.setItem(globalStorageKey, globalJson);
      } catch (err) {
        if (isQuotaExceeded(err)) {
          console.error("QuotaExceededError: sync fallback persistence failed", err);
          dispatchQuotaExceeded();
        }
      }
    };

    // Defer to idle time when possible, otherwise use setTimeout(0)
    const { requestIdleCallback, cancelIdleCallback } = window as Window & {
      requestIdleCallback?: (callback: IdleRequestCallback, options?: IdleRequestOptions) => number;
      cancelIdleCallback?: (handle: number) => void;
    };

    if (requestIdleCallback) {
      let hasPersisted = false;
      const runOnce = () => {
        if (hasPersisted) return;
        hasPersisted = true;
        syncFallback();
      };

      let timeoutHandle: ReturnType<typeof setTimeout> | null = null;
      const idleHandle = requestIdleCallback(
        () => {
          if (timeoutHandle) {
            clearTimeout(timeoutHandle);
          }
          runOnce();
        },
        { timeout: FALLBACK_IDLE_TIMEOUT_MS },
      );

      timeoutHandle = setTimeout(() => {
        cancelIdleCallback?.(idleHandle);
        runOnce();
      }, FALLBACK_IDLE_TIMEOUT_MS);
    } else {
      setTimeout(syncFallback, 0);
    }
  };
};
