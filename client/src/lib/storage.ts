import type {
  PersistedGlobalState,
  PersistedSession,
  PersistedSessionsState,
} from "@/lib/store/types";

const SESSIONS_STORAGE_KEY = "flowscribe:sessions";
const GLOBAL_STORAGE_KEY = "flowscribe:global";

type PersistenceWorkerRequest = {
  jobId: number;
  sessionsState: PersistedSessionsState;
  globalState: PersistedGlobalState;
};

type PersistenceWorkerResponse = {
  jobId: number;
  sessionsJson: string | null;
  globalJson: string | null;
  error?: string;
};

type PersistenceWorkerLike = {
  addEventListener: (
    type: "message",
    handler: (event: MessageEvent<PersistenceWorkerResponse>) => void,
  ) => void;
  postMessage: (payload: PersistenceWorkerRequest) => void;
};

type PersistenceWorkerFactory = () => PersistenceWorkerLike | null;

const createPersistenceWorker = (): PersistenceWorkerLike | null => {
  if (typeof Worker === "undefined") return null;
  try {
    return new Worker(new URL("./workers/persistenceWorker.ts", import.meta.url), {
      type: "module",
    }) as PersistenceWorkerLike;
  } catch {
    return null;
  }
};

export const canUseLocalStorage = () => {
  if (typeof window === "undefined") return false;
  try {
    return Boolean(window.localStorage);
  } catch {
    return false;
  }
};

export const readSessionsState = (): PersistedSessionsState => {
  if (!canUseLocalStorage()) {
    return { sessions: {}, activeSessionKey: null };
  }
  const raw = window.localStorage.getItem(SESSIONS_STORAGE_KEY);
  if (raw) {
    try {
      const parsed = JSON.parse(raw) as PersistedSessionsState;
      if (parsed && typeof parsed === "object" && parsed.sessions) {
        const sessions = parsed.sessions ?? {};
        let activeSessionKey = parsed.activeSessionKey ?? null;
        if (!activeSessionKey) {
          const keys = Object.keys(sessions);
          if (keys.length > 0) {
            activeSessionKey = keys.reduce((bestKey, key) => {
              const bestTime = sessions[bestKey]?.updatedAt ?? 0;
              const nextTime = sessions[key]?.updatedAt ?? 0;
              return nextTime > bestTime ? key : bestKey;
            }, keys[0]);
          }
        }
        // Fallback: if active session is empty (no segments, no transcript),
        // switch to the most recently updated session that has content.
        // This recovers from crashes that occur after a new session key was
        // persisted but before any data was loaded into it.
        if (activeSessionKey && sessions[activeSessionKey]) {
          const active = sessions[activeSessionKey];
          if (active.segments.length === 0 && !active.transcriptRef) {
            const contentKeys = Object.keys(sessions).filter(
              (k) => sessions[k].segments.length > 0,
            );
            if (contentKeys.length > 0) {
              activeSessionKey = contentKeys.reduce((best, key) => {
                return (sessions[key]?.updatedAt ?? 0) > (sessions[best]?.updatedAt ?? 0)
                  ? key
                  : best;
              }, contentKeys[0]);
            }
          }
        }
        return {
          sessions,
          activeSessionKey,
        };
      }
    } catch {
      // ignore malformed storage
    }
  }
  return { sessions: {}, activeSessionKey: null };
};

export const readGlobalState = (): PersistedGlobalState | null => {
  if (!canUseLocalStorage()) return null;
  const raw = window.localStorage.getItem(GLOBAL_STORAGE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as PersistedGlobalState;
  } catch {
    return null;
  }
};

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

export const writeSessionsSync = (state: PersistedSessionsState): boolean => {
  if (!canUseLocalStorage()) return false;
  try {
    window.localStorage.setItem(SESSIONS_STORAGE_KEY, JSON.stringify(state));
    return true;
  } catch (error) {
    if (isQuotaExceeded(error)) {
      console.error("QuotaExceededError: session data could not be saved", error);
      dispatchQuotaExceeded();
    }
    return false;
  }
};

export const writeGlobalState = (state: PersistedGlobalState): boolean => {
  if (!canUseLocalStorage()) return false;
  try {
    window.localStorage.setItem(GLOBAL_STORAGE_KEY, JSON.stringify(state));
    return true;
  } catch {
    return false;
  }
};

export const buildRecentSessions = (sessions: Record<string, PersistedSession>) => {
  return Object.entries(sessions)
    .filter(([, session]) => session.segments.length > 0)
    .map(([key, session]) => ({
      key,
      audioName: session.audioRef?.name,
      transcriptName: session.transcriptRef?.name,
      updatedAt: session.updatedAt ?? 0,
      kind: session.kind ?? "current",
      label: session.label ?? null,
      baseSessionKey: session.baseSessionKey ?? null,
    }))
    .sort((a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0));
};

/**
 * Schedules persistence writes and offloads JSON serialization to a worker
 * when available to avoid blocking the main thread.
 */
export const createStorageScheduler = (
  throttleMs: number,
  persistenceWorkerFactory: PersistenceWorkerFactory = createPersistenceWorker,
) => {
  let persistTimeout: ReturnType<typeof setTimeout> | null = null;
  let pendingSessions: PersistedSessionsState | null = null;
  let pendingGlobal: PersistedGlobalState | null = null;
  let worker: PersistenceWorkerLike | null = null;
  let latestJobId = 0;

  const ensureWorker = () => {
    if (worker) return worker;
    worker = persistenceWorkerFactory();
    if (!worker) return null;
    worker.addEventListener("message", (event: MessageEvent<PersistenceWorkerResponse>) => {
      const { jobId, sessionsJson, globalJson, error } = event.data || {};
      if (!jobId || jobId !== latestJobId) return;
      if (error) return;
      try {
        if (typeof sessionsJson === "string") {
          window.localStorage.setItem(SESSIONS_STORAGE_KEY, sessionsJson);
        }
        if (typeof globalJson === "string") {
          window.localStorage.setItem(GLOBAL_STORAGE_KEY, globalJson);
        }
      } catch (err) {
        if (isQuotaExceeded(err)) {
          console.error("QuotaExceededError: worker persistence failed", err);
          dispatchQuotaExceeded();
        }
      }
    });
    return worker;
  };

  return (sessionsState: PersistedSessionsState, globalState: PersistedGlobalState) => {
    pendingSessions = sessionsState;
    pendingGlobal = globalState;
    if (persistTimeout) return;
    persistTimeout = setTimeout(() => {
      const sessionsToPersist = pendingSessions;
      const globalToPersist = pendingGlobal;
      pendingSessions = null;
      pendingGlobal = null;
      persistTimeout = null;
      if (!sessionsToPersist || !globalToPersist) return;
      const activeWorker = ensureWorker();
      if (activeWorker) {
        latestJobId += 1;
        const payload: PersistenceWorkerRequest = {
          jobId: latestJobId,
          sessionsState: sessionsToPersist,
          globalState: globalToPersist,
        };
        activeWorker.postMessage(payload);
        return;
      }
      try {
        window.localStorage.setItem(SESSIONS_STORAGE_KEY, JSON.stringify(sessionsToPersist));
        window.localStorage.setItem(GLOBAL_STORAGE_KEY, JSON.stringify(globalToPersist));
      } catch (err) {
        if (isQuotaExceeded(err)) {
          console.error("QuotaExceededError: sync fallback persistence failed", err);
          dispatchQuotaExceeded();
        }
      }
    }, throttleMs);
  };
};

export const storageKeys = {
  sessions: SESSIONS_STORAGE_KEY,
  global: GLOBAL_STORAGE_KEY,
} as const;
