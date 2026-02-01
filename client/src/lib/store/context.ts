import { buildRecentSessions } from "@/lib/storage";
import type {
  PersistedGlobalState,
  PersistedSession,
  PersistedSessionsState,
  RecentSessionSummary,
} from "./types";

export interface StoreContext {
  getSessionsCache: () => Record<string, PersistedSession>;
  setSessionsCache: (cache: Record<string, PersistedSession>) => void;
  getActiveSessionKey: () => string | null;
  setActiveSessionKey: (key: string | null) => void;
  getLastRecentSerialized: () => string;
  setLastRecentSerialized: (value: string) => void;
  updateRecentSessions: (sessions: Record<string, PersistedSession>) => void;
  persist: (sessionsState: PersistedSessionsState, globalState: PersistedGlobalState) => void;
  persistSync: () => void;
}

export const createStoreContext = (
  initialSessions: Record<string, PersistedSession>,
  initialActiveKey: string | null,
  persist: StoreContext["persist"],
  persistSyncFn: (sessionsState: PersistedSessionsState) => void,
  setRecentSessions: (sessions: RecentSessionSummary[]) => void,
): StoreContext => {
  let sessionsCache = initialSessions;
  let activeSessionKeyCache = initialActiveKey;
  let lastRecentSerialized = JSON.stringify(buildRecentSessions(sessionsCache));

  return {
    getSessionsCache: () => sessionsCache,
    setSessionsCache: (cache) => {
      sessionsCache = cache;
    },
    getActiveSessionKey: () => activeSessionKeyCache,
    setActiveSessionKey: (key) => {
      activeSessionKeyCache = key;
    },
    getLastRecentSerialized: () => lastRecentSerialized,
    setLastRecentSerialized: (value) => {
      lastRecentSerialized = value;
    },
    updateRecentSessions: (sessions) => {
      const recentSessions = buildRecentSessions(sessions);
      const recentSerialized = JSON.stringify(recentSessions);
      if (recentSerialized !== lastRecentSerialized) {
        lastRecentSerialized = recentSerialized;
        setRecentSessions(recentSessions);
      }
    },
    persist,
    persistSync: () => {
      persistSyncFn({
        sessions: sessionsCache,
        activeSessionKey: activeSessionKeyCache,
      });
    },
  };
};
