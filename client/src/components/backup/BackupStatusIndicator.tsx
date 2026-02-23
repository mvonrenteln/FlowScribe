import { AlertCircle, CheckCircle2, HardDrive, PauseCircle } from "lucide-react";
import { useCallback, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { toast } from "@/hooks/use-toast";
import { useTranscriptStore } from "@/lib/store";

interface BackupStatusIndicatorProps {
  onOpenSettings?: (section: string) => void;
}

export function BackupStatusIndicator({ onOpenSettings }: BackupStatusIndicatorProps) {
  const backupConfig = useTranscriptStore((s) => s.backupConfig);

  // Listen for backup reminder events
  useEffect(() => {
    const handler = (e: Event) => {
      const customEvent = e as CustomEvent<{ canDisable?: boolean }>;
      const canDisable = customEvent.detail?.canDisable ?? false;
      toast({
        title: "Unsaved backup",
        description: canDisable
          ? "Your session has unsaved changes. Open backup settings to trigger a download."
          : "Your session has unsaved changes that haven't been backed up.",
      });
    };
    window.addEventListener("flowscribe:backup-reminder", handler);
    return () => window.removeEventListener("flowscribe:backup-reminder", handler);
  }, []);

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
    switch (backupConfig.status) {
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
    switch (backupConfig.status) {
      case "enabled":
        return backupConfig.lastBackupAt
          ? `Last backup: ${new Date(backupConfig.lastBackupAt).toLocaleTimeString()}`
          : "Backup enabled";
      case "paused":
        return "Backup paused – folder not accessible";
      case "error":
        return `Backup error: ${backupConfig.lastError ?? "unknown"}`;
      default:
        return "Backup";
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
            aria-label="Backup status"
          >
            {getIcon()}
          </Button>
        </TooltipTrigger>
        <TooltipContent side="bottom">{getTooltip()}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
