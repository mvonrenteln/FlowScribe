/**
 * BackupStatusIndicator tests
 *
 * Covers the paused-state reconnect affordance: one-shot toast when the backup
 * pauses, in-place reauthorization on click, and the settings fallback.
 */

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { resetStore } from "@/lib/__tests__/storeTestUtils";
import { useTranscriptStore } from "@/lib/store";
import { BackupStatusIndicator } from "../BackupStatusIndicator";

vi.mock("@/hooks/use-toast", () => ({
  toast: vi.fn(),
}));

import { toast } from "@/hooks/use-toast";

const mockToast = vi.mocked(toast);

const mockReauthorize = vi.fn(
  async (): Promise<{ ok: true; locationLabel: string } | { ok: false; error: string }> => ({
    ok: true,
    locationLabel: "backup-dir",
  }),
);

function setBackupPaused() {
  useTranscriptStore.setState({
    backupConfig: {
      ...useTranscriptStore.getState().backupConfig,
      enabled: true,
      providerType: "filesystem",
    },
    backupState: {
      ...useTranscriptStore.getState().backupState,
      status: "paused",
      lastError: "Backup folder not accessible",
    },
  });
}

beforeEach(() => {
  resetStore();
  vi.clearAllMocks();
  (window as Window & { __backupScheduler?: unknown }).__backupScheduler = {
    reauthorize: mockReauthorize,
    triggerDownload: vi.fn(),
    hasPendingDownload: vi.fn(() => false),
  };
});

afterEach(() => {
  delete (window as Window & { __backupScheduler?: unknown }).__backupScheduler;
});

describe("BackupStatusIndicator paused reconnect", () => {
  it("shows a reconnect toast once when the backup is paused", () => {
    setBackupPaused();
    render(<BackupStatusIndicator />);

    expect(mockToast).toHaveBeenCalledTimes(1);
  });

  it("does not show a toast when backup is enabled and healthy", () => {
    useTranscriptStore.setState({
      backupConfig: { ...useTranscriptStore.getState().backupConfig, enabled: true },
      backupState: { ...useTranscriptStore.getState().backupState, status: "enabled" },
    });
    render(<BackupStatusIndicator />);

    expect(mockToast).not.toHaveBeenCalled();
  });

  it("clicking the paused indicator reauthorizes in place and shows a success toast", async () => {
    setBackupPaused();
    render(<BackupStatusIndicator />);
    mockToast.mockClear();

    fireEvent.click(screen.getByRole("button"));

    await waitFor(() => expect(mockReauthorize).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(mockToast).toHaveBeenCalledTimes(1));
  });

  it("falls back to opening backup settings when reauthorization fails", async () => {
    mockReauthorize.mockResolvedValueOnce({ ok: false, error: "Cancelled" });
    const onOpenSettings = vi.fn();
    setBackupPaused();
    render(<BackupStatusIndicator onOpenSettings={onOpenSettings} />);

    fireEvent.click(screen.getByRole("button"));

    await waitFor(() => expect(onOpenSettings).toHaveBeenCalledWith("backup"));
  });
});
