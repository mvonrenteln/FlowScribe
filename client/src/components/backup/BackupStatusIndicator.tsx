import { AlertCircle, CheckCircle2, Clock, HardDrive, Loader2, PauseCircle } from "lucide-react";
import { useCallback, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { toast } from "@/hooks/use-toast";
import type { BackupScheduler } from "@/lib/backup/BackupScheduler";
import { useTranscriptStore } from "@/lib/store";

interface BackupStatusIndicatorProps {
  onOpenSettings?: (section: string) => void;
}

export function BackupStatusIndicator({ onOpenSettings }: BackupStatusIndicatorProps) {
  const { t } = useTranslation();
  const backupConfig = useTranscriptStore((s) => s.backupConfig);
  const backupState = useTranscriptStore((s) => s.backupState);

  // Listen for backup reminder events
  useEffect(() => {
    const handler = (e: Event) => {
      const customEvent = e as CustomEvent<{ canDisable?: boolean }>;
      const canDisable = customEvent.detail?.canDisable ?? false;
      toast({
        title: t("backup.reminder.title"),
        description: canDisable
          ? t("backup.reminder.descriptionWithDownload")
          : t("backup.reminder.descriptionNoDownload"),
      });
    };
    window.addEventListener("flowscribe:backup-reminder", handler);
    return () => window.removeEventListener("flowscribe:backup-reminder", handler);
  }, [t]);

  // One-shot toast per pause episode: tells the user how to reconnect the folder
  // (covers the proactive startup access check after a browser restart).
  const pausedToastShownRef = useRef(false);
  useEffect(() => {
    if (backupConfig.enabled && backupState.status === "paused") {
      if (!pausedToastShownRef.current) {
        pausedToastShownRef.current = true;
        toast({
          title: t("backup.indicator.pausedToastTitle"),
          description: t("backup.indicator.pausedToastDescription"),
        });
      }
    } else {
      pausedToastShownRef.current = false;
    }
  }, [backupConfig.enabled, backupState.status, t]);

  const handleClick = useCallback(() => {
    const scheduler = (window as Window & { __backupScheduler?: BackupScheduler })
      .__backupScheduler;
    if (backupConfig.providerType === "download") {
      // Trigger pending download if available
      if (scheduler?.hasPendingDownload()) {
        scheduler.triggerDownload();
        return;
      }
    }
    if (
      backupState.status === "paused" &&
      backupConfig.providerType === "filesystem" &&
      scheduler
    ) {
      // Re-grant permission on the stored handle in place (browser permission
      // prompt, no picker). Requires this click as user gesture.
      void (async () => {
        const result = await scheduler.reauthorize();
        if (result.ok) {
          toast({
            title: t("backup.indicator.reconnectedTitle"),
            description: t("backup.indicator.reconnectedDescription"),
          });
        } else {
          onOpenSettings?.("backup");
        }
      })();
      return;
    }
    onOpenSettings?.("backup");
  }, [backupConfig.providerType, backupState.status, onOpenSettings, t]);

  if (!backupConfig.enabled) return null;

  const getIcon = () => {
    if (backupState.isSaving) {
      return <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />;
    }
    if (backupState.isDirty && backupState.status === "enabled") {
      return <Clock className="h-4 w-4 text-amber-500" />;
    }
    switch (backupState.status) {
      case "enabled":
        return <CheckCircle2 className="h-4 w-4 text-green-500" />;
      case "paused":
        return <PauseCircle className="h-4 w-4 text-amber-500" />;
      case "error":
        return <AlertCircle className="h-4 w-4 text-destructive" />;
      default:
        return <HardDrive className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const getTooltip = () => {
    if (backupState.isSaving) {
      return t("backup.indicator.tooltipSaving");
    }
    if (backupState.isDirty && backupState.status === "enabled") {
      return t("backup.indicator.tooltipPending");
    }
    switch (backupState.status) {
      case "enabled":
        return backupState.lastBackupAt
          ? t("backup.indicator.tooltipEnabled", {
              time: new Date(backupState.lastBackupAt).toLocaleTimeString(),
            })
          : t("backup.indicator.tooltipEnabledNever");
      case "paused":
        return t("backup.indicator.tooltipPaused");
      case "error":
        return t("backup.indicator.tooltipError", { error: backupState.lastError ?? "unknown" });
      default:
        return t("backup.indicator.tooltipDefault");
    }
  };

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={handleClick}
            aria-label={t("backup.indicator.ariaLabel")}
          >
            {getIcon()}
          </Button>
        </TooltipTrigger>
        <TooltipContent side="bottom">{getTooltip()}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
