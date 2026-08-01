import { describe, expect, it } from "vitest";
import type { StructuredBatchParserFailure } from "../../parsing/types";
import type { ChatMessage } from "../../providers/types";
import { buildCorrectiveRetryMessages, buildRepairInstruction } from "../correctiveRetry";

const baseMessages: ChatMessage[] = [
  { role: "system", content: "You are a helpful classifier." },
  { role: "user", content: "Classify these segments: [1] Hello" },
];

describe("buildRepairInstruction", () => {
  it("names the parser error code and message", () => {
    const failure: StructuredBatchParserFailure = {
      code: "SCHEMA_MISMATCH",
      message: "data[0].tag is required",
      diagnostics: [
        {
          path: "data[0].tag",
          message: "Required field missing",
          expected: "string",
          actual: undefined,
        },
      ],
    };
    const instruction = buildRepairInstruction(failure);
    expect(instruction).toContain("SCHEMA_MISMATCH");
    expect(instruction).toContain("data[0].tag is required");
    expect(instruction).toContain("data[0].tag");
    expect(instruction).toContain("Required field missing");
  });

  it("asks for a complete replacement matching the original contract", () => {
    const failure: StructuredBatchParserFailure = {
      code: "INVALID_JSON",
      message: "Unexpected end of input",
      diagnostics: [],
    };
    const instruction = buildRepairInstruction(failure);
    expect(instruction.toLowerCase()).toContain("complete");
    expect(instruction.toLowerCase()).toContain("replacement");
  });

  it("handles an empty diagnostics array without producing an empty field list", () => {
    const failure: StructuredBatchParserFailure = {
      code: "EMPTY_RESPONSE",
      message: "The response body was empty",
      diagnostics: [],
    };
    const instruction = buildRepairInstruction(failure);
    expect(instruction).toContain("EMPTY_RESPONSE");
    expect(instruction).not.toContain("undefined");
  });

  it("does not leak implementation details beyond path/expected/actual", () => {
    const failure: StructuredBatchParserFailure = {
      code: "SCHEMA_MISMATCH",
      message: "data[0].confidence has the wrong type",
      diagnostics: [
        { path: "data[0].confidence", message: "Wrong type", expected: "number", actual: "high" },
      ],
    };
    const instruction = buildRepairInstruction(failure);
    expect(instruction).not.toContain("SimpleSchema");
    expect(instruction).not.toContain("ValidationError");
  });
});

describe("buildCorrectiveRetryMessages", () => {
  const failure: StructuredBatchParserFailure = {
    code: "SCHEMA_MISMATCH",
    message: "data[0].tag is required",
    diagnostics: [{ path: "data[0].tag", message: "Required field missing" }],
  };

  it("preserves the original prefix unchanged", () => {
    const result = buildCorrectiveRetryMessages(baseMessages, "{}", failure);
    expect(result[0]).toEqual(baseMessages[0]);
    expect(result[1]).toEqual(baseMessages[1]);
  });

  it("appends the invalid assistant response as the next message", () => {
    const result = buildCorrectiveRetryMessages(baseMessages, '{"bad": true}', failure);
    expect(result[2]).toEqual({ role: "assistant", content: '{"bad": true}' });
  });

  it("appends a user repair instruction as the final message", () => {
    const result = buildCorrectiveRetryMessages(baseMessages, '{"bad": true}', failure);
    expect(result[3].role).toBe("user");
    expect(result[3].content).toContain("SCHEMA_MISMATCH");
  });

  it("does not mutate the input array", () => {
    const originalLength = baseMessages.length;
    buildCorrectiveRetryMessages(baseMessages, "{}", failure);
    expect(baseMessages.length).toBe(originalLength);
  });

  it("returns exactly four messages for a two-message prefix", () => {
    const result = buildCorrectiveRetryMessages(baseMessages, "{}", failure);
    expect(result).toHaveLength(4);
  });
});
