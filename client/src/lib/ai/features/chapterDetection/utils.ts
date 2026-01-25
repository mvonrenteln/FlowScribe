/**
 * Chapter Detection Utilities
 *
 * Pure helpers for formatting prompt variables and mapping AI responses.
 *
 * @module ai/features/chapterDetection/utils
 */

import type { BatchIdMapping } from "@/lib/ai/core/batchIdMapping";
import { createBatchIdMapping, normalizeIds } from "@/lib/ai/core/batchIdMapping";
import type {
  ChapterDetectionBatch,
  ChapterDetectionIssue,
  ChapterDetectionResponse,
} from "./types";

export const formatTagsForPrompt = (tags: Array<{ id: string; label: string }>): string =>
  tags.length === 0 ? "(none)" : tags.map((t) => `- ${t.id}: ${t.label}`).join("\n");

export const formatSegmentsForPrompt = (
  segments: Array<{ id: string; speaker: string; text: string; start: number; end: number }>,
  mapping: BatchIdMapping<string>,
): string =>
  segments
    .map((s) => {
      const simpleId = mapping.realToSimple.get(s.id) ?? 0;
      const speaker = s.speaker?.trim() || "[Unknown]";
      const text = s.text?.trim() || "";
      return `${simpleId} | ${speaker} | ${text}`;
    })
    .join("\n");

export function createChapterBatchMapping(batch: ChapterDetectionBatch): BatchIdMapping<string> {
  return createBatchIdMapping(batch.segments, (s) => s.id);
}

export function mapResponseToRealSegmentIds(
  response: ChapterDetectionResponse,
  mapping: BatchIdMapping<string>,
  fallbackMapping?: BatchIdMapping<string>,
): Array<{
  title: string;
  summary?: string;
  notes?: string;
  tags?: string[];
  startSegmentId: string;
  endSegmentId: string;
}> {
  const issues: ChapterDetectionIssue[] = [];
  const chapters = Array.isArray(response.chapters) ? response.chapters : [];

  const mapped = chapters
    .map((ch) => {
      const startId =
        normalizeIds([ch.start], mapping)[0] ??
        (fallbackMapping ? normalizeIds([ch.start], fallbackMapping)[0] : undefined);
      const endId =
        normalizeIds([ch.end], mapping)[0] ??
        (fallbackMapping ? normalizeIds([ch.end], fallbackMapping)[0] : undefined);
      return {
        title: String(ch.title ?? "").trim(),
        summary: typeof ch.summary === "string" ? ch.summary.trim() : undefined,
        notes: typeof ch.notes === "string" ? ch.notes.trim() : undefined,
        tags: Array.isArray(ch.tags) ? ch.tags.map((t) => String(t)) : undefined,
        startSegmentId: startId,
        endSegmentId: endId,
      };
    })
    .filter((ch) => ch.title.length > 0 && ch.startSegmentId && ch.endSegmentId);

  if (issues.length > 0) {
    // Currently unused, but keep structure for future instrumentation.
    void issues;
  }

  return mapped;
}
