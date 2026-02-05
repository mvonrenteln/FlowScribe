/**
 * Chapter Detection Service
 *
 * Runs AI-driven chapter detection across a transcript in batches,
 * using SimpleID mapping (1..n) to avoid exposing real segment IDs.
 *
 * @module ai/features/chapterDetection/service
 */

import { executeFeature, runBatchCoordinator } from "@/lib/ai/core";
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
  let processedBatches = 0;
  const totalBatches = batches.length;
  const concurrency = 1;

  await runBatchCoordinator({
    inputs: Array.from({ length: totalBatches }, (_, index) => index),
    concurrency,
    signal,
    prepareYieldEvery: 5,
    emitYieldEvery: 5,
    prepare: (batchIndex) => {
      const batchSegments = batches[batchIndex] ?? [];
      const mapping = createChapterBatchMapping({
        batchIndex,
        totalBatches,
        segments: batchSegments,
      });

      return {
        batchIndex,
        batchSegments,
        mapping,
      };
    },
    execute: async (prepared) => {
      const batchStart = Date.now();
      const variables: PromptVariables = {
        batchIndex: prepared.batchIndex + 1,
        totalBatches,
        batchSize: prepared.batchSegments.length,
        minChapterLength,
        maxChapterLength,
        tagsAvailable: formatTagsForPrompt(tagsAvailable),
        segments: formatSegmentsForPrompt(prepared.batchSegments, prepared.mapping),
        previousChapter: previousChapterSummaryBlock,
      };

      const systemPrompt = customPrompt?.systemPrompt ?? chapterDetectionConfig.systemPrompt;
      const userPromptTemplate =
        customPrompt?.userPromptTemplate ?? chapterDetectionConfig.userPromptTemplate;
      const requestPayload = `SYSTEM\n${compileTemplate(
        systemPrompt,
        variables,
      )}\n\nUSER\n${compileTemplate(userPromptTemplate, variables)}`;

      let result: Awaited<ReturnType<typeof executeFeature<ChapterDetectionResponse>>>;
      try {
        result = await executeFeature<ChapterDetectionResponse>("chapter-detection", variables, {
          providerId,
          model,
          signal,
          customPrompt,
          onRetry: (retryInfo) => {
            const retryLogEntry: ChapterDetectionBatchLogEntry = {
              batchIndex: prepared.batchIndex,
              batchSize: prepared.batchSegments.length,
              rawItemCount: 0,
              suggestionCount: 0,
              processedTotal: prepared.batchIndex + 1,
              totalExpected: totalBatches,
              issues: [
                {
                  level: "warn",
                  message: `Retry ${retryInfo.attempt} - ${retryInfo.errorMessage}`,
                },
              ],
              loggedAt: Date.now(),
              batchDurationMs: retryInfo.attemptDurationMs,
              elapsedMs: Date.now() - createdAt,
              fatal: false,
              requestPayload,
            };
            batchLog.push(retryLogEntry);
            onBatchLog?.(retryLogEntry);
          },
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        const batchIssues: ChapterDetectionIssue[] = [
          {
            level: "error",
            message,
            context: { batchIndex: prepared.batchIndex },
          },
        ];

        return {
          status: "failed" as const,
          batchIndex: prepared.batchIndex,
          batchSize: prepared.batchSegments.length,
          mapped: [],
          issues: batchIssues,
          rawItemCount: 0,
          requestPayload,
          responsePayload: undefined,
          batchDurationMs: Date.now() - batchStart,
        };
      }

      const responsePayload =
        typeof result.rawResponse === "string"
          ? result.rawResponse
          : result.rawResponse
            ? JSON.stringify(result.rawResponse)
            : undefined;

      if (!result.success || !result.data) {
        const batchIssues: ChapterDetectionIssue[] = [
          {
            level: "error",
            message: result.error ?? `Batch ${prepared.batchIndex + 1} failed`,
            context: { batchIndex: prepared.batchIndex },
          },
        ];

        return {
          status: "failed" as const,
          batchIndex: prepared.batchIndex,
          batchSize: prepared.batchSegments.length,
          mapped: [],
          issues: batchIssues,
          rawItemCount: 0,
          requestPayload,
          responsePayload,
          batchDurationMs: Date.now() - batchStart,
        };
      }

      const mapped = mapResponseToRealSegmentIds(result.data, prepared.mapping, globalMapping);
      const indexById = new Map(prepared.batchSegments.map((s, idx) => [s.id, idx]));

      for (const ch of mapped) {
        const first = ch.startSegmentId;
        const last = ch.endSegmentId;
        if (!first || !last) continue;

        detected.push({
          id: `ai-chapter-${createdAt}-${prepared.batchIndex}-${detected.length}`,
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

      return {
        status: "success" as const,
        batchIndex: prepared.batchIndex,
        batchSize: prepared.batchSegments.length,
        mapped,
        issues: [],
        rawItemCount: Array.isArray(result.data.chapters) ? result.data.chapters.length : 0,
        requestPayload,
        responsePayload,
        batchDurationMs: Date.now() - batchStart,
      };
    },
    onItemComplete: (_, outcome) => {
      processedBatches++;

      if (outcome.status === "failed") {
        issues.push(...outcome.issues);
        const logEntry: ChapterDetectionBatchLogEntry = {
          batchIndex: outcome.batchIndex,
          batchSize: outcome.batchSize,
          rawItemCount: outcome.rawItemCount,
          suggestionCount: outcome.mapped.length,
          processedTotal: processedBatches,
          totalExpected: totalBatches,
          issues: outcome.issues,
          loggedAt: Date.now(),
          batchDurationMs: outcome.batchDurationMs,
          elapsedMs: Date.now() - createdAt,
          fatal: true,
          requestPayload: outcome.requestPayload,
          responsePayload: outcome.responsePayload,
        };
        batchLog.push(logEntry);
        onBatchLog?.(logEntry);
        onProgress?.(processedBatches, totalBatches);
        return;
      }

      onBatchComplete?.(outcome.batchIndex, outcome.mapped);
      onProgress?.(processedBatches, totalBatches);

      const logEntry: ChapterDetectionBatchLogEntry = {
        batchIndex: outcome.batchIndex,
        batchSize: outcome.batchSize,
        rawItemCount: outcome.rawItemCount,
        suggestionCount: outcome.mapped.length,
        processedTotal: processedBatches,
        totalExpected: totalBatches,
        issues: [],
        loggedAt: Date.now(),
        batchDurationMs: outcome.batchDurationMs,
        elapsedMs: Date.now() - createdAt,
        fatal: false,
        requestPayload: outcome.requestPayload,
        responsePayload: outcome.responsePayload,
      };
      batchLog.push(logEntry);
      onBatchLog?.(logEntry);
    },
  });

  if (signal?.aborted) {
    issues.push({ level: "warn", message: "Chapter detection cancelled by user" });
  }

  return { chapters: detected, issues, batchLog };
}
