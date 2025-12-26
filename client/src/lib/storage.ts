import type {
  PersistedGlobalState,
  PersistedSession,
  PersistedSessionsState,
} from "@/lib/store/types";

const SESSIONS_STORAGE_KEY = "flowscribe:sessions";
const GLOBAL_STORAGE_KEY = "flowscribe:global";

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

export const buildRecentSessions = (sessions: Record<string, PersistedSession>) => {
  return Object.entries(sessions)
    .filter(([, session]) => session.segments.length > 0)
    .map(([key, session]) => ({
      key,
      audioName: session.audioRef?.name,
      transcriptName: session.transcriptRef?.name,
      updatedAt: session.updatedAt ?? 0,
    }))
    .sort((a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0));
};

export const createStorageScheduler = (throttleMs: number) => {
  let persistTimeout: ReturnType<typeof setTimeout> | null = null;
  let pendingSessions: PersistedSessionsState | null = null;
  let pendingGlobal: PersistedGlobalState | null = null;

  return (sessionsState: PersistedSessionsState, globalState: PersistedGlobalState) => {
    pendingSessions = sessionsState;
    pendingGlobal = globalState;
    if (persistTimeout) return;
    persistTimeout = setTimeout(() => {
      try {
        if (pendingSessions) {
          window.localStorage.setItem(SESSIONS_STORAGE_KEY, JSON.stringify(pendingSessions));
        }
        if (pendingGlobal) {
          window.localStorage.setItem(GLOBAL_STORAGE_KEY, JSON.stringify(pendingGlobal));
        }
      } catch {
        // Ignore persistence failures (quota, serialization).
      } finally {
        pendingSessions = null;
        pendingGlobal = null;
        persistTimeout = null;
      }
    }, throttleMs);
  };
};

export const storageKeys = {
  sessions: SESSIONS_STORAGE_KEY,
  global: GLOBAL_STORAGE_KEY,
} as const;
