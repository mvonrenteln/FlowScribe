import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { resetStore } from "@/lib/__tests__/storeTestUtils";
import { useTranscriptStore } from "@/lib/store";
import { BackupSettings } from "../BackupSettings";

describe("BackupSettings", () => {
  beforeEach(() => {
    resetStore();
    Object.defineProperty(window, "showDirectoryPicker", {
      configurable: true,
      value: vi.fn(),
    });
    useTranscriptStore.setState((state) => ({
      ...state,
      backupConfig: {
        ...state.backupConfig,
        enabled: true,
        providerType: "filesystem",
        locationLabel: "old-folder",
      },
      backupState: {
        ...state.backupState,
        status: "enabled",
        lastError: null,
      },
    }));
  });

  it("reauthorizes via scheduler instance when changing folder", async () => {
    const user = userEvent.setup();
    const reauthorize = vi.fn(async () => ({ ok: true as const, locationLabel: "new-folder" }));
    const dispatchSpy = vi.spyOn(window, "dispatchEvent");

    (
      window as Window & {
        __backupScheduler?: { reauthorize: () => Promise<{ ok: true; locationLabel: string }> };
      }
    ).__backupScheduler = { reauthorize };

    render(<BackupSettings />);

    await user.click(screen.getByRole("button", { name: "Change folder" }));

    expect(reauthorize).toHaveBeenCalledTimes(1);
    expect(useTranscriptStore.getState().backupConfig.locationLabel).toBe("new-folder");

    const hasCriticalDispatch = dispatchSpy.mock.calls.some(
      ([event]) =>
        event instanceof CustomEvent &&
        event.type === "flowscribe:backup-critical" &&
        event.detail === null,
    );
    expect(hasCriticalDispatch).toBe(true);
  });

  it("runs manual backup through scheduler on backup now", async () => {
    const user = userEvent.setup();
    const backupNow = vi.fn(async () => undefined);

    (
      window as Window & {
        __backupScheduler?: {
          reauthorize: () => Promise<{ ok: true; locationLabel: string }>;
          backupNow: (reason: "manual") => Promise<void>;
        };
      }
    ).__backupScheduler = {
      reauthorize: async () => ({ ok: true, locationLabel: "folder" }),
      backupNow,
    };

    render(<BackupSettings />);

    await user.click(screen.getByRole("button", { name: "Backup now" }));

    expect(backupNow).toHaveBeenCalledWith("manual");
  });
});
