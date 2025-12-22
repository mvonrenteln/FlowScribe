import { Download, Plus, Upload, X } from "lucide-react";
import { useRef, useState } from "react";
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
import { Slider } from "@/components/ui/slider";
import { useTranscriptStore } from "@/lib/store";

interface GlossaryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function GlossaryDialog({ open, onOpenChange }: GlossaryDialogProps) {
  const lexiconTerms = useTranscriptStore((state) => state.lexiconTerms);
  const lexiconThreshold = useTranscriptStore((state) => state.lexiconThreshold);
  const addLexiconTerm = useTranscriptStore((state) => state.addLexiconTerm);
  const removeLexiconTerm = useTranscriptStore((state) => state.removeLexiconTerm);
  const setLexiconTerms = useTranscriptStore((state) => state.setLexiconTerms);
  const setLexiconThreshold = useTranscriptStore((state) => state.setLexiconThreshold);
  const [newTerm, setNewTerm] = useState("");
  const importInputRef = useRef<HTMLInputElement>(null);
  const handleAdd = () => {
    addLexiconTerm(newTerm);
    setNewTerm("");
  };

  const handleImport = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      const content = String(reader.result ?? "");
      const terms = content
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean);
      setLexiconTerms(terms);
    };
    reader.readAsText(file);
  };

  const handleExport = () => {
    const content = lexiconTerms.join("\n");
    const blob = new Blob([content], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "lexicon.txt";
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(url);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Glossary</DialogTitle>
          <DialogDescription>
            Manage terms that should be highlighted and used for fuzzy matching.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <div className="text-xs text-muted-foreground">Fuzzy match threshold</div>
            <Slider
              value={[lexiconThreshold]}
              min={0.6}
              max={0.95}
              step={0.01}
              onValueChange={(value) => setLexiconThreshold(value[0] ?? 0.82)}
            />
            <div className="text-xs text-muted-foreground">{lexiconThreshold.toFixed(2)}</div>
          </div>

          <div className="flex items-center gap-2">
            <Input
              value={newTerm}
              onChange={(event) => setNewTerm(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  handleAdd();
                }
              }}
              placeholder="Add term..."
              data-testid="input-lexicon-term"
            />
            <Button onClick={handleAdd} disabled={!newTerm.trim()}>
              <Plus className="h-4 w-4 mr-2" />
              Add
            </Button>
          </div>

          <ScrollArea className="h-40 rounded-md border">
            <div className="p-2 space-y-2">
              {lexiconTerms.length === 0 ? (
                <div className="text-sm text-muted-foreground">No terms yet.</div>
              ) : (
                lexiconTerms.map((term) => (
                  <div
                    key={term}
                    className="flex items-center justify-between gap-2 rounded-md border px-2 py-1"
                  >
                    <span className="text-sm">{term}</span>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => removeLexiconTerm(term)}
                      aria-label={`Remove ${term}`}
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
            <Button variant="outline" onClick={handleExport} disabled={lexiconTerms.length === 0}>
              <Download className="h-4 w-4 mr-2" />
              Export
            </Button>
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
