import { describe, expect, it } from "vitest";
import {
  compress,
  computeChecksum,
  decompress,
  deserializeSnapshot,
  serializeSnapshot,
  stableStringify,
} from "../snapshotSerializer";
import type { SessionSnapshot } from "../types";
import { SCHEMA_VERSION } from "../types";

const makeSnapshot = (overrides?: Partial<SessionSnapshot>): SessionSnapshot => ({
  schemaVersion: SCHEMA_VERSION,
  appVersion: "1.0.0",
  createdAt: 1000000,
  sessionKey: "test-session-key",
  reason: "manual",
  checksum: "",
  session: {
    audioRef: null,
    transcriptRef: null,
    segments: [],
    speakers: [],
    tags: [],
    selectedSegmentId: null,
    currentTime: 0,
    isWhisperXFormat: false,
  },
  ...overrides,
});

describe("compress / decompress", () => {
  it("roundtrips bytes correctly", async () => {
    const original = new TextEncoder().encode("Hello, FlowScribe backup!");
    const compressed = await compress(original);
    const restored = await decompress(compressed);
    expect(new TextDecoder().decode(restored)).toBe("Hello, FlowScribe backup!");
  });

  it("compressed output is different from input", async () => {
    const original = new TextEncoder().encode('{"key":"value","repeat":"aaaaaaaaaa"}');
    const compressed = await compress(original);
    expect(compressed).not.toEqual(original);
  });

  it("handles empty bytes", async () => {
    const original = new Uint8Array(0);
    const compressed = await compress(original);
    const restored = await decompress(compressed);
    expect(restored.length).toBe(0);
  });
});

describe("computeChecksum", () => {
  it("returns a 64-char hex string", async () => {
    const checksum = await computeChecksum('{"test":true}');
    expect(checksum).toHaveLength(64);
    expect(checksum).toMatch(/^[0-9a-f]+$/);
  });

  it("same input produces same checksum", async () => {
    const json = '{"key":"value"}';
    const cs1 = await computeChecksum(json);
    const cs2 = await computeChecksum(json);
    expect(cs1).toBe(cs2);
  });

  it("different inputs produce different checksums", async () => {
    const cs1 = await computeChecksum('{"a":1}');
    const cs2 = await computeChecksum('{"a":2}');
    expect(cs1).not.toBe(cs2);
  });

  it("same content with different key insertion order yields same checksum", async () => {
    const objectA = {
      reason: "manual",
      session: {
        speakers: [],
        segments: [],
      },
      createdAt: 100,
      checksum: "",
    };
    const objectB = {
      checksum: "",
      createdAt: 100,
      session: {
        segments: [],
        speakers: [],
      },
      reason: "manual",
    };

    const cs1 = await computeChecksum(stableStringify(objectA));
    const cs2 = await computeChecksum(stableStringify(objectB));
    expect(cs1).toBe(cs2);
  });
});

describe("serializeSnapshot / deserializeSnapshot", () => {
  it("roundtrips a snapshot correctly", async () => {
    const snapshot = makeSnapshot();
    const data = await serializeSnapshot(snapshot);
    const restored = await deserializeSnapshot(data);
    expect(restored.sessionKey).toBe(snapshot.sessionKey);
    expect(restored.reason).toBe(snapshot.reason);
    expect(restored.session).toEqual(snapshot.session);
  });

  it("embedded checksum is non-empty after serialize", async () => {
    const snapshot = makeSnapshot();
    const data = await serializeSnapshot(snapshot);
    const restored = await deserializeSnapshot(data);
    expect(restored.checksum).toBeTruthy();
    expect(restored.checksum).toHaveLength(64);
  });

  it("throws on tampered data", async () => {
    const snapshot = makeSnapshot();
    const data = await serializeSnapshot(snapshot);

    // Decompress, tamper with JSON, recompress
    const { decompress: dec, compress: comp } = await import("../snapshotSerializer");
    const bytes = await dec(data);
    const json = new TextDecoder().decode(bytes);
    const tampered = json.replace('"manual"', '"scheduled"');
    const tamperedBytes = await comp(new TextEncoder().encode(tampered));

    await expect(deserializeSnapshot(tamperedBytes)).rejects.toThrow(/checksum/i);
  });

  it("uses pako fallback when CompressionStream is unavailable", async () => {
    const original = globalThis.CompressionStream;
    const originalDecomp = globalThis.DecompressionStream;

    // Remove native API to force pako path
    Object.defineProperty(globalThis, "CompressionStream", {
      value: undefined,
      configurable: true,
      writable: true,
    });
    Object.defineProperty(globalThis, "DecompressionStream", {
      value: undefined,
      configurable: true,
      writable: true,
    });

    try {
      const snapshot = makeSnapshot({ sessionKey: "pako-fallback-test" });
      const data = await serializeSnapshot(snapshot);
      const restored = await deserializeSnapshot(data);
      expect(restored.sessionKey).toBe("pako-fallback-test");
    } finally {
      Object.defineProperty(globalThis, "CompressionStream", {
        value: original,
        configurable: true,
        writable: true,
      });
      Object.defineProperty(globalThis, "DecompressionStream", {
        value: originalDecomp,
        configurable: true,
        writable: true,
      });
    }
  });
});
