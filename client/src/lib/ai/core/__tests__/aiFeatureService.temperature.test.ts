import { beforeEach, describe, expect, it, vi } from "vitest";

import { executeFeature } from "@/lib/ai/core/aiFeatureService";

let capturedTemperature: number | undefined;

const mockResolveProvider = vi.hoisted(() =>
  vi.fn(async () => {
    const service = {
      chat: (_messages: unknown[], options?: { temperature?: number }) => {
        capturedTemperature = options?.temperature;
        return Promise.resolve({ content: "ok" });
      },
    } as const;

    return {
      config: { id: "test-provider", model: "gpt-4o" },
      service,
    };
  }),
);

vi.mock("@/lib/ai/core/providerResolver", async () => ({
  ...(await vi.importActual("@/lib/ai/core/providerResolver")),
  resolveProvider: mockResolveProvider,
}));

vi.mock("@/lib/settings/settingsStorage", async () => {
  const actual = await vi.importActual<typeof import("@/lib/settings/settingsStorage")>(
    "@/lib/settings/settingsStorage",
  );
  return {
    ...actual,
    initializeSettings: () => ({
      ...actual.DEFAULT_SETTINGS,
      aiTemperature: 1.3,
      aiRequestTimeoutSeconds: 0,
      parseRetryCount: 0,
    }),
  };
});

describe("aiFeatureService - temperature defaults", () => {
  beforeEach(() => {
    capturedTemperature = undefined;
    mockResolveProvider.mockClear();
  });

  it("passes the global temperature when none is provided", async () => {
    const result = await executeFeature("text-revision", { text: "Hello" });

    expect(result.success).toBe(true);
    expect(capturedTemperature).toBe(1.3);
  });
});
