import type { Segment, Tag } from "./store/types";

export interface JSONExport {
  segments: Array<Segment & { tags: string[] }>;
}

export function buildJSONExport(segments: Segment[], tags: Tag[]): JSONExport {
  const tagsById = new Map(tags.map((t) => [t.id, t.name]));

  return {
    segments: segments.map((seg) => ({
      ...seg,
      // Replace tag ids with tag names; keep unknown ids as-is
      tags: (seg.tags || []).map((id) => tagsById.get(id) ?? id),
    })),
  };
}

export default buildJSONExport;
