import { AlertCircle, HardDrive, X } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import type { RestoreCandidate } from "@/lib/backup/restore";
import {
  checkForRestoreCandidate,
  dismissRestoreCheck,
  restoreSnapshot,
} from "@/lib/backup/restore";
import type { SnapshotEntry } from "@/lib/backup/types";
import { useTranscriptStore } from "@/lib/store";

interface RestoreBannerProps {
  onOpenSettings?: (section: string) => void;
}

export function RestoreBanner({ onOpenSettings }: RestoreBannerProps) {
  const backupConfig = useTranscriptStore((s) => s.backupConfig);
  const [candidate, setCandidate] = useState<RestoreCandidate | null>(null);
  const [checked, setChecked] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [nextEntry, setNextEntry] = useState<SnapshotEntry | undefined>(undefined);

  useEffect(() => {
    if (checked) return;
    if (!backupConfig.enabled) return;

    setChecked(true);

    const run = async () => {
      try {
        const { FileSystemProvider } = await import("@/lib/backup/providers/FileSystemProvider");
        const provider = new FileSystemProvider();
        await provider.initialize();

        const { readSessionsState } = await import("@/lib/storage");
        const sessionsState = readSessionsState();

        const found = await checkForRestoreCandidate(provider, sessionsState);
        setCandidate(found);
      } catch (_e) {
        // ignore — banner is non-critical
      }
    };

    void run();
  }, [checked, backupConfig.enabled]);

  const handleRestore = useCallback(async (entry: SnapshotEntry) => {
    setRestoring(true);
    setError(null);
    try {
      const { FileSystemProvider } = await import("@/lib/backup/providers/FileSystemProvider");
      const provider = new FileSystemProvider();
      await provider.initialize();

      const result = await restoreSnapshot(provider, entry);
      if (result.ok) {
        window.location.reload();
      } else {
        setError(result.error);
        if (result.nextEntry) {
          setNextEntry(result.nextEntry);
        }
      }
    } finally {
      setRestoring(false);
    }
  }, []);

  const handleDismiss = useCallback(() => {
    dismissRestoreCheck();
    setCandidate(null);
  }, []);

  if (!candidate) return null;

  const label = candidate.sessionLabel ?? "session";
  const timeText =
    candidate.minutesAgo < 1
      ? "just now"
      : candidate.minutesAgo < 60
        ? `${candidate.minutesAgo} minutes ago`
        : `${Math.floor(candidate.minutesAgo / 60)} hours ago`;

  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 w-full max-w-lg px-4">
      <div className="rounded-lg border bg-background shadow-lg p-4 flex flex-col gap-3">
        <div className="flex items-start gap-3">
          <HardDrive className="h-5 w-5 text-primary mt-0.5 shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium">Backup found</p>
            <p className="text-xs text-muted-foreground">
              A backup of &ldquo;{label}&rdquo; from {timeText} was found. Your local data appears
              to be empty — restore?
            </p>
          </div>
          <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={handleDismiss}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        {error && (
          <div className="flex items-center gap-2 text-sm text-destructive">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <div className="flex items-center gap-2">
          <Button
            size="sm"
            onClick={() => handleRestore(nextEntry ?? candidate.entry)}
            disabled={restoring}
          >
            {restoring ? "Restoring…" : nextEntry ? "Try previous backup" : "Restore"}
          </Button>
          {onOpenSettings && (
            <Button variant="outline" size="sm" onClick={() => onOpenSettings("backup")}>
              View snapshots
            </Button>
          )}
          <Button variant="ghost" size="sm" onClick={handleDismiss}>
            Dismiss
          </Button>
        </div>
      </div>
    </div>
  );
}
