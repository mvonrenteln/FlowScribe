import type { PersistedSession, Segment, Speaker } from "../types";
import { generateId } from "./id";

const cloneSpeakers = (speakers: Speaker[]) => speakers.map((speaker) => ({ ...speaker }));

const cloneSegments = (segments: Segment[]) =>
  segments.map((segment) => ({
    ...segment,
    words: segment.words.map((word) => ({ ...word })),
  }));

export const buildRevisionKey = (baseKey: string) => `${baseKey}|revision:${generateId()}`;

export const cloneSessionForRevision = (session: PersistedSession): PersistedSession => ({
  ...session,
  segments: cloneSegments(session.segments),
  speakers: cloneSpeakers(session.speakers),
  chapters: session.chapters
    ? session.chapters.map((chapter) => ({ ...chapter }))
    : session.chapters,
});
