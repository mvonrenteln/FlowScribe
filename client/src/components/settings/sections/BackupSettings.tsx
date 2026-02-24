import { AlertCircle, CheckCircle2, HardDrive, Loader2, PauseCircle } from "lucide-react";
import { useCallback, useState } from "react";

type ExtendedWindow = Window & { showDirectoryPicker?: unknown };
const hasFsAccess = () =>
  typeof window !== "undefined" &&
  typeof (window as ExtendedWindow).showDirectoryPicker === "function";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { useTranscriptStore } from "@/lib/store";

function formatLastBackup(lastBackupAt: number | null): string {
  if (!lastBackupAt) return "Never";
  const diff = Date.now() - lastBackupAt;
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export function BackupSettings() {
  const backupConfig = useTranscriptStore((s) => s.backupConfig);
  const backupState = useTranscriptStore((s) => s.backupState);
  const setBackupConfig = useTranscriptStore((s) => s.setBackupConfig);
  const setBackupState = useTranscriptStore((s) => s.setBackupState);
  const [enabling, setEnabling] = useState(false);

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

  const handleBackupNow = useCallback(() => {
    window.dispatchEvent(new CustomEvent("flowscribe:backup-critical"));
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
            Automatic Backup
          </CardTitle>
          <CardDescription>
            Save compressed snapshots of your sessions to a local folder. Protects against browser
            data loss.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {!backupConfig.enabled ? (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                {hasFsAccess()
                  ? "Choose a folder to store backup snapshots. The folder is stored locally and never uploaded."
                  : "Your browser does not support the File System Access API. Backups will be downloaded as files."}
              </p>
              <Button onClick={handleEnable} disabled={enabling}>
                {enabling && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {hasFsAccess() ? "Choose backup folder" : "Enable download backups"}
              </Button>
              {backupState.lastError && (
                <p className="text-sm text-destructive">{backupState.lastError}</p>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Backup location</Label>
                  <p className="text-xs text-muted-foreground">
                    {backupConfig.locationLabel ?? "Unknown location"}
                  </p>
                </div>
                <div className="text-xs text-muted-foreground">
                  Last backup: {formatLastBackup(backupState.lastBackupAt)}
                </div>
              </div>

              {backupState.status === "paused" && (
                <div className="rounded-md bg-amber-50 border border-amber-200 p-3 text-sm text-amber-800 dark:bg-amber-950 dark:border-amber-800 dark:text-amber-200">
                  Backup folder is not accessible. Re-open your browser and grant permission, or
                  choose a new folder.
                </div>
              )}

              {backupState.status === "error" && backupState.lastError && (
                <div className="rounded-md bg-destructive/10 border border-destructive/20 p-3 text-sm text-destructive">
                  {backupState.lastError}
                </div>
              )}

              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={handleBackupNow}>
                  Backup now
                </Button>
                <Button variant="outline" size="sm" onClick={handleEnable} disabled={enabling}>
                  {enabling && <Loader2 className="mr-2 h-3 w-3 animate-spin" />}
                  Change folder
                </Button>
                <Button variant="ghost" size="sm" onClick={handleDisable}>
                  Disable
                </Button>
              </div>

              <Separator />

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="include-global">Include global settings</Label>
                  <p className="text-xs text-muted-foreground">
                    Back up lexicon, spellcheck, and AI config
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
                  <Label htmlFor="disable-reminders">Disable unsaved reminders</Label>
                  <p className="text-xs text-muted-foreground">
                    Stop periodic toast notifications about unsaved backups
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
                  <Label htmlFor="backup-interval">Backup every (minutes)</Label>
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
                    Minimum minutes between automatic backups (5–60). Ongoing edits may delay a
                    backup by up to 5 extra minutes.
                  </p>
                </div>

                <Separator />

                <div className="space-y-1.5">
                  <Label htmlFor="max-per-session">Max snapshots per session</Label>
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
                  <Label htmlFor="max-global">Max global snapshots</Label>
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
    </div>
  );
}
