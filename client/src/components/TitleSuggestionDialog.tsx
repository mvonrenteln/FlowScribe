import { Loader2, Wand2 } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useTranscriptStore } from "@/lib/store";
import { cn } from "@/lib/utils";

interface TitleSuggestionDialogProps {
  readonly chapterId: string | null;
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
}

export function TitleSuggestionDialog({
  chapterId,
  open,
  onOpenChange,
}: Readonly<TitleSuggestionDialogProps>) {
  const suggestions = useTranscriptStore((state) => state.chapterMetadataTitleSuggestions);
  const loading = useTranscriptStore((state) => state.chapterMetadataTitleLoading);
  const error = useTranscriptStore((state) => state.chapterMetadataError);
  const updateChapter = useTranscriptStore((state) => state.updateChapter);
  const clearSuggestions = useTranscriptStore((state) => state.clearChapterMetadataSuggestions);

  const [selectedTitle, setSelectedTitle] = useState<string | null>(null);

  // Clear selection when dialog closes or suggestions change
  useEffect(() => {
    if (!open) {
      setSelectedTitle(null);
      // We don't clear suggestions immediately here to allow reopening to see same suggestions,
      // but in this flow we might want to clear them when starting a new generation.
    }
  }, [open]);

  // Fix pointer-events when dialog closes (same fix as in ChapterRewriteDialog)
  useEffect(() => {
    if (open) return;
    document.body.style.pointerEvents = "";
    document.documentElement.style.pointerEvents = "";
  }, [open]);

  const handleApply = () => {
    if (chapterId && selectedTitle) {
      updateChapter(chapterId, { title: selectedTitle });
      onOpenChange(false);
      clearSuggestions();
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Wand2 className="h-5 w-5 text-primary" />
            Suggest Chapter Title
          </DialogTitle>
          <DialogDescription>
            Select a title suggested by AI or generate new ones.
          </DialogDescription>
        </DialogHeader>

        <div className="py-4">
          {loading ? (
            <div className="flex flex-col items-center justify-center gap-2 py-8 text-muted-foreground">
              <Loader2 className="h-8 w-8 animate-spin" />
              <p className="text-sm">Generating title suggestions...</p>
            </div>
          ) : error ? (
            <div className="rounded-md bg-destructive/10 p-4 text-sm text-destructive">
              <p className="font-medium">Error generating titles</p>
              <p>{error}</p>
            </div>
          ) : suggestions?.length ? (
            <div className="space-y-2">
              <p className="mb-2 text-sm font-medium text-muted-foreground">Choose a title:</p>
              {suggestions.map((title) => (
                <button
                  key={title}
                  type="button"
                  className={cn(
                    "relative flex w-full cursor-pointer items-start gap-3 rounded-lg border p-3 text-left hover:bg-accent hover:text-accent-foreground",
                    selectedTitle === title && "border-primary bg-primary/5 ring-1 ring-primary",
                  )}
                  onClick={() => setSelectedTitle(title)}
                >
                  <div
                    className={cn(
                      "mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border border-primary",
                      selectedTitle === title ? "bg-primary text-primary-foreground" : "opacity-50",
                    )}
                  >
                    {selectedTitle === title && <div className="h-2 w-2 rounded-full bg-white" />}
                  </div>
                  <div className="flex-1 text-sm leading-tight">{title}</div>
                </button>
              ))}
            </div>
          ) : (
            <div className="py-4 text-center text-sm text-muted-foreground">
              No suggestions available. Try generating some!
            </div>
          )}
        </div>

        <DialogFooter className="sm:justify-between">
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="button" onClick={handleApply} disabled={!selectedTitle || loading}>
            Apply Title
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
