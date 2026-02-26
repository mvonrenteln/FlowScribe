import {
  AlertCircle,
  CheckCircle2,
  FolderOpen,
  HardDrive,
  List,
  Loader2,
  PauseCircle,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

type ExtendedWindow = Window & { showDirectoryPicker?: unknown };
const hasFsAccess = () =>
  typeof window !== "undefined" &&
  typeof (window as ExtendedWindow).showDirectoryPicker === "function";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { toast } from "@/hooks/use-toast";
import type { BackupProvider } from "@/lib/backup/BackupProvider";
import { saveDirectoryHandle } from "@/lib/backup/backupHandleStorage";
import { openRestoreFromFolder } from "@/lib/backup/restore";
import { useTranscriptStore } from "@/lib/store";
import { SnapshotBrowser } from "./SnapshotBrowser";

function formatLastBackup(
  lastBackupAt: number | null,
  t: (key: string, opts?: Record<string, unknown>) => string,
): string {
  if (!lastBackupAt) return t("backup.settings.lastBackupNever");
  const diff = Date.now() - lastBackupAt;
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1) return t("backup.settings.lastBackupJustNow");
  if (minutes < 60) return t("backup.settings.lastBackupMinutes", { count: minutes });
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return t("backup.settings.lastBackupHours", { count: hours });
  return t("backup.settings.lastBackupDays", { count: Math.floor(hours / 24) });
}

