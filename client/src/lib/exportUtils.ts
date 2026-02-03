import type { Chapter } from "@/types/chapter";
import type { Segment, Tag } from "./store/types";

export interface JSONExportChapter {
  id: string;
  title: string;
  summary?: string;
  notes?: string;
  tags?: string[];
  startSegmentId: string;
  endSegmentId: string;
  segmentCount: number;
  createdAt: number;
  source: string;
  // Rewrite fields
  rewrittenText?: string;
  rewrittenAt?: number;
  rewritePromptId?: string;
  rewriteContext?: {
    model?: string;
    providerId?: string;
    wordCount?: number;
  };
}

export interface JSONExport {
  segments: Array<Segment & { tags: string[] }>;
  chapters?: JSONExportChapter[];
}

export function buildJSONExport(
  segments: Segment[],
  tags: Tag[],
  chapters?: Chapter[],
): JSONExport {
  const tagsById = new Map(tags.map((t) => [t.id, t.name]));

  return {
    segments: segments.map((seg) => ({
      ...seg,
      // Replace tag ids with tag names; keep unknown ids as-is
      tags: (seg.tags || []).map((id) => tagsById.get(id) ?? id),
    })),
    ...(chapters && chapters.length > 0
      ? {
          chapters: chapters.map((chapter) => ({
            id: chapter.id,
            title: chapter.title,
            summary: chapter.summary,
            notes: chapter.notes,
            tags: chapter.tags,
            startSegmentId: chapter.startSegmentId,
            endSegmentId: chapter.endSegmentId,
            segmentCount: chapter.segmentCount,
            createdAt: chapter.createdAt,
            source: chapter.source,
            ...(chapter.rewrittenText && {
              rewrittenText: chapter.rewrittenText,
              rewrittenAt: chapter.rewrittenAt,
              rewritePromptId: chapter.rewritePromptId,
              rewriteContext: chapter.rewriteContext,
            }),
          })),
        }
      : {}),
  };
}

export default buildJSONExport;
