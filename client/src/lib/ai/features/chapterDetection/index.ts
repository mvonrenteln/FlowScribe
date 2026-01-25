/**
 * Chapter Detection Feature
 *
 * Public exports for chapter detection.
 *
 * @module ai/features/chapterDetection
 */

export {
  CHAPTER_DETECTION_SYSTEM_PROMPT,
  CHAPTER_DETECTION_USER_PROMPT_TEMPLATE,
  chapterDetectionConfig,
  chapterDetectionResponseSchema,
} from "./config";
export { detectChapters } from "./service";
export type {
  ChapterDetectionBatch,
  ChapterDetectionConfig,
  ChapterDetectionIssue,
  ChapterDetectionResponse,
} from "./types";
