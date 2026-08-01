/**
 * Structured Batch Response Parser Tests
 *
 * Tests for the structured-batch envelope parser used by AI features that
 * opt into `responseFormat: "structured-batch"`.
 */

import { describe, expect, it } from "vitest";
import {
  parseStructuredBatchResponse,
  STRUCTURED_BATCH_MODEL_ERROR_RETRYABILITY,
} from "../parsing/structuredBatchResponse";
import type { SimpleSchema } from "../parsing/types";

interface TestItem {
  id: string;
}

const dataSchema: SimpleSchema = {
  type: "array",
  items: {
    type: "object",
    required: ["id"],
    properties: {
      id: { type: "string" },
    },
  },
};

function envelope(overrides: Record<string, unknown>): string {
  return JSON.stringify({
    status: "ok",
    retryable: false,
    data: [],
    error: null,
    ...overrides,
  });
}

describe("parseStructuredBatchResponse", () => {
  it("parses a valid non-empty ok envelope", () => {
    const input = envelope({ status: "ok", data: [{ id: "1" }, { id: "2" }] });
    const result = parseStructuredBatchResponse<TestItem>(input, dataSchema);

    expect(result.success).toBe(true);
    if (!result.success) throw new Error("expected success");
    expect(result.response).toEqual({
      status: "ok",
      retryable: false,
      data: [{ id: "1" }, { id: "2" }],
      error: null,
    });
  });

  it("parses a valid empty envelope", () => {
    const input = envelope({ status: "empty", data: [] });
    const result = parseStructuredBatchResponse<TestItem>(input, dataSchema);

    expect(result.success).toBe(true);
    if (!result.success) throw new Error("expected success");
    expect(result.response).toEqual({
      status: "empty",
      retryable: false,
      data: [],
      error: null,
    });
  });

  it("parses all six valid model error codes with matching retryability", () => {
    for (const [code, retryable] of Object.entries(STRUCTURED_BATCH_MODEL_ERROR_RETRYABILITY)) {
      const input = envelope({
        status: "error",
        retryable,
        data: [],
        error: { code, message: "Something went wrong" },
      });
      const result = parseStructuredBatchResponse<TestItem>(input, dataSchema);

      expect(result.success, `expected success for code ${code}`).toBe(true);
      if (!result.success) throw new Error("expected success");
      expect(result.response).toEqual({
        status: "error",
        retryable,
        data: [],
        error: { code, message: "Something went wrong" },
      });
    }
  });

  it("returns EMPTY_RESPONSE for an empty body", () => {
    const result = parseStructuredBatchResponse<TestItem>("", dataSchema);

    expect(result.success).toBe(false);
    if (result.success) throw new Error("expected failure");
    expect(result.error.code).toBe("EMPTY_RESPONSE");
  });

  it("preserves the extraction error's own code for prose-only input (no JSON at all)", () => {
    const result = parseStructuredBatchResponse<TestItem>("this is not json at all", dataSchema);

    expect(result.success).toBe(false);
    if (result.success) throw new Error("expected failure");
    expect(result.error.code).toBe("NO_JSON_FOUND");
  });

  it("preserves the extraction error's own code for truncated JSON", () => {
    const input = '{"status": "ok", "retryable": false, "data": [{"id": "1"';
    const result = parseStructuredBatchResponse<TestItem>(input, dataSchema);

    expect(result.success).toBe(false);
    if (result.success) throw new Error("expected failure");
    expect(result.error.code).toBe("NO_JSON_FOUND");
  });

  it("rejects an unknown status", () => {
    const input = envelope({ status: "weird" });
    const result = parseStructuredBatchResponse<TestItem>(input, dataSchema);

    expect(result.success).toBe(false);
    if (result.success) throw new Error("expected failure");
    expect(result.error.code).toBe("SCHEMA_MISMATCH");
    expect(result.error.diagnostics.length).toBeGreaterThan(0);
  });

  describe("ok status invariants", () => {
    it("rejects ok with empty data", () => {
      const input = envelope({ status: "ok", data: [] });
      const result = parseStructuredBatchResponse<TestItem>(input, dataSchema);

      expect(result.success).toBe(false);
      if (result.success) throw new Error("expected failure");
      expect(result.error.code).toBe("SCHEMA_MISMATCH");
    });

    it("rejects ok with retryable true", () => {
      const input = envelope({ status: "ok", data: [{ id: "1" }], retryable: true });
      const result = parseStructuredBatchResponse<TestItem>(input, dataSchema);

      expect(result.success).toBe(false);
      if (result.success) throw new Error("expected failure");
      expect(result.error.code).toBe("SCHEMA_MISMATCH");
    });

    it("rejects ok with a non-null error", () => {
      const input = envelope({
        status: "ok",
        data: [{ id: "1" }],
        error: { code: "TEMPORARY_FAILURE", message: "oops" },
      });
      const result = parseStructuredBatchResponse<TestItem>(input, dataSchema);

      expect(result.success).toBe(false);
      if (result.success) throw new Error("expected failure");
      expect(result.error.code).toBe("SCHEMA_MISMATCH");
    });
  });

  describe("empty status invariants", () => {
    it("rejects empty with non-empty data", () => {
      const input = envelope({ status: "empty", data: [{ id: "1" }] });
      const result = parseStructuredBatchResponse<TestItem>(input, dataSchema);

      expect(result.success).toBe(false);
      if (result.success) throw new Error("expected failure");
      expect(result.error.code).toBe("SCHEMA_MISMATCH");
    });

    it("rejects empty with retryable true", () => {
      const input = envelope({ status: "empty", data: [], retryable: true });
      const result = parseStructuredBatchResponse<TestItem>(input, dataSchema);

      expect(result.success).toBe(false);
      if (result.success) throw new Error("expected failure");
      expect(result.error.code).toBe("SCHEMA_MISMATCH");
    });

    it("rejects empty with a non-null error", () => {
      const input = envelope({
        status: "empty",
        data: [],
        error: { code: "TEMPORARY_FAILURE", message: "oops" },
      });
      const result = parseStructuredBatchResponse<TestItem>(input, dataSchema);

      expect(result.success).toBe(false);
      if (result.success) throw new Error("expected failure");
      expect(result.error.code).toBe("SCHEMA_MISMATCH");
    });
  });

  describe("error status invariants", () => {
    it("rejects error with non-empty data", () => {
      const input = envelope({
        status: "error",
        retryable: true,
        data: [{ id: "1" }],
        error: { code: "TEMPORARY_FAILURE", message: "oops" },
      });
      const result = parseStructuredBatchResponse<TestItem>(input, dataSchema);

      expect(result.success).toBe(false);
      if (result.success) throw new Error("expected failure");
      expect(result.error.code).toBe("SCHEMA_MISMATCH");
    });

    it("rejects error with a null error field", () => {
      const input = envelope({ status: "error", retryable: true, data: [], error: null });
      const result = parseStructuredBatchResponse<TestItem>(input, dataSchema);

      expect(result.success).toBe(false);
      if (result.success) throw new Error("expected failure");
      expect(result.error.code).toBe("SCHEMA_MISMATCH");
    });

    it("rejects error with an unknown code", () => {
      const input = envelope({
        status: "error",
        retryable: true,
        data: [],
        error: { code: "NOT_A_REAL_CODE", message: "oops" },
      });
      const result = parseStructuredBatchResponse<TestItem>(input, dataSchema);

      expect(result.success).toBe(false);
      if (result.success) throw new Error("expected failure");
      expect(result.error.code).toBe("SCHEMA_MISMATCH");
    });

    it("rejects error with an empty message", () => {
      const input = envelope({
        status: "error",
        retryable: true,
        data: [],
        error: { code: "TEMPORARY_FAILURE", message: "" },
      });
      const result = parseStructuredBatchResponse<TestItem>(input, dataSchema);

      expect(result.success).toBe(false);
      if (result.success) throw new Error("expected failure");
      expect(result.error.code).toBe("SCHEMA_MISMATCH");
    });

    it("rejects error with mismatched retryability", () => {
      const input = envelope({
        status: "error",
        retryable: true,
        data: [],
        error: { code: "MISSING_REQUIRED_INPUT", message: "oops" },
      });
      const result = parseStructuredBatchResponse<TestItem>(input, dataSchema);

      expect(result.success).toBe(false);
      if (result.success) throw new Error("expected failure");
      expect(result.error.code).toBe("SCHEMA_MISMATCH");
    });
  });

  it("returns SCHEMA_MISMATCH with field diagnostics for invalid ok.data", () => {
    const input = envelope({ status: "ok", data: [{ notAnId: "1" }] });
    const result = parseStructuredBatchResponse<TestItem>(input, dataSchema);

    expect(result.success).toBe(false);
    if (result.success) throw new Error("expected failure");
    expect(result.error.code).toBe("SCHEMA_MISMATCH");
    expect(result.error.diagnostics.length).toBeGreaterThan(0);
    expect(result.error.diagnostics[0].path).toContain("id");
  });

  it("rejects a top-level raw array", () => {
    const input = JSON.stringify([{ id: "1" }]);
    const result = parseStructuredBatchResponse<TestItem>(input, dataSchema);

    expect(result.success).toBe(false);
    if (result.success) throw new Error("expected failure");
    expect(result.error.code).toBe("SCHEMA_MISMATCH");
  });
});
