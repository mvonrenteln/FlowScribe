/**
 * Text Revision Feature
 *
 * Public API for the text revision feature.
 *
 * @module ai/features/revision
 */

// Configuration
export {
  BUILTIN_REVISION_TEMPLATES,
  findTemplate,
  getDefaultTemplate,
  REVISION_CLARITY_SYSTEM_PROMPT,
  REVISION_CLEANUP_SYSTEM_PROMPT,
  REVISION_CLEANUP_USER_TEMPLATE,
  REVISION_FORMALIZE_SYSTEM_PROMPT,
  textRevisionConfig,
} from "./config";
// Service
export {
  buildRevisionPrompt,
  getChangePreview,
  hasChanges,
  reviseSegment,
  reviseSegmentsBatch,
} from "./service";
// Types
export type {
  BatchRevisionParams,
  BatchRevisionResult,
  RevisionIssue,
  RevisionResult,
  RevisionTemplate,
  SingleRevisionParams,
} from "./types";
