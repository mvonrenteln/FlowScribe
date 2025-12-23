import { Check, Download, Plus, Upload, X } from "lucide-react";
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
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { useTranscriptStore } from "@/lib/store";
import { cn } from "@/lib/utils";

interface GlossaryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function GlossaryDialog({ open, onOpenChange }: GlossaryDialogProps) {
  const lexiconEntries = useTranscriptStore((state) => state.lexiconEntries);
  const lexiconThreshold = useTranscriptStore((state) => state.lexiconThreshold);
  const lexiconHighlightUnderline = useTranscriptStore(
    (state) => state.lexiconHighlightUnderline,
  );
  const lexiconHighlightBackground = useTranscriptStore(
    (state) => state.lexiconHighlightBackground,
  );
  const addLexiconEntry = useTranscriptStore((state) => state.addLexiconEntry);
  const removeLexiconEntry = useTranscriptStore((state) => state.removeLexiconEntry);
  const setLexiconEntries = useTranscriptStore((state) => state.setLexiconEntries);
  const updateLexiconEntry = useTranscriptStore((state) => state.updateLexiconEntry);
  const setLexiconThreshold = useTranscriptStore((state) => state.setLexiconThreshold);
  const setLexiconHighlightUnderline = useTranscriptStore(
    (state) => state.setLexiconHighlightUnderline,
  );
  const setLexiconHighlightBackground = useTranscriptStore(
    (state) => state.setLexiconHighlightBackground,
  );
  const [newTerm, setNewTerm] = useState("");
  const [newVariants, setNewVariants] = useState("");
  const [selectedTerm, setSelectedTerm] = useState<string | null>(null);
  const importInputRef = useRef<HTMLInputElement>(null);
  const selectedEntry = selectedTerm
    ? lexiconEntries.find((entry) => entry.term === selectedTerm)
    : undefined;
  const handleAdd = () => {
    const variants = newVariants
      .split(",")
      .map((variant) => variant.trim())
      .filter(Boolean);
    if (selectedTerm) {
      updateLexiconEntry(selectedTerm, newTerm, variants);
    } else {
      addLexiconEntry(newTerm, variants);
    }
    setNewTerm("");
    setNewVariants("");
    setSelectedTerm(null);
  };

  const handleImport = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      const content = String(reader.result ?? "");
      const entries = content
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean)
        .map((line) => {
          const [termPart, variantsPart] = line.split("|");
          const term = termPart?.trim() ?? "";
          const variants = variantsPart
            ? variantsPart
                .split(",")
                .map((variant) => variant.trim())
                .filter(Boolean)
            : [];
          return { term, variants };
        });
      setLexiconEntries(entries);
    };
    reader.readAsText(file);
  };

  const handleExport = () => {
    const content = lexiconEntries
      .map((entry) =>
        entry.variants.length > 0
          ? `${entry.term} | ${entry.variants.join(", ")}`
          : entry.term,
      )
      .join("\n");
    const blob = new Blob([content], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "glossary.txt";
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
            Manage terms and common mistakes for highlighting and fuzzy matching.
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

          <div className="space-y-2">
            <div className="text-xs text-muted-foreground">Highlighting (normal view)</div>
            <div className="flex items-center justify-between gap-2 rounded-md border px-3 py-2">
              <div>
                <div className="text-sm font-medium">Underline matches</div>
                <div className="text-xs text-muted-foreground">
                  Applies even to 100% matches.
                </div>
              </div>
              <Switch
                checked={lexiconHighlightUnderline}
                onCheckedChange={setLexiconHighlightUnderline}
              />
            </div>
            <div className="flex items-center justify-between gap-2 rounded-md border px-3 py-2">
              <div>
                <div className="text-sm font-medium">Highlight background</div>
                <div className="text-xs text-muted-foreground">
                  Only for uncertain matches.
                </div>
              </div>
              <Switch
                checked={lexiconHighlightBackground}
                onCheckedChange={setLexiconHighlightBackground}
              />
            </div>
          </div>

          <div className="space-y-2">
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
                {selectedTerm ? (
                  <>
                    <Check className="h-4 w-4 mr-2" />
                    Save
                  </>
                ) : (
                  <>
                    <Plus className="h-4 w-4 mr-2" />
                    Add
                  </>
                )}
              </Button>
              {selectedTerm && (
                <Button
                  variant="ghost"
                  onClick={() => {
                    setSelectedTerm(null);
                    setNewTerm("");
                    setNewVariants("");
                  }}
                >
                  Cancel
                </Button>
              )}
            </div>
            <Input
              value={newVariants}
              onChange={(event) => setNewVariants(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  handleAdd();
                }
              }}
              placeholder="Common mistakes (comma-separated)..."
              data-testid="input-lexicon-variants"
            />
          </div>

          <ScrollArea className="h-40 rounded-md border">
            <div className="p-2 space-y-2">
              {lexiconEntries.length === 0 ? (
                <div className="text-sm text-muted-foreground">No terms yet.</div>
              ) : (
                lexiconEntries.map((entry) => (
                  <div
                    key={entry.term}
                    className={cn(
                      "flex items-center justify-between gap-2 rounded-md border px-2 py-1",
                      selectedTerm === entry.term && "bg-accent",
                    )}
                    role="button"
                    tabIndex={0}
                    onClick={() => {
                      setSelectedTerm(entry.term);
                      setNewTerm(entry.term);
                      setNewVariants(entry.variants.join(", "));
                    }}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        setSelectedTerm(entry.term);
                        setNewTerm(entry.term);
                        setNewVariants(entry.variants.join(", "));
                      }
                    }}
                  >
                    <div className="min-w-0">
                      <div className="text-sm">{entry.term}</div>
                      {entry.variants.length > 0 && (
                        <div className="text-xs text-muted-foreground truncate">
                          Variants: {entry.variants.join(", ")}
                        </div>
                      )}
                    </div>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={(event) => {
                        event.stopPropagation();
                        removeLexiconEntry(entry.term);
                        if (selectedTerm === entry.term) {
                          setSelectedTerm(null);
                          setNewTerm("");
                          setNewVariants("");
                        }
                      }}
                      aria-label={`Remove ${entry.term}`}
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
            <Button
              variant="outline"
              onClick={handleExport}
              disabled={lexiconEntries.length === 0}
            >
              <Download className="h-4 w-4 mr-2" />
              Export
            </Button>
          </div>
          <div className="text-xs text-muted-foreground">
            Import/Export format: Term | variant 1, variant 2
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
