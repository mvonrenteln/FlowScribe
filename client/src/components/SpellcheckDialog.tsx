import { Download, Plus, Upload, X } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useTranscriptStore } from "@/lib/store";

interface SpellcheckDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function SpellcheckDialog({ open, onOpenChange }: SpellcheckDialogProps) {
  const ignoreWords = useTranscriptStore((state) => state.spellcheckIgnoreWords);
  const setIgnoreWords = useTranscriptStore((state) => state.setSpellcheckIgnoreWords);
  const addIgnoreWord = useTranscriptStore((state) => state.addSpellcheckIgnoreWord);
  const removeIgnoreWord = useTranscriptStore((state) => state.removeSpellcheckIgnoreWord);
  const clearIgnoreWords = useTranscriptStore((state) => state.clearSpellcheckIgnoreWords);
  const [newWord, setNewWord] = useState("");
  const importInputRef = useRef<HTMLInputElement>(null);

  const sortedWords = useMemo(
    () => [...ignoreWords].sort((a, b) => a.localeCompare(b)),
    [ignoreWords],
  );

  const handleAdd = () => {
    if (!newWord.trim()) return;
    addIgnoreWord(newWord);
    setNewWord("");
  };

  const handleImport = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      const content = String(reader.result ?? "");
      const entries = content
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean);
      setIgnoreWords(entries);
    };
    reader.readAsText(file);
  };


  const handleExport = () => {
    const content = sortedWords.join("\n");
    const blob = new Blob([content], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "spellcheck-ignore.txt";
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(url);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Spellcheck Ignore List</DialogTitle>
          <DialogDescription>
            Add terms that should never be flagged by the spellcheck.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Input
              value={newWord}
              onChange={(event) => setNewWord(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  handleAdd();
                }
              }}
              placeholder="Add word..."
              data-testid="input-spellcheck-ignore"
            />
            <Button onClick={handleAdd} disabled={!newWord.trim()}>
              <Plus className="h-4 w-4 mr-2" />
              Add
            </Button>
            <Button
              variant="ghost"
              onClick={() => clearIgnoreWords()}
              disabled={ignoreWords.length === 0}
            >
              Clear
            </Button>
          </div>

          <ScrollArea className="h-40 rounded-md border">
            <div className="p-2 space-y-2">
              {sortedWords.length === 0 ? (
                <div className="text-sm text-muted-foreground">No ignored words yet.</div>
              ) : (
                sortedWords.map((word) => (
                  <div
                    key={word}
                    className="flex items-center justify-between gap-2 rounded-md border px-2 py-1"
                  >
                    <div className="text-sm truncate">{word}</div>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => removeIgnoreWord(word)}
                      aria-label={`Remove ${word}`}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ))
              )}
            </div>
          </ScrollArea>

          <div className="flex items-center gap-2">
            <input
              ref={importInputRef}
              type="file"
              accept=".txt"
              className="hidden"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) {
                  handleImport(file);
                }
                if (event.target) {
                  event.target.value = "";
                }
              }}
            />
            <Button variant="outline" onClick={() => importInputRef.current?.click()}>
              <Upload className="h-4 w-4 mr-2" />
              Import
            </Button>
            <Button variant="outline" onClick={handleExport} disabled={sortedWords.length === 0}>
              <Download className="h-4 w-4 mr-2" />
              Export
            </Button>
          </div>
          <div className="text-xs text-muted-foreground">
            Import/Export format: one word per line.
          </div>

        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
