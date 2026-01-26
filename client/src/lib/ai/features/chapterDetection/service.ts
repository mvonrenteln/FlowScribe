/**
 * Chapter Detection Service
 *
 * Runs AI-driven chapter detection across a transcript in batches,
 * using SimpleID mapping (1..n) to avoid exposing real segment IDs.
 *
 * @module ai/features/chapterDetection/service
 */

import { executeFeature } from "@/lib/ai/core/aiFeatureService";
import type { AIFeatureOptions } from "@/lib/ai/core/types";
import { compileTemplate } from "@/lib/ai/prompts";
import type { PromptVariables } from "@/lib/ai/prompts/types";
import type { Chapter } from "@/types/chapter";
import { chapterDetectionConfig } from "./config";
import type {
  ChapterDetectionBatchLogEntry,
  ChapterDetectionIssue,
  ChapterDetectionResponse,
} from "./types";
import {
  createChapterBatchMapping,
  formatSegmentsForPrompt,
  formatTagsForPrompt,
  mapResponseToRealSegmentIds,
} from "./utils";

export interface DetectChaptersParams extends AIFeatureOptions {
  segments: Array<{
    id: string;
    speaker: string;
    text: string;
    start: number;
    end: number;
  }>;
  batchSize: number;
  minChapterLength: number;
  maxChapterLength: number;
  tagsAvailable: Array<{ id: string; label: string }>;
  customPrompt?: {
    systemPrompt: string;
    userPromptTemplate: string;
  };
  onProgress?: (processedBatches: number, totalBatches: number) => void;
  onBatchLog?: (entry: ChapterDetectionBatchLogEntry) => void;
  onBatchComplete?: (
    batchIndex: number,
    mapped: Array<{
      title: string;
      summary?: string;
      notes?: string;
      tags?: string[];
      startSegmentId: string;
      endSegmentId: string;
    }>,
  ) => void;
}

export interface DetectChaptersResult {
  chapters: Array<
    Pick<
      Chapter,
      | "id"
      | "title"
      | "summary"
      | "notes"
      | "tags"
      | "startSegmentId"
      | "endSegmentId"
      | "segmentCount"
      | "createdAt"
      | "source"
    >
  >;
  issues: ChapterDetectionIssue[];
  batchLog: ChapterDetectionBatchLogEntry[];
}

const sliceIntoBatches = <T>(items: T[], batchSize: number) => {
  const batches: T[][] = [];
  for (let i = 0; i < items.length; i += batchSize) {
    batches.push(items.slice(i, Math.min(i + batchSize, items.length)));
  }
  return batches;
};

