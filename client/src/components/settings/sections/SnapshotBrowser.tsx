import { Loader2, RotateCcw } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "@/hooks/use-toast";
import type { BackupProvider } from "@/lib/backup/BackupProvider";
import { restoreSnapshot } from "@/lib/backup/restore";
import {
  formatSnapshotSize,
  groupSnapshotsBySession,
  reasonTranslationKey,
} from "@/lib/backup/snapshotDisplay";
import type { BackupProviderType, SnapshotEntry } from "@/lib/backup/types";

interface SnapshotBrowserProps {
  open: boolean;
  onClose: () => void;
  providerType: BackupProviderType;
  /** When provided, use this provider directly instead of loading from IndexedDB. */
  externalProvider?: BackupProvider;
  /** Called after a snapshot has been successfully restored. */
  onRestoreSuccess?: () => void;
}

type LoadState = "idle" | "loading" | "access-denied" | "error" | "loaded";

/**
 * Dialog that shows all available backup snapshots grouped by session.
 * Allows restoring any snapshot by calling `restoreSnapshot` from restore.ts.
 * Only meaningful for the `filesystem` provider; download provider has no manifest.
 * When `externalProvider` is passed, that provider is used directly instead of
 * loading the stored directory handle from IndexedDB.
 */
export function SnapshotBrowser({
  open,
  onClose,
  providerType,
  externalProvider,
  onRestoreSuccess,
}: SnapshotBrowserProps) {
  const { t } = useTranslation();

  const [loadState, setLoadState] = useState<LoadState>("idle");
  const [sessions, setSessions] = useState<ReturnType<typeof groupSnapshotsBySession>>([]);
  const [selectedSessionHash, setSelectedSessionHash] = useState<string>("__all__");
  const [restoringFilename, setRestoringFilename] = useState<string | null>(null);
  const [provider, setProvider] = useState<BackupProvider | null>(null);

  useEffect(() => {
    if (!open) {
      return;
    }

    let cancelled = false;
    setSessions([]);
    setSelectedSessionHash("__all__");
    setRestoringFilename(null);
    setProvider(null);

    const run = async () => {
      setLoadState("loading");
      try {
        let prov: BackupProvider;
        if (externalProvider) {
          prov = externalProvider;
        } else if (providerType === "filesystem") {
          const { FileSystemProvider } = await import("@/lib/backup/providers/FileSystemProvider");
          prov = new FileSystemProvider();
        } else {
          const { DownloadProvider } = await import("@/lib/backup/providers/DownloadProvider");
          prov = new DownloadProvider();
        }

        const accessible = await prov.verifyAccess();
        if (cancelled) return;
        if (!accessible) {
          setLoadState("access-denied");
          return;
        }

        setProvider(prov);
        const manifest = await prov.readManifest();
        if (cancelled) return;
        const allSnapshots = manifest?.snapshots ?? [];
        setSessions(groupSnapshotsBySession(allSnapshots));
        setLoadState("loaded");
      } catch (_e) {
        if (cancelled) return;
        setLoadState("error");
      }
    };

    void run();

    return () => {
      cancelled = true;
    };
  }, [open, providerType, externalProvider]);

  const handleRestore = useCallback(
    async (entry: SnapshotEntry) => {
      if (!provider) return;
      setRestoringFilename(entry.filename);
      try {
        const result = await restoreSnapshot(provider, entry);
        if (result.ok) {
          if (onRestoreSuccess) {
            // Caller handles reload (e.g. shows keep-folder dialog first)
            onRestoreSuccess();
            onClose();
          } else {
            // No post-restore dialog — reload immediately to apply restored state
            window.location.reload();
          }
        } else {
          toast({
            title: t("backup.snapshots.restoreErrorTitle"),
            description: result.error,
            variant: "destructive",
          });
        }
      } finally {
        setRestoringFilename(null);
      }
    },
    [provider, t, onClose, onRestoreSuccess],
  );

  const visibleEntries =
    selectedSessionHash === "__all__"
      ? sessions.flatMap((s) => s.entries).sort((a, b) => b.createdAt - a.createdAt)
      : (sessions.find((s) => s.hash === selectedSessionHash)?.entries ?? []);

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) onClose();
      }}
    >
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>{t("backup.snapshots.title")}</DialogTitle>
          <DialogDescription>
            {sessions.length > 0
              ? `${sessions.length} ${t("backup.snapshots.session")}${sessions.length !== 1 ? "s" : ""}`
              : null}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {loadState === "loading" && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              {t("backup.snapshots.loading")}
            </div>
          )}

          {loadState === "access-denied" && (
            <p className="text-sm text-destructive">{t("backup.snapshots.accessDenied")}</p>
          )}

          {loadState === "error" && (
            <p className="text-sm text-destructive">{t("backup.snapshots.error")}</p>
          )}

          {loadState === "loaded" && sessions.length === 0 && (
            <p className="text-sm text-muted-foreground">{t("backup.snapshots.noSnapshots")}</p>
          )}

          {loadState === "loaded" && sessions.length > 0 && (
            <>
              {sessions.length > 1 && (
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">{t("backup.snapshots.session")}:</span>
                  <Select value={selectedSessionHash} onValueChange={setSelectedSessionHash}>
                    <SelectTrigger className="w-72">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__all__">{t("backup.snapshots.allSessions")}</SelectItem>
                      {sessions.map((s) => (
                        <SelectItem key={s.hash} value={s.hash}>
                          {s.label ?? t("backup.snapshots.unknownSession")}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div className="max-h-96 overflow-y-auto rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t("backup.snapshots.colDateTime")}</TableHead>
                      <TableHead>{t("backup.snapshots.colReason")}</TableHead>
                      <TableHead className="text-right">{t("backup.snapshots.colSize")}</TableHead>
                      <TableHead className="text-right">
                        {t("backup.snapshots.colAction")}
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {visibleEntries.map((entry) => (
                      <SnapshotRow
                        key={entry.filename}
                        entry={entry}
                        isRestoring={restoringFilename === entry.filename}
                        onRestore={handleRestore}
                      />
                    ))}
                  </TableBody>
                </Table>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

interface SnapshotRowProps {
  entry: SnapshotEntry;
  isRestoring: boolean;
  onRestore: (entry: SnapshotEntry) => void;
}

function SnapshotRow({ entry, isRestoring, onRestore }: SnapshotRowProps) {
  const { t } = useTranslation();
  const date = new Date(entry.createdAt);
  const dateStr = date.toLocaleString();

  return (
    <TableRow>
      <TableCell className="text-sm">{dateStr}</TableCell>
      <TableCell className="text-sm">{t(reasonTranslationKey(entry.reason))}</TableCell>
      <TableCell className="text-right text-sm text-muted-foreground">
        {formatSnapshotSize(entry.compressedSize)}
      </TableCell>
      <TableCell className="text-right">
        <Button
          variant="outline"
          size="sm"
          onClick={() => onRestore(entry)}
          disabled={isRestoring}
          aria-label={t("backup.snapshots.restoreButton")}
        >
          {isRestoring ? (
            <>
              <Loader2 className="mr-1 h-3 w-3 animate-spin" />
              {t("backup.snapshots.restoring")}
            </>
          ) : (
            <>
              <RotateCcw className="mr-1 h-3 w-3" />
              {t("backup.snapshots.restoreButton")}
            </>
          )}
        </Button>
      </TableCell>
    </TableRow>
  );
}
