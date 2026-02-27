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

vi.mock("@/lib/backup/providers/FileSystemProvider", () => ({
  FileSystemProvider: vi.fn().mockImplementation(() => ({
    enable: vi.fn(async () => ({ ok: true, locationLabel: "test-dir" })),
  })),
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

import { clearDirtyUnloadFlag, readDirtyUnloadFlag } from "@/lib/backup/dirtyUnloadFlag";
import { FileSystemProvider } from "@/lib/backup/providers/FileSystemProvider";

const mockReadFlag = vi.mocked(readDirtyUnloadFlag);
const mockClearFlag = vi.mocked(clearDirtyUnloadFlag);
const MockFileSystemProvider = vi.mocked(FileSystemProvider);

const mockBackupNow = vi.fn(async () => undefined);

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
    window as Window & { __backupScheduler?: { backupNow: typeof mockBackupNow } }
  ).__backupScheduler = { backupNow: mockBackupNow };
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
    MockFileSystemProvider.mockImplementationOnce(
      () =>
        ({
          enable: vi.fn(async () => ({ ok: true as const, locationLabel: "my-folder" })),
        }) as unknown as InstanceType<typeof FileSystemProvider>,
    );
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
    expect(mockClearFlag).toHaveBeenCalled();
  });

  it("variant B: re-authorize failure shows error message", async () => {
    setFlagPresent();
    setBackupEnabled("error");
    MockFileSystemProvider.mockImplementationOnce(
      () =>
        ({
          enable: vi.fn(async () => ({ ok: false as const, error: "permission denied" })),
        }) as unknown as InstanceType<typeof FileSystemProvider>,
    );

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
    expect(mockClearFlag).not.toHaveBeenCalled();
  });
});
