/**
 * Corrective retry message construction.
 *
 * @module ai/core/correctiveRetry
 */

import type { StructuredBatchParserFailure } from "../parsing/types";
import type { ChatMessage } from "../providers/types";

function formatDiagnostics(diagnostics: StructuredBatchParserFailure["diagnostics"]): string {
  if (diagnostics.length === 0) {
    return "";
  }

  const lines = diagnostics.map((diagnostic) => {
    const expectedPart =
      diagnostic.expected !== undefined ? ` (expected ${diagnostic.expected})` : "";
    return `- ${diagnostic.path}: ${diagnostic.message}${expectedPart}`;
  });

  return `\n\nField issues:\n${lines.join("\n")}`;
}

/**
 * Builds the instruction sent back to the model describing why its previous
 * structured-batch response was rejected and what a corrected response must look like.
 *
 * @param parserFailure - The parse/validation failure produced for the invalid response.
 * @returns A user-facing repair instruction string.
 */
export function buildRepairInstruction(parserFailure: StructuredBatchParserFailure): string {
  const diagnosticsBlock = formatDiagnostics(parserFailure.diagnostics);

  return (
    `Your previous response could not be used: ${parserFailure.code} - ${parserFailure.message}.` +
    `${diagnosticsBlock}\n\n` +
    "Return a complete replacement response that matches the original response contract exactly. " +
    "Do not reference this message or explain the correction; return only the corrected response."
  );
}

/**
 * Builds the message list for a corrective retry: the original conversation prefix,
 * the model's invalid response (as an assistant turn), and a user repair instruction.
 *
 * @param baseMessages - The original conversation messages sent to the model.
 * @param invalidResponseContent - The raw content of the rejected model response.
 * @param parserFailure - The parse/validation failure describing what was wrong.
 * @returns A new message array; `baseMessages` is not mutated.
 */
export function buildCorrectiveRetryMessages(
  baseMessages: ChatMessage[],
  invalidResponseContent: string,
  parserFailure: StructuredBatchParserFailure,
): ChatMessage[] {
  return [
    ...baseMessages,
    { role: "assistant", content: invalidResponseContent },
    { role: "user", content: buildRepairInstruction(parserFailure) },
  ];
}
