import { useTranslation } from "react-i18next";
import { SnapshotBrowser } from "@/components/settings/sections/SnapshotBrowser";
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
import type { BackupProvider } from "@/lib/backup/BackupProvider";

interface AdHocRestoreDialogsProps {
  showSnapshotBrowser: boolean;
  provider: BackupProvider | null;
  handle: FileSystemDirectoryHandle | null;
  onClose: () => void;
  onRestoreSuccess: () => void;
  keepFolderDialogOpen: boolean;
  onKeepFolder: () => Promise<void>;
  onDismissKeepFolder: () => void;
}

/**
 * Renders the ad-hoc "Restore from backup folder" flow initiated from the
 * empty transcript editor state. Includes the SnapshotBrowser (with a
 * temporary, non-persisted provider) and the "keep folder?" confirmation dialog.
 */
export function AdHocRestoreDialogs({
  showSnapshotBrowser,
  provider,
  handle,
  onClose,
  onRestoreSuccess,
  keepFolderDialogOpen,
  onKeepFolder,
  onDismissKeepFolder,
}: AdHocRestoreDialogsProps) {
  const { t } = useTranslation();

  if (!provider && !keepFolderDialogOpen) return null;

  return (
    <>
      {provider && (
        <SnapshotBrowser
          open={showSnapshotBrowser}
          onClose={onClose}
          providerType="filesystem"
          externalProvider={provider}
          onRestoreSuccess={onRestoreSuccess}
        />
      )}

      <AlertDialog open={keepFolderDialogOpen} onOpenChange={onDismissKeepFolder}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("backup.restore.keepFolderTitle")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("backup.restore.keepFolderDescription", { name: handle?.name ?? "" })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={onDismissKeepFolder}>
              {t("backup.restore.keepFolderDismiss")}
            </AlertDialogCancel>
            <AlertDialogAction onClick={() => void onKeepFolder()}>
              {t("backup.restore.keepFolderConfirm")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
