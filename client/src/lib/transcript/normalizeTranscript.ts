import type { Segment } from "@/lib/store";

export type TranscriptLike = {
  id?: string;
  segments?: Array<Partial<Segment>>;
  [k: string]: any;
};

export function normalizeSegment(s: Partial<Segment>) {
  return {
    ...s,
    tags: s.tags ?? [],
  } as Segment;
}

export function normalizeTranscript<T extends TranscriptLike>(t: T): T {
  return {
    ...t,
    segments: (t.segments ?? []).map((s) => normalizeSegment(s)),
  } as T;
}

export function normalizeSegments(segments?: Array<Partial<Segment>>): Segment[] {
  return (segments ?? []).map((s) => normalizeSegment(s));
}

export function hasSegmentTag(s: Partial<Segment>, tagId: string): boolean {
  return (s.tags ?? []).includes(tagId);
}
