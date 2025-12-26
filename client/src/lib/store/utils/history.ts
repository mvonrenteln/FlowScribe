import type { HistoryState } from "../types";

export const pushHistory = (
  history: HistoryState[],
  historyIndex: number,
  state: HistoryState,
  maxHistory: number,
) => {
  const newHistory = history.slice(0, historyIndex + 1);
  newHistory.push(state);
  const trimmedHistory =
    newHistory.length > maxHistory ? newHistory.slice(newHistory.length - maxHistory) : newHistory;
  return {
    history: trimmedHistory,
    historyIndex: trimmedHistory.length - 1,
  };
};
