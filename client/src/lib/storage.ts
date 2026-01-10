import type { PersistedSession, PersistedSessionsState } from "@/lib/store/types";

const SESSIONS_STORAGE_KEY = "flowscribe:sessions";

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

// Global state persistence removed. Keep API stub for compatibility.
export const readGlobalState = (): PersistedGlobalState | null => {
  return null;
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

export const createStorageScheduler = (throttleMs: number) => {
  let persistTimeout: ReturnType<typeof setTimeout> | null = null;
  let pendingSessions: PersistedSessionsState | null = null;

  return (sessionsState: PersistedSessionsState) => {
    pendingSessions = sessionsState;
    if (persistTimeout) return;
    persistTimeout = setTimeout(() => {
      try {
        if (pendingSessions) {
          window.localStorage.setItem(SESSIONS_STORAGE_KEY, JSON.stringify(pendingSessions));
        }
        // Global persistence removed — skip writing pendingGlobal.
      } catch {
        // Ignore persistence failures (quota, serialization).
      } finally {
        pendingSessions = null;
        persistTimeout = null;
      }
    }, throttleMs);
  };
};

export const storageKeys = {
  sessions: SESSIONS_STORAGE_KEY,
} as const;
