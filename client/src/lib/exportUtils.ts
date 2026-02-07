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

/** Tag metadata included in JSON exports for restoring colors on import. */
export interface JSONExportTag {
  name: string;
  color: string;
}

/** JSON export payload for transcripts with optional chapter metadata. */
export interface JSONExport {
  segments: Array<Segment & { tags: string[] }>;
  tags?: JSONExportTag[];
  chapters?: JSONExportChapter[];
}

const mapTagIdsToNames = (tags: string[] | undefined, tagsById: Map<string, string>) =>
  (tags || []).map((id) => tagsById.get(id) ?? id);

/**
 * Build a JSON export payload with tag names instead of internal tag IDs.
 * This keeps exports human-readable while preserving tag colors for re-import.
 */
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
      tags: mapTagIdsToNames(seg.tags, tagsById),
    })),
    ...(tags.length > 0
      ? {
          tags: tags.map((tag) => ({
            name: tag.name,
            color: tag.color,
          })),
        }
      : {}),
    ...(chapters && chapters.length > 0
      ? {
          chapters: chapters.map((chapter) => ({
            id: chapter.id,
            title: chapter.title,
            summary: chapter.summary,
            notes: chapter.notes,
            tags: mapTagIdsToNames(chapter.tags, tagsById),
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