export async function detectChapters(params: DetectChaptersParams): Promise<DetectChaptersResult> {
  const {
    segments,
    batchSize,
    minChapterLength,
    maxChapterLength,
    tagsAvailable,
    customPrompt,
    onProgress,
    onBatchLog,
    onBatchComplete,
    signal,
    providerId,
    model,
  } = params;

  const issues: ChapterDetectionIssue[] = [];
  const batchLog: ChapterDetectionBatchLogEntry[] = [];
  const createdAt = Date.now();
  const globalMapping = createChapterBatchMapping({
    batchIndex: 0,
    totalBatches: 1,
    segments,
  });

  if (segments.length === 0) {
    return { chapters: [], issues, batchLog };
  }

  const safeBatchSize = Math.max(
    1,
    Math.min(batchSize || chapterDetectionConfig.defaultBatchSize, 500),
  );
  const batches = sliceIntoBatches(segments, safeBatchSize);

  const detected: DetectChaptersResult["chapters"] = [];
  let previousChapterSummaryBlock = "";

  for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
    if (signal?.aborted) {
      issues.push({ level: "warn", message: "Chapter detection cancelled by user" });
      break;
    }

    const batchSegments = batches[batchIndex] ?? [];
    const batchStart = Date.now();
    const mapping = createChapterBatchMapping({
      batchIndex,
      totalBatches: batches.length,
      segments: batchSegments,
    });

    const variables: PromptVariables = {
      batchIndex: batchIndex + 1,
      totalBatches: batches.length,
      batchSize: batchSegments.length,
      minChapterLength,
      maxChapterLength,
      tagsAvailable: formatTagsForPrompt(tagsAvailable),
      segments: formatSegmentsForPrompt(batchSegments, mapping),
      previousChapter: previousChapterSummaryBlock,
    };

    const systemPrompt = customPrompt?.systemPrompt ?? chapterDetectionConfig.systemPrompt;
    const userPromptTemplate =
      customPrompt?.userPromptTemplate ?? chapterDetectionConfig.userPromptTemplate;
    const requestPayload = `SYSTEM\n${compileTemplate(systemPrompt, variables)}\n\nUSER\n${compileTemplate(
      userPromptTemplate,
      variables,
    )}`;

    const result = await executeFeature<ChapterDetectionResponse>("chapter-detection", variables, {
      providerId,
      model,
      signal,
      customPrompt,
    });

    if (!result.success || !result.data) {
      const batchIssues: ChapterDetectionIssue[] = [
        {
          level: "error",
          message: result.error ?? `Batch ${batchIndex + 1} failed`,
          context: { batchIndex },
        },
      ];
      issues.push(...batchIssues);
      const logEntry: ChapterDetectionBatchLogEntry = {
        batchIndex,
        batchSize: batchSegments.length,
        rawItemCount: 0,
        suggestionCount: 0,
        processedTotal: batchIndex + 1,
        totalExpected: batches.length,
        issues: batchIssues,
        loggedAt: Date.now(),
        batchDurationMs: Date.now() - batchStart,
        elapsedMs: Date.now() - createdAt,
        fatal: true,
        requestPayload,
        responsePayload:
          typeof result.rawResponse === "string"
            ? result.rawResponse
            : result.rawResponse
              ? JSON.stringify(result.rawResponse)
              : undefined,
      };
      batchLog.push(logEntry);
      onBatchLog?.(logEntry);
      onProgress?.(batchIndex + 1, batches.length);
      continue;
    }

    const mapped = mapResponseToRealSegmentIds(result.data, mapping, globalMapping);
    // Notify caller about per-batch mapped chapters so they can be applied incrementally.
    onBatchComplete?.(batchIndex, mapped);
    const indexById = new Map(batchSegments.map((s, idx) => [s.id, idx]));

    for (const ch of mapped) {
      const first = ch.startSegmentId;
      const last = ch.endSegmentId;
      if (!first || !last) continue;

      detected.push({
        id: `ai-chapter-${createdAt}-${batchIndex}-${detected.length}`,
        title: ch.title,
        summary: ch.summary,
        notes: ch.notes,
        tags: ch.tags,
        startSegmentId: first,
        endSegmentId: last,
        segmentCount:
          indexById.has(first) && indexById.has(last)
            ? Math.max(0, (indexById.get(last) ?? 0) - (indexById.get(first) ?? 0) + 1)
            : 0,
        createdAt,
        source: "ai",
      });
    }

    const lastDetected = detected[detected.length - 1];
    previousChapterSummaryBlock = lastDetected
      ? `PREVIOUS CHAPTER CONTEXT
------------------------
Title: ${lastDetected.title}
Summary: ${lastDetected.summary ?? "(none)"}
`
      : "";

    onProgress?.(batchIndex + 1, batches.length);

    const logEntry: ChapterDetectionBatchLogEntry = {
      batchIndex,
      batchSize: batchSegments.length,
      rawItemCount: Array.isArray(result.data.chapters) ? result.data.chapters.length : 0,
      suggestionCount: mapped.length,
      processedTotal: batchIndex + 1,
      totalExpected: batches.length,
      issues: [],
      loggedAt: Date.now(),
      batchDurationMs: Date.now() - batchStart,
      elapsedMs: Date.now() - createdAt,
      fatal: false,
      requestPayload,
      responsePayload:
        typeof result.rawResponse === "string"
          ? result.rawResponse
          : result.rawResponse
            ? JSON.stringify(result.rawResponse)
            : undefined,
    };
    batchLog.push(logEntry);
    onBatchLog?.(logEntry);
  }

  return { chapters: detected, issues, batchLog };
}