export function BackupSettings() {
  const { t } = useTranslation();
  const backupConfig = useTranscriptStore((s) => s.backupConfig);
  const backupState = useTranscriptStore((s) => s.backupState);
  const setBackupConfig = useTranscriptStore((s) => s.setBackupConfig);
  const setBackupState = useTranscriptStore((s) => s.setBackupState);
  const [enabling, setEnabling] = useState(false);
  const [showSnapshotBrowser, setShowSnapshotBrowser] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [externalProvider, setExternalProvider] = useState<BackupProvider | null>(null);
  const [externalHandle, setExternalHandle] = useState<FileSystemDirectoryHandle | null>(null);
  const [keepFolderDialogOpen, setKeepFolderDialogOpen] = useState(false);

  const handleEnable = useCallback(async () => {
    setEnabling(true);
    try {
      const { FileSystemProvider } = await import("@/lib/backup/providers/FileSystemProvider");
      const { DownloadProvider } = await import("@/lib/backup/providers/DownloadProvider");

      const provider = new FileSystemProvider();
      if (provider.isSupported()) {
        const result = await provider.enable();
        if (result.ok) {
          setBackupConfig({
            enabled: true,
            providerType: "filesystem",
            locationLabel: result.locationLabel,
          });
          setBackupState({ status: "enabled", lastError: null });
          // Trigger initial backup
          window.dispatchEvent(new CustomEvent("flowscribe:backup-critical"));
        } else if (result.error !== "Cancelled") {
          setBackupState({ lastError: result.error });
        }
      } else {
        const dlProvider = new DownloadProvider();
        const result = await dlProvider.enable();
        if (result.ok) {
          setBackupConfig({
            enabled: true,
            providerType: "download",
            locationLabel: result.locationLabel,
          });
          setBackupState({ status: "enabled", lastError: null });
        }
      }
    } finally {
      setEnabling(false);
    }
  }, [setBackupConfig, setBackupState]);

  const handleDisable = useCallback(() => {
    setBackupConfig({ enabled: false });
    setBackupState({ status: "disabled", lastError: null });
  }, [setBackupConfig, setBackupState]);

  useEffect(() => {
    const handler = () => {
      toast({
        title: t("backup.backupNow.successTitle"),
        description: t("backup.backupNow.successDescription"),
      });
    };
    window.addEventListener("flowscribe:backup-complete", handler);
    return () => window.removeEventListener("flowscribe:backup-complete", handler);
  }, [t]);

  const handleBackupNow = useCallback(() => {
    window.dispatchEvent(new CustomEvent("flowscribe:backup-critical"));
  }, []);

  const handleRestoreFromFolder = useCallback(async () => {
    setRestoring(true);
    try {
      const result = await openRestoreFromFolder();
      setExternalProvider(result.provider);
      setExternalHandle(result.handle);
      setShowSnapshotBrowser(true);
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") {
        // User cancelled — no-op
        return;
      }
      toast({
        title: t("backup.settings.invalidFolderErrorTitle"),
        description: t("backup.settings.invalidFolderErrorDescription"),
        variant: "destructive",
      });
    } finally {
      setRestoring(false);
    }
  }, [t]);

  const handleSnapshotBrowserClose = useCallback(() => {
    setShowSnapshotBrowser(false);
  }, []);

  const handleRestoreSuccess = useCallback(() => {
    if (externalHandle) {
      setKeepFolderDialogOpen(true);
    }
  }, [externalHandle]);

  const handleKeepFolder = useCallback(async () => {
    if (!externalHandle) return;
    await saveDirectoryHandle(externalHandle);
    setBackupConfig({
      enabled: true,
      providerType: "filesystem",
      locationLabel: externalHandle.name,
    });
    setBackupState({ status: "enabled", lastError: null });
    window.dispatchEvent(new CustomEvent("flowscribe:backup-critical"));
    window.location.reload();
  }, [externalHandle, setBackupConfig, setBackupState]);

  const handleDismissKeepFolder = useCallback(() => {
    window.location.reload();
  }, []);

  const renderStatusIcon = () => {
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

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            {renderStatusIcon()}
            {t("backup.settings.title")}
          </CardTitle>
          <CardDescription>{t("backup.settings.description")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {!backupConfig.enabled ? (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                {hasFsAccess()
                  ? t("backup.settings.disabledDescriptionFs")
                  : t("backup.settings.disabledDescriptionDownload")}
              </p>
              <Button onClick={handleEnable} disabled={enabling}>
                {enabling && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {hasFsAccess()
                  ? t("backup.settings.chooseFolderButton")
                  : t("backup.settings.enableDownloadButton")}
              </Button>
              {hasFsAccess() && (
                <Button variant="outline" onClick={handleRestoreFromFolder} disabled={restoring}>
                  {restoring ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <FolderOpen className="mr-2 h-4 w-4" />
                  )}
                  {t("backup.settings.restoreFromFolderButton")}
                </Button>
              )}
              {backupState.lastError && (
                <p className="text-sm text-destructive">{backupState.lastError}</p>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>{t("backup.settings.locationLabel")}</Label>
                  <p className="text-xs text-muted-foreground">
                    {backupConfig.locationLabel ?? t("backup.settings.locationUnknown")}
                  </p>
                </div>
                <div className="text-xs text-muted-foreground">
                  {t("backup.settings.lastBackup")} {formatLastBackup(backupState.lastBackupAt, t)}
                </div>
              </div>

              {backupState.status === "paused" && (
                <div className="rounded-md bg-amber-50 border border-amber-200 p-3 text-sm text-amber-800 dark:bg-amber-950 dark:border-amber-800 dark:text-amber-200">
                  {t("backup.settings.pausedWarning")}
                </div>
              )}

              {backupState.status === "error" && backupState.lastError && (
                <div className="rounded-md bg-destructive/10 border border-destructive/20 p-3 text-sm text-destructive">
                  {backupState.lastError}
                </div>
              )}

              <div className="flex flex-wrap items-center gap-2">
                <Button variant="outline" size="sm" onClick={handleBackupNow}>
                  {t("backup.settings.backupNowButton")}
                </Button>
                {backupConfig.providerType === "filesystem" && (
                  <Button variant="outline" size="sm" onClick={() => setShowSnapshotBrowser(true)}>
                    <List className="mr-1 h-3 w-3" />
                    {t("backup.settings.viewSnapshotsButton")}
                  </Button>
                )}
                <Button variant="outline" size="sm" onClick={handleEnable} disabled={enabling}>
                  {enabling && <Loader2 className="mr-2 h-3 w-3 animate-spin" />}
                  {t("backup.settings.changeFolderButton")}
                </Button>
                <Button variant="ghost" size="sm" onClick={handleDisable}>
                  {t("backup.settings.disableButton")}
                </Button>
              </div>

              <Separator />

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="include-global">{t("backup.settings.includeGlobalLabel")}</Label>
                  <p className="text-xs text-muted-foreground">
                    {t("backup.settings.includeGlobalDescription")}
                  </p>
                </div>
                <Switch
                  id="include-global"
                  checked={backupConfig.includeGlobalState}
                  onCheckedChange={(v) => setBackupConfig({ includeGlobalState: v })}
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="disable-reminders">
                    {t("backup.settings.disableRemindersLabel")}
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    {t("backup.settings.disableRemindersDescription")}
                  </p>
                </div>
                <Switch
                  id="disable-reminders"
                  checked={backupConfig.disableDirtyReminders}
                  onCheckedChange={(v) => setBackupConfig({ disableDirtyReminders: v })}
                />
              </div>

              <Separator />

              <div className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="backup-interval">{t("backup.settings.intervalLabel")}</Label>
                  <Input
                    id="backup-interval"
                    type="number"
                    min={5}
                    max={60}
                    value={backupConfig.backupIntervalMinutes}
                    onChange={(e) => {
                      const v = Number(e.target.value);
                      if (v >= 5 && v <= 60) setBackupConfig({ backupIntervalMinutes: v });
                    }}
                  />
                  <p className="text-xs text-muted-foreground">
                    {t("backup.settings.intervalHelp")}
                  </p>
                </div>

                <Separator />

                <div className="space-y-1.5">
                  <Label htmlFor="max-per-session">{t("backup.settings.maxPerSessionLabel")}</Label>
                  <Input
                    id="max-per-session"
                    type="number"
                    min={1}
                    max={200}
                    value={backupConfig.maxSnapshotsPerSession}
                    onChange={(e) => {
                      const v = Number(e.target.value);
                      if (v >= 1) setBackupConfig({ maxSnapshotsPerSession: v });
                    }}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="max-global">{t("backup.settings.maxGlobalLabel")}</Label>
                  <Input
                    id="max-global"
                    type="number"
                    min={1}
                    max={100}
                    value={backupConfig.maxGlobalSnapshots}
                    onChange={(e) => {
                      const v = Number(e.target.value);
                      if (v >= 1) setBackupConfig({ maxGlobalSnapshots: v });
                    }}
                  />
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {(backupConfig.providerType === "filesystem" || externalProvider) && (
        <SnapshotBrowser
          open={showSnapshotBrowser}
          onClose={handleSnapshotBrowserClose}
          providerType="filesystem"
          externalProvider={externalProvider ?? undefined}
          onRestoreSuccess={handleRestoreSuccess}
        />
      )}

      <AlertDialog open={keepFolderDialogOpen} onOpenChange={setKeepFolderDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("backup.restore.keepFolderTitle")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("backup.restore.keepFolderDescription", {
                name: externalHandle?.name ?? "",
              })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={handleDismissKeepFolder}>
              {t("backup.restore.keepFolderDismiss")}
            </AlertDialogCancel>
            <AlertDialogAction onClick={() => void handleKeepFolder()}>
              {t("backup.restore.keepFolderConfirm")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
