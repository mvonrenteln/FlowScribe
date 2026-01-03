/**
 * Text Revision Feature
 *
 * Public API for the text revision feature.
 *
 * @module ai/features/revision
 */

// Configuration
// Deprecated aliases (for backwards compatibility)
export {
  BUILTIN_REVISION_PROMPTS,
  BUILTIN_REVISION_PROMPTS as BUILTIN_REVISION_TEMPLATES,
  findPrompt,
  findPrompt as findTemplate,
  getDefaultPrompt,
  getDefaultPrompt as getDefaultTemplate,
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
// Deprecated type alias
export type {
  BatchRevisionParams,
  BatchRevisionResult,
  RevisionIssue,
  RevisionPrompt,
  RevisionPrompt as RevisionTemplate,
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
