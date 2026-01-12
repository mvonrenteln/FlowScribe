import type { StoreApi } from "zustand";
import { SPEAKER_COLORS } from "../constants";
import type { SpeakersSlice, TranscriptStore } from "../types";
import { generateId } from "../utils/id";
import { addToHistory } from "./historySlice";

type StoreSetter = StoreApi<TranscriptStore>["setState"];
type StoreGetter = StoreApi<TranscriptStore>["getState"];

export const createSpeakersSlice = (set: StoreSetter, get: StoreGetter): SpeakersSlice => ({
  renameSpeaker: (oldName, newName) => {
    const { segments, speakers, history, historyIndex, selectedSegmentId, currentTime } = get();
    if (oldName === newName) return;
    if (!speakers.some((s) => s.name === oldName)) return;
    const newSpeakers = speakers.map((s) => (s.name === oldName ? { ...s, name: newName } : s));
    const newSegments = segments.map((s) =>
      s.speaker === oldName
        ? {
            ...s,
            speaker: newName,
            words: s.words.map((word) =>
              word.speaker === oldName ? { ...word, speaker: newName } : word,
            ),
          }
        : {
            ...s,
            words: s.words.map((word) =>
              word.speaker === oldName ? { ...word, speaker: newName } : word,
            ),
          },
    );
    const nextHistory = addToHistory(history, historyIndex, {
      segments: newSegments,
      speakers: newSpeakers,
      selectedSegmentId,
      currentTime,
    });
    set({
      segments: newSegments,
      speakers: newSpeakers,
      history: nextHistory.history,
      historyIndex: nextHistory.historyIndex,
    });
  },

  addSpeaker: (name) => {
    const { speakers, segments, history, historyIndex, selectedSegmentId, currentTime } = get();
    if (speakers.find((s) => s.name === name)) return;

    const newSpeaker = {
      id: generateId(),
      name,
      color: SPEAKER_COLORS[speakers.length % SPEAKER_COLORS.length],
    };
    const newSpeakers = [...speakers, newSpeaker];
    const nextHistory = addToHistory(history, historyIndex, {
      segments,
      speakers: newSpeakers,
      selectedSegmentId,
      currentTime,
    });
    set({
      speakers: newSpeakers,
      history: nextHistory.history,
      historyIndex: nextHistory.historyIndex,
    });
  },

  mergeSpeakers: (fromName, toName) => {
    const { segments, speakers, history, historyIndex, selectedSegmentId, currentTime } = get();
    if (fromName === toName) return;
    if (!speakers.some((s) => s.name === fromName)) return;
    if (!speakers.some((s) => s.name === toName)) return;

    const newSegments = segments.map((s) =>
      s.speaker === fromName
        ? {
            ...s,
            speaker: toName,
            words: s.words.map((word) =>
              word.speaker === fromName ? { ...word, speaker: toName } : word,
            ),
          }
        : {
            ...s,
            words: s.words.map((word) =>
              word.speaker === fromName ? { ...word, speaker: toName } : word,
            ),
          },
    );
    const newSpeakers = speakers.filter((s) => s.name !== fromName);
    const nextHistory = addToHistory(history, historyIndex, {
      segments: newSegments,
      speakers: newSpeakers,
      selectedSegmentId,
      currentTime,
    });
    set({
      segments: newSegments,
      speakers: newSpeakers,
      history: nextHistory.history,
      historyIndex: nextHistory.historyIndex,
    });
  },
});
