import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useTranscriptStore } from "@/lib/store";
import { resetStore, sampleSegments } from "./storeTestUtils";

describe("Id generation", () => {
  beforeEach(() => {
    resetStore();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("loads transcripts when crypto.randomUUID is unavailable", () => {
    vi.stubGlobal("crypto", {
      getRandomValues: (buffer: Uint8Array) => {
        for (let i = 0; i < buffer.length; i += 1) {
          buffer[i] = (i * 31) % 256;
        }
        return buffer;
      },
    });

    expect(() =>
      useTranscriptStore.getState().loadTranscript({ segments: sampleSegments }),
    ).not.toThrow();

    const { segments, speakers } = useTranscriptStore.getState();
    expect(segments).toHaveLength(2);
    expect(speakers).toHaveLength(2);
    expect(speakers[0]?.id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );
  });

  it("adds tags when crypto.randomUUID is unavailable", () => {
    vi.stubGlobal("crypto", {
      getRandomValues: (buffer: Uint8Array) => {
        for (let i = 0; i < buffer.length; i += 1) {
          buffer[i] = (i * 17) % 256;
        }
        return buffer;
      },
    });

    expect(() => useTranscriptStore.getState().addTag("Production")).not.toThrow();

    const { tags } = useTranscriptStore.getState();
    expect(tags).toHaveLength(1);
    expect(tags[0]?.id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );
  });

  it("imports transcript tags when crypto.randomUUID is unavailable", () => {
    vi.stubGlobal("crypto", {
      getRandomValues: (buffer: Uint8Array) => {
        for (let i = 0; i < buffer.length; i += 1) {
          buffer[i] = (i * 13) % 256;
        }
        return buffer;
      },
    });

    expect(() =>
      useTranscriptStore.getState().loadTranscript({
        segments: [
          {
            ...sampleSegments[0],
            tags: ["Interview"],
          },
        ],
      }),
    ).not.toThrow();

    const { tags } = useTranscriptStore.getState();
    expect(tags).toHaveLength(1);
    expect(tags[0]?.name).toBe("Interview");
    expect(tags[0]?.id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );
  });
});
