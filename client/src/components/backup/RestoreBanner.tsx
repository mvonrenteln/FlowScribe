import { AlertCircle, HardDrive, X } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
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
  const { t } = useTranslation();
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
      ? t("backup.banner.timeJustNow")
      : candidate.minutesAgo < 60
        ? t("backup.banner.timeMinutes", { count: candidate.minutesAgo })
        : t("backup.banner.timeHours", { count: Math.floor(candidate.minutesAgo / 60) });

  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 w-full max-w-lg px-4">
      <div className="rounded-lg border bg-background shadow-lg p-4 flex flex-col gap-3">
        <div className="flex items-start gap-3">
          <HardDrive className="h-5 w-5 text-primary mt-0.5 shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium">{t("backup.banner.title")}</p>
            <p className="text-xs text-muted-foreground">
              {t("backup.banner.description", { label, time: timeText })}
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
            {restoring
              ? t("backup.banner.restoringButton")
              : nextEntry
                ? t("backup.banner.tryPreviousButton")
                : t("backup.banner.restoreButton")}
          </Button>
          {onOpenSettings && (
            <Button variant="outline" size="sm" onClick={() => onOpenSettings("backup")}>
              {t("backup.banner.viewSnapshotsButton")}
            </Button>
          )}
          <Button variant="ghost" size="sm" onClick={handleDismiss}>
            {t("backup.banner.dismissButton")}
          </Button>
        </div>
      </div>
    </div>
  );
}
