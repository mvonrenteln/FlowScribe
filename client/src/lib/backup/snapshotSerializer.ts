import type { SessionSnapshot } from "./types";

/**
 * Compress bytes using native CompressionStream (gzip) with pako as fallback.
 */
export async function compress(bytes: Uint8Array): Promise<Uint8Array> {
  if (typeof CompressionStream !== "undefined") {
    try {
      const cs = new CompressionStream("gzip");
      const writer = cs.writable.getWriter();
      // Cast required: TypeScript is strict about Uint8Array<ArrayBufferLike> vs ArrayBuffer
      writer.write(bytes as Uint8Array<ArrayBuffer>);
      writer.close();
      const chunks: Uint8Array[] = [];
      const reader = cs.readable.getReader();
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value);
      }
      const totalLength = chunks.reduce((sum, c) => sum + c.length, 0);
      const result = new Uint8Array(totalLength);
      let offset = 0;
      for (const chunk of chunks) {
        result.set(chunk, offset);
        offset += chunk.length;
      }
      return result;
    } catch (_e) {
      // fall through to pako
    }
  }
  const { gzip } = await import("pako");
  return gzip(bytes);
}

/**
 * Decompress gzip bytes using native DecompressionStream with pako as fallback.
 */
export async function decompress(bytes: Uint8Array): Promise<Uint8Array> {
  if (typeof DecompressionStream !== "undefined") {
    try {
      const ds = new DecompressionStream("gzip");
      const writer = ds.writable.getWriter();
      writer.write(bytes as Uint8Array<ArrayBuffer>);
      writer.close();
      const chunks: Uint8Array[] = [];
      const reader = ds.readable.getReader();
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value);
      }
      const totalLength = chunks.reduce((sum, c) => sum + c.length, 0);
      const result = new Uint8Array(totalLength);
      let offset = 0;
      for (const chunk of chunks) {
        result.set(chunk, offset);
        offset += chunk.length;
      }
      return result;
    } catch (_e) {
      // fall through to pako
    }
  }
  const { ungzip } = await import("pako");
  return ungzip(bytes);
}

/**
 * Compute a SHA-256 hex checksum of a JSON string.
 */
export async function computeChecksum(json: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(json);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Serialize and compress a SessionSnapshot.
 * Embeds checksum for integrity verification on restore.
 */
export async function serializeSnapshot(snapshot: SessionSnapshot): Promise<Uint8Array> {
  // First pass: JSON without checksum to compute it
  const snapshotWithoutChecksum = { ...snapshot, checksum: "" };
  const jsonForChecksum = JSON.stringify(snapshotWithoutChecksum);
  const checksum = await computeChecksum(jsonForChecksum);

  // Second pass: JSON with checksum embedded
  const finalSnapshot = { ...snapshot, checksum };
  const json = JSON.stringify(finalSnapshot);
  const encoder = new TextEncoder();
  const bytes = encoder.encode(json);
  return compress(bytes);
}

/**
 * Decompress and deserialize a SessionSnapshot.
 * Throws if the checksum does not match (data corruption).
 */
export async function deserializeSnapshot(data: Uint8Array): Promise<SessionSnapshot> {
  const bytes = await decompress(data);
  const decoder = new TextDecoder();
  const json = decoder.decode(bytes);
  const snapshot = JSON.parse(json) as SessionSnapshot;

  // Verify checksum
  const storedChecksum = snapshot.checksum;
  const snapshotWithoutChecksum = { ...snapshot, checksum: "" };
  const jsonForChecksum = JSON.stringify(snapshotWithoutChecksum);
  const computedChecksum = await computeChecksum(jsonForChecksum);

  if (storedChecksum !== computedChecksum) {
    throw new Error(
      `Snapshot checksum mismatch: expected ${computedChecksum}, got ${storedChecksum}`,
    );
  }

  return snapshot;
}
