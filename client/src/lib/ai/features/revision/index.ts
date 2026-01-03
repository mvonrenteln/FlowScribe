/**
 * Text Revision Feature
 *
 * Public API for the text revision feature.
 *
 * @module ai/features/revision
 */

// Configuration
export {
  BUILTIN_REVISION_PROMPTS,
  findPrompt,
  getDefaultPrompt,
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
  RevisionPrompt,
  RevisionResult,
  SingleRevisionParams,
  TextRevisionInput,
  TextRevisionOutput,
} from "./types";
export type { RevisionContext, RevisionPromptVariables } from "./utils";
// Utilities (pure functions)
export {
  buildRevisionPromptVariables,
  calculateBatchStats,
  createErrorResult,
  createUnchangedResult,
  findContextSegments,
  generateChangePreview,
  hasSubstantiveChanges,
  hasTextChanges,
  normalizeForComparison,
  truncateWithEllipsis,
  validateRevisionPrompt,
} from "./utils";
