import { indexById } from "@/lib/arrayUtils";
import type { Chapter } from "@/types/chapter";
import type { Segment, Tag } from "./store/types";
import { getSegmentTags } from "./store/utils/segmentTags";

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

export interface TXTExportOptions {
  useRewrittenText?: boolean;
  includeChapterHeadings?: boolean;
  includeChapterSummaries?: boolean;
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

const formatTxtTime = (seconds: number): string => {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, "0")}`;
};

const formatSegmentTXT = (segment: Segment, tagsById: Map<string, Tag>): string => {
  const segmentTagIds = getSegmentTags(segment);
  const tagNames = segmentTagIds
    .map((tagId) => tagsById.get(tagId)?.name)
    .filter((name): name is string => !!name);

  const speakerLabel =
    tagNames.length > 0 ? `${segment.speaker} (${tagNames.join(", ")})` : segment.speaker;

  return `[${formatTxtTime(segment.start)}] ${speakerLabel}: ${segment.text}`;
};

/**
 * Build a plain text export payload with optional chapter metadata and rewrites.
 */
export function buildTXTExport(
  segmentsToExport: Segment[],
  allSegments: Segment[],
  tags: Tag[],
  chapters: Chapter[] = [],
  options: TXTExportOptions = {},
): string {
  const {
    useRewrittenText = false,
    includeChapterHeadings = false,
    includeChapterSummaries = false,
  } = options;

  const tagsById = new Map(tags.map((t) => [t.id, t]));
  const segmentIndexById = indexById(allSegments);

  const shouldExportByChapter =
    chapters.length > 0 && (useRewrittenText || includeChapterHeadings || includeChapterSummaries);

  if (shouldExportByChapter) {
    const parts: string[] = [];

    for (const chapter of chapters) {
      const startIndex = segmentIndexById.get(chapter.startSegmentId) ?? -1;
      const endIndex = segmentIndexById.get(chapter.endSegmentId) ?? -1;

      const chapterSegments = segmentsToExport.filter((segment) => {
        if (startIndex === -1 || endIndex === -1) return false;
        const segmentIndex = segmentIndexById.get(segment.id) ?? -1;
        return segmentIndex >= startIndex && segmentIndex <= endIndex;
      });

      if (chapterSegments.length === 0) {
        continue;
      }

      if (includeChapterHeadings) {
        parts.push(`# ${chapter.title}`);
      }

      if (includeChapterSummaries && chapter.summary) {
        parts.push(`\n${chapter.summary}\n`);
      }

      if (useRewrittenText && chapter.rewrittenText) {
        parts.push(chapter.rewrittenText);
      } else {
        parts.push(
          chapterSegments.map((segment) => formatSegmentTXT(segment, tagsById)).join("\n\n"),
        );
      }

      parts.push("\n\n");
    }

    return parts.join("\n").trim();
  }

  return segmentsToExport.map((segment) => formatSegmentTXT(segment, tagsById)).join("\n\n");
}

export default buildJSONExport;
