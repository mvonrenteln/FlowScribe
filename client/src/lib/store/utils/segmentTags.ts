import type { Segment } from "../types";

export function getSegmentTags(segment: Segment): string[] {
  return segment.tags;
}

export function hasSegmentTag(segment: Segment, tagId: string): boolean {
  return segment.tags.includes(tagId);
}
