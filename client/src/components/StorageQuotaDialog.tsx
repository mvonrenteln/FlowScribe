import { useCallback, useEffect, useState } from "react";
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
import { toast } from "@/hooks/use-toast";
import { useTranscriptStore } from "@/lib/store";

export const StorageQuotaDialog = () => {
  const [open, setOpen] = useState(false);
  const quotaErrorShown = useTranscriptStore((s) => s.quotaErrorShown);
  const setQuotaErrorShown = useTranscriptStore((s) => s.setQuotaErrorShown);

  useEffect(() => {
    const handler = () => {
      if (quotaErrorShown) {
        toast({
          title: "Speicher weiterhin voll",
          description:
            "Ihre Änderungen werden möglicherweise nicht gespeichert. Exportieren Sie Ihre Arbeit, um Datenverlust zu vermeiden.",
          variant: "destructive",
        });
        return;
      }
      setOpen(true);
    };
    window.addEventListener("flowscribe:storage-quota-exceeded", handler);
    return () => window.removeEventListener("flowscribe:storage-quota-exceeded", handler);
  }, [quotaErrorShown]);

  const handleIgnore = useCallback(() => {
    setQuotaErrorShown(true);
    setOpen(false);
  }, [setQuotaErrorShown]);

  const handleRemindLater = useCallback(() => {
    setOpen(false);
  }, []);

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Browserspeicher ist voll</AlertDialogTitle>
          <AlertDialogDescription>
            Ihre Sitzung konnte nicht gespeichert werden. Bitte sichern Sie Ihre aktuelle Arbeit
            jetzt über den Export. Sie können auch Speicherplatz freigeben, indem Sie alte Sitzungen
            in der Sitzungsliste löschen.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={handleRemindLater}>Später erinnern</AlertDialogCancel>
          <AlertDialogAction onClick={handleIgnore}>Ignorieren</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};
