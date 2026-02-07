import { beforeEach, describe, expect, it, vi } from "vitest";

// Under test
import { executeFeature } from "@/lib/ai/core/aiFeatureService";

// Hoisted mocks
const mockResolveProvider = vi.hoisted(() =>
  vi.fn(async () => {
    const service = {
      chat: (_messages: unknown[]) => {
        const e = new Error("Request timed out after 1s");
        e.name = "AbortError";
        return Promise.reject(e);
      },
    } as const;

    return {
      config: { id: "test-provider", model: "test-model" },
      service,
    };
  }),
);

vi.mock("@/lib/ai/core/providerResolver", async () => ({
  ...(await vi.importActual("@/lib/ai/core/providerResolver")),
  resolveProvider: mockResolveProvider,
}));

// Mock settings to use a short timeout
vi.mock("@/lib/settings/settingsStorage", async () => {
  const actual = await vi.importActual<typeof import("@/lib/settings/settingsStorage")>(
    "@/lib/settings/settingsStorage",
  );
  return {
    ...actual,
    initializeSettings: () => ({
      ...actual.DEFAULT_SETTINGS,
      aiRequestTimeoutSeconds: 1,
      parseRetryCount: 0,
    }),
  };
});

describe("aiFeatureService - timeout handling", () => {
  beforeEach(() => {
    mockResolveProvider.mockClear();
  });

  it("maps provider timeout (AbortError) to CONNECTION_ERROR and user message", async () => {
    const result = await executeFeature("text-revision", { text: "Hello" });

    expect(result.success).toBe(false);
    expect(result.errorCode).toBe("CONNECTION_ERROR");
    // Message may be localized; assert it mentions connection/network
    expect(typeof result.error).toBe("string");
    expect((result.error ?? "").toLowerCase()).toMatch(/connection|network/);
  });
});
