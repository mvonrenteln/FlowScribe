/**
 * AI Parsing Module - Public Exports
 *
 * @module ai/parsing
 */

// JSON Parser
export {
  extractJSON,
  getProperty,
  isArray,
  isObject,
} from "./jsonParser";

// Text Parser
export {
  parseTextResponse,
  parseTextSimple,
  stripQuotes,
  stripCodeBlocks,
  looksLikeError,
  extractFirstParagraph,
  removePreamble,
} from "./text";

export type {
  TextParseOptions,
  TextParseResult,
} from "./text";

// Response Parser
export {
  createTypeGuard,
  parseArrayResponse,
  parseFieldResponse,
  parseObjectResponse,
  parseResponse,
  recoverPartialArray,
} from "./responseParser";

// Types
export type {
  JsonParserOptions,
  ParseErrorCode,
  ParseResult,
  ResponseParserOptions,
  SimpleSchema,
  ValidationError,
  ValidationResult,
} from "./types";
export { ParseError } from "./types";

// Validator
export { validate } from "./validator";
