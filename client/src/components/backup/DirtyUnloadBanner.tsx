import { AlertCircle, AlertTriangle, CheckCircle, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import type { BackupScheduler } from "@/lib/backup/BackupScheduler";
import { clearDirtyUnloadFlag, readDirtyUnloadFlag } from "@/lib/backup/dirtyUnloadFlag";
import { useTranscriptStore } from "@/lib/store";

type BannerVariant = "backup-available" | "permission-needed" | "no-backup";
type BannerPhase = "hidden" | "showing" | "saving" | "success" | "error";

interface DirtyUnloadBannerProps {
  onOpenSettings?: (section: string) => void;
}

/**
 * DirtyUnloadBanner — shown on startup when a dirty-unload flag is present in
 * localStorage, indicating the previous session was closed with unsaved edits.
 *
 * Three variants:
 * - "backup-available": backup is enabled and accessible → offer to create a safety backup
 * - "permission-needed": backup is enabled but access is lost → offer to re-authorize
 * - "no-backup": backup is not configured → offer to open settings
 */
export function DirtyUnloadBanner({ onOpenSettings }: DirtyUnloadBannerProps) {
  const { t } = useTranslation();
  const backupConfig = useTranscriptStore((s) => s.backupConfig);
  const backupState = useTranscriptStore((s) => s.backupState);

  const [phase, setPhase] = useState<BannerPhase>("hidden");
  const [variant, setVariant] = useState<BannerVariant>("no-backup");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const dismissTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const flag = readDirtyUnloadFlag();
    if (!flag.present) return;

    let v: BannerVariant;
    if (backupConfig.enabled && backupState.status === "enabled") {
      v = "backup-available";
    } else if (backupConfig.enabled) {
      v = "permission-needed";
    } else {
      v = "no-backup";
    }
    setVariant(v);
    setPhase("showing");
  }, [backupConfig.enabled, backupState.status]);

  // Cleanup auto-dismiss timer on unmount
  useEffect(() => {
    return () => {
      if (dismissTimerRef.current !== null) {
        clearTimeout(dismissTimerRef.current);
      }
    };
  }, []);

  const scheduleAutoDismiss = useCallback(() => {
    dismissTimerRef.current = setTimeout(() => {
      setPhase("hidden");
    }, 4000);
  }, []);

  const handleDismiss = useCallback(() => {
    clearDirtyUnloadFlag();
    setPhase("hidden");
  }, []);

  const handleBackupAvailable = useCallback(async () => {
    setPhase("saving");
    setErrorMsg(null);

    const scheduler = (window as Window & { __backupScheduler?: BackupScheduler })
      .__backupScheduler;
    if (!scheduler) {
      setErrorMsg(t("backup.dirtyUnload.schedulerUnavailable"));
      setPhase("error");
      return;
    }
    await scheduler.backupNow("before-unload");

    const err = useTranscriptStore.getState().backupState.lastError;
    if (err === null) {
      clearDirtyUnloadFlag();
      setPhase("success");
      scheduleAutoDismiss();
    } else {
      setErrorMsg(err);
      setPhase("error");
    }
  }, [scheduleAutoDismiss, t]);

  const handlePermissionNeeded = useCallback(async () => {
    setPhase("saving");
    setErrorMsg(null);

    const scheduler = (window as Window & { __backupScheduler?: BackupScheduler })
      .__backupScheduler;
    if (!scheduler) {
      setErrorMsg(t("backup.dirtyUnload.schedulerUnavailable"));
      setPhase("error");
      return;
    }

    try {
      // Re-authorize via the scheduler's own provider so the cached directory handle
      // is updated in place. Creating a new FileSystemProvider instance would save a
      // new handle to IndexedDB but leave the scheduler's cached handle unchanged,
      // causing the subsequent backupNow() call to use the old (revoked) handle.
      const result = await scheduler.reauthorize();

      if (!result.ok) {
        setErrorMsg(result.error);
        setPhase("error");
        return;
      }

      await scheduler.backupNow("before-unload");

      const err = useTranscriptStore.getState().backupState.lastError;
      if (err === null) {
        clearDirtyUnloadFlag();
        setPhase("success");
        scheduleAutoDismiss();
      } else {
        setErrorMsg(err);
        setPhase("error");
      }
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : String(e));
      setPhase("error");
    }
  }, [scheduleAutoDismiss, t]);

  const handleNoBackup = useCallback(() => {
    onOpenSettings?.("backup");
    clearDirtyUnloadFlag();
    setPhase("hidden");
  }, [onOpenSettings]);

  if (phase === "hidden") return null;

  const description =
    phase === "success"
      ? null
      : variant === "backup-available"
        ? t("backup.dirtyUnload.descriptionBackupAvailable")
        : variant === "permission-needed"
          ? t("backup.dirtyUnload.descriptionPermissionNeeded")
          : t("backup.dirtyUnload.descriptionNoBackup");

  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 w-full max-w-lg px-4">
      <div className="rounded-lg border bg-background shadow-lg p-4 flex flex-col gap-3">
        <div className="flex items-start gap-3">
          {phase === "success" ? (
            <CheckCircle className="h-5 w-5 text-green-500 mt-0.5 shrink-0" />
          ) : (
            <AlertTriangle className="h-5 w-5 text-warning mt-0.5 shrink-0" />
          )}
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium">
              {phase === "success"
                ? t("backup.dirtyUnload.successMessage")
                : t("backup.dirtyUnload.title")}
            </p>
            {description && <p className="text-xs text-muted-foreground">{description}</p>}
          </div>
          <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={handleDismiss}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        {phase === "error" && errorMsg && (
          <div className="flex items-center gap-2 text-sm text-destructive">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{t("backup.dirtyUnload.errorMessage", { error: errorMsg })}</span>
          </div>
        )}

        {phase !== "success" && (
          <div className="flex items-center gap-2">
            {variant === "backup-available" && (
              <Button
                size="sm"
                onClick={() => void handleBackupAvailable()}
                disabled={phase === "saving"}
              >
                {phase === "saving"
                  ? t("backup.dirtyUnload.savingMessage")
                  : t("backup.dirtyUnload.createBackupButton")}
              </Button>
            )}
            {variant === "permission-needed" && (
              <Button
                size="sm"
                onClick={() => void handlePermissionNeeded()}
                disabled={phase === "saving"}
              >
                {phase === "saving"
                  ? t("backup.dirtyUnload.savingMessage")
                  : t("backup.dirtyUnload.reauthorizeButton")}
              </Button>
            )}
            {variant === "no-backup" && (
              <Button size="sm" onClick={handleNoBackup}>
                {t("backup.dirtyUnload.enableBackupsButton")}
              </Button>
            )}
            <Button variant="ghost" size="sm" onClick={handleDismiss}>
              {t("backup.dirtyUnload.dismissButton")}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
