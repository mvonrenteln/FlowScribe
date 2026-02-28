import { AlertCircle, CheckCircle2, Clock, HardDrive, Loader2, PauseCircle } from "lucide-react";
import { useCallback, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { toast } from "@/hooks/use-toast";
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

  const handleClick = useCallback(() => {
    if (backupConfig.providerType === "download") {
      // Trigger pending download if available
      const scheduler = (
        window as Window & {
          __backupScheduler?: { triggerDownload: () => void; hasPendingDownload: () => boolean };
        }
      ).__backupScheduler;
      if (scheduler?.hasPendingDownload()) {
        scheduler.triggerDownload();
        return;
      }
    }
    onOpenSettings?.("backup");
  }, [backupConfig.providerType, onOpenSettings]);

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
