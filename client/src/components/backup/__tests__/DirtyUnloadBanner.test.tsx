/**
 * DirtyUnloadBanner component tests
 *
 * Tests cover: no flag → hidden, variant detection, backup success/failure,
 * dismiss, enable-backups flow, success auto-dismiss, error state.
 */

import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { resetStore } from "@/lib/__tests__/storeTestUtils";
import { useTranscriptStore } from "@/lib/store";
import { DirtyUnloadBanner } from "../DirtyUnloadBanner";

// ---------------------------------------------------------------------------
// Module mocks
// ---------------------------------------------------------------------------

vi.mock("@/lib/backup/dirtyUnloadFlag", () => ({
  readDirtyUnloadFlag: vi.fn(() => ({ present: false })),
  clearDirtyUnloadFlag: vi.fn(),
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

import { clearDirtyUnloadFlag, readDirtyUnloadFlag } from "@/lib/backup/dirtyUnloadFlag";

const mockReadFlag = vi.mocked(readDirtyUnloadFlag);
const mockClearFlag = vi.mocked(clearDirtyUnloadFlag);

const mockBackupNow = vi.fn(async () => undefined);
const mockReauthorize = vi.fn(
  async (): Promise<{ ok: true; locationLabel: string } | { ok: false; error: string }> => ({
    ok: true,
    locationLabel: "test-dir",
  }),
);

function setFlagPresent() {
  mockReadFlag.mockReturnValue({ present: true, age: 1000 });
}

function setBackupEnabled(status: "enabled" | "error" | "disabled" = "enabled") {
  useTranscriptStore.setState({
    backupConfig: {
      ...useTranscriptStore.getState().backupConfig,
      enabled: status !== "disabled",
    },
    backupState: {
      ...useTranscriptStore.getState().backupState,
      status: status === "disabled" ? "disabled" : status === "enabled" ? "enabled" : "error",
      lastError: null,
    },
  });
}

// ---------------------------------------------------------------------------
// Setup / teardown
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.useRealTimers();
  resetStore();
  vi.clearAllMocks();
  mockReadFlag.mockReturnValue({ present: false });

  // Wire __backupScheduler on window
  (
    window as Window & {
      __backupScheduler?: { backupNow: typeof mockBackupNow; reauthorize: typeof mockReauthorize };
    }
  ).__backupScheduler = { backupNow: mockBackupNow, reauthorize: mockReauthorize };
});

afterEach(() => {
  delete (window as Window & { __backupScheduler?: unknown }).__backupScheduler;
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("DirtyUnloadBanner", () => {
  it("renders nothing when no dirty-unload flag is present", () => {
    const { container } = render(<DirtyUnloadBanner />);
    expect(container.firstChild).toBeNull();
  });

  it("shows backup-available variant when flag present and backup enabled+ok", async () => {
    setFlagPresent();
    setBackupEnabled("enabled");

    render(<DirtyUnloadBanner />);

    await waitFor(() => {
      expect(screen.getByText("Unsaved changes detected")).toBeInTheDocument();
    });
    expect(screen.getByText("Create safety backup")).toBeInTheDocument();
  });

  it("shows permission-needed variant when flag present and backup enabled but not ok", async () => {
    setFlagPresent();
    setBackupEnabled("error");

    render(<DirtyUnloadBanner />);

    await waitFor(() => {
      expect(screen.getByText("Unsaved changes detected")).toBeInTheDocument();
    });
    expect(screen.getByText("Re-authorize & backup")).toBeInTheDocument();
  });

  it("shows no-backup variant when flag present and backup disabled", async () => {
    setFlagPresent();
    setBackupEnabled("disabled");

    render(<DirtyUnloadBanner />);

    await waitFor(() => {
      expect(screen.getByText("Unsaved changes detected")).toBeInTheDocument();
    });
    expect(screen.getByText("Enable backups")).toBeInTheDocument();
  });

  it("variant A: shows success message and clears flag after successful backup", async () => {
    setFlagPresent();
    setBackupEnabled("enabled");
    // backupNow succeeds → lastError stays null
    mockBackupNow.mockResolvedValueOnce(undefined);

    render(<DirtyUnloadBanner />);

    await waitFor(() => {
      expect(screen.getByText("Create safety backup")).toBeInTheDocument();
    });

    await act(async () => {
      fireEvent.click(screen.getByText("Create safety backup"));
    });

    await waitFor(() => {
      expect(screen.getByText("Safety backup saved")).toBeInTheDocument();
    });
    expect(mockClearFlag).toHaveBeenCalled();
  });

  it("variant A: shows error message and does NOT clear flag when backup fails", async () => {
    setFlagPresent();
    setBackupEnabled("enabled");
    // Simulate backup failure by setting lastError in store after backupNow
    mockBackupNow.mockImplementationOnce(async () => {
      useTranscriptStore.setState({
        backupState: {
          ...useTranscriptStore.getState().backupState,
          lastError: "disk full",
        },
      });
    });

    render(<DirtyUnloadBanner />);

    await waitFor(() => {
      expect(screen.getByText("Create safety backup")).toBeInTheDocument();
    });

    await act(async () => {
      fireEvent.click(screen.getByText("Create safety backup"));
    });

    await waitFor(() => {
      expect(screen.getByText(/Backup failed/)).toBeInTheDocument();
    });
    expect(mockClearFlag).not.toHaveBeenCalled();
  });

  it("variant A: shows error when scheduler is not available", async () => {
    setFlagPresent();
    setBackupEnabled("enabled");
    // Remove the scheduler to simulate not-ready state
    delete (window as Window & { __backupScheduler?: unknown }).__backupScheduler;

    render(<DirtyUnloadBanner />);

    await waitFor(() => {
      expect(screen.getByText("Create safety backup")).toBeInTheDocument();
    });

    await act(async () => {
      fireEvent.click(screen.getByText("Create safety backup"));
    });

    await waitFor(() => {
      expect(screen.getByText(/Backup failed/)).toBeInTheDocument();
    });
    expect(mockBackupNow).not.toHaveBeenCalled();
    expect(mockClearFlag).not.toHaveBeenCalled();
  });

  it("dismiss button clears flag and hides banner", async () => {
    setFlagPresent();
    setBackupEnabled("enabled");

    render(<DirtyUnloadBanner />);

    await waitFor(() => {
      expect(screen.getByText("Unsaved changes detected")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText("Dismiss"));

    await waitFor(() => {
      expect(screen.queryByText("Unsaved changes detected")).not.toBeInTheDocument();
    });
    expect(mockClearFlag).toHaveBeenCalled();
  });

  it("variant C: calls onOpenSettings and clears flag", async () => {
    setFlagPresent();
    setBackupEnabled("disabled");
    const onOpenSettings = vi.fn();

    render(<DirtyUnloadBanner onOpenSettings={onOpenSettings} />);

    await waitFor(() => {
      expect(screen.getByText("Enable backups")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText("Enable backups"));

    expect(onOpenSettings).toHaveBeenCalledWith("backup");
    expect(mockClearFlag).toHaveBeenCalled();
    await waitFor(() => {
      expect(screen.queryByText("Unsaved changes detected")).not.toBeInTheDocument();
    });
  });

  it("success state auto-dismisses after 4 seconds", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    setFlagPresent();
    setBackupEnabled("enabled");
    mockBackupNow.mockResolvedValueOnce(undefined);

    render(<DirtyUnloadBanner />);

    await waitFor(() => {
      expect(screen.getByText("Create safety backup")).toBeInTheDocument();
    });

    await act(async () => {
      fireEvent.click(screen.getByText("Create safety backup"));
    });

    await waitFor(() => {
      expect(screen.getByText("Safety backup saved")).toBeInTheDocument();
    });

    act(() => {
      vi.advanceTimersByTime(4000);
    });

    await waitFor(() => {
      expect(screen.queryByText("Safety backup saved")).not.toBeInTheDocument();
    });
  });

  it("error state still shows dismiss button", async () => {
    setFlagPresent();
    setBackupEnabled("enabled");
    mockBackupNow.mockImplementationOnce(async () => {
      useTranscriptStore.setState({
        backupState: {
          ...useTranscriptStore.getState().backupState,
          lastError: "network error",
        },
      });
    });

    render(<DirtyUnloadBanner />);

    await waitFor(() => {
      expect(screen.getByText("Create safety backup")).toBeInTheDocument();
    });

    await act(async () => {
      fireEvent.click(screen.getByText("Create safety backup"));
    });

    await waitFor(() => {
      expect(screen.getByText(/Backup failed/)).toBeInTheDocument();
    });

    // Dismiss button should still be present in error state
    expect(screen.getByText("Dismiss")).toBeInTheDocument();
  });

  it("variant B: re-authorize success triggers backup and shows success", async () => {
    setFlagPresent();
    setBackupEnabled("error");
    // reauthorize delegates to the scheduler's own provider — mock returns success
    mockReauthorize.mockResolvedValueOnce({ ok: true, locationLabel: "my-folder" });
    // backupNow succeeds → lastError stays null
    mockBackupNow.mockImplementationOnce(async () => {
      // do not set lastError — success path
    });

    render(<DirtyUnloadBanner />);

    await waitFor(() => {
      expect(screen.getByText("Re-authorize & backup")).toBeInTheDocument();
    });

    await act(async () => {
      fireEvent.click(screen.getByText("Re-authorize & backup"));
    });

    await waitFor(() => {
      expect(screen.getByText("Safety backup saved")).toBeInTheDocument();
    });
    expect(mockReauthorize).toHaveBeenCalled();
    expect(mockClearFlag).toHaveBeenCalled();
  });

  it("variant B: re-authorize failure shows error message", async () => {
    setFlagPresent();
    setBackupEnabled("error");
    mockReauthorize.mockResolvedValueOnce({ ok: false, error: "permission denied" });

    render(<DirtyUnloadBanner />);

    await waitFor(() => {
      expect(screen.getByText("Re-authorize & backup")).toBeInTheDocument();
    });

    await act(async () => {
      fireEvent.click(screen.getByText("Re-authorize & backup"));
    });

    await waitFor(() => {
      expect(screen.getByText(/Backup failed/)).toBeInTheDocument();
    });
    expect(mockReauthorize).toHaveBeenCalled();
    expect(mockBackupNow).not.toHaveBeenCalled();
    expect(mockClearFlag).not.toHaveBeenCalled();
  });

  it("variant B: shows error when scheduler is not available", async () => {
    setFlagPresent();
    setBackupEnabled("error");
    delete (window as Window & { __backupScheduler?: unknown }).__backupScheduler;

    render(<DirtyUnloadBanner />);

    await waitFor(() => {
      expect(screen.getByText("Re-authorize & backup")).toBeInTheDocument();
    });

    await act(async () => {
      fireEvent.click(screen.getByText("Re-authorize & backup"));
    });

    await waitFor(() => {
      expect(screen.getByText(/Backup failed/)).toBeInTheDocument();
    });
    expect(mockReauthorize).not.toHaveBeenCalled();
    expect(mockClearFlag).not.toHaveBeenCalled();
  });

  it("Bug B: banner does NOT re-appear after dismiss when backupState.status changes", async () => {
    setFlagPresent();
    setBackupEnabled("enabled");

    render(<DirtyUnloadBanner />);

    await waitFor(() => {
      expect(screen.getByText("Unsaved changes detected")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText("Dismiss"));

    await waitFor(() => {
      expect(screen.queryByText("Unsaved changes detected")).not.toBeInTheDocument();
    });

    // Simulate status change (e.g. a scheduled backup completing triggers "error")
    act(() => {
      useTranscriptStore.setState({
        backupState: {
          ...useTranscriptStore.getState().backupState,
          status: "error",
          lastError: "disk full",
        },
      });
    });

    // Banner must remain hidden — re-trigger is prevented by hasCheckedRef
    expect(screen.queryByText("Unsaved changes detected")).not.toBeInTheDocument();
  });

  it("Bug B: hasCheckedRef prevents re-showing banner after backupConfig.enabled toggles", async () => {
    setFlagPresent();
    setBackupEnabled("enabled");

    render(<DirtyUnloadBanner />);

    await waitFor(() => {
      expect(screen.getByText("Unsaved changes detected")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText("Dismiss"));

    await waitFor(() => {
      expect(screen.queryByText("Unsaved changes detected")).not.toBeInTheDocument();
    });

    // Toggle enabled off then back on — effect re-runs but hasCheckedRef guards it
    act(() => {
      useTranscriptStore.setState({
        backupConfig: {
          ...useTranscriptStore.getState().backupConfig,
          enabled: false,
        },
      });
    });
    act(() => {
      useTranscriptStore.setState({
        backupConfig: {
          ...useTranscriptStore.getState().backupConfig,
          enabled: true,
        },
      });
    });

    // Banner must remain hidden
    expect(screen.queryByText("Unsaved changes detected")).not.toBeInTheDocument();
  });
});
