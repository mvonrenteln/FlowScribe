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
import { extractHunspellFromOxt, listHunspellPairsFromOxt } from "@/lib/oxt";
import { useTranscriptStore } from "@/lib/store";

interface SpellcheckDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function SpellcheckDialog({ open, onOpenChange }: SpellcheckDialogProps) {
  const ignoreWords = useTranscriptStore((state) => state.spellcheckIgnoreWords);
  const customDictionaries = useTranscriptStore((state) => state.spellcheckCustomDictionaries);
  const setIgnoreWords = useTranscriptStore((state) => state.setSpellcheckIgnoreWords);
  const addIgnoreWord = useTranscriptStore((state) => state.addSpellcheckIgnoreWord);
  const removeIgnoreWord = useTranscriptStore((state) => state.removeSpellcheckIgnoreWord);
  const clearIgnoreWords = useTranscriptStore((state) => state.clearSpellcheckIgnoreWords);
  const addCustomDictionary = useTranscriptStore((state) => state.addSpellcheckCustomDictionary);
  const removeCustomDictionary = useTranscriptStore(
    (state) => state.removeSpellcheckCustomDictionary,
  );
  const [newWord, setNewWord] = useState("");
  const [customName, setCustomName] = useState("");
  const [customLanguage, setCustomLanguage] = useState<"de" | "en">("de");
  const [customAffFile, setCustomAffFile] = useState<File | null>(null);
  const [customDicFile, setCustomDicFile] = useState<File | null>(null);
  const [customError, setCustomError] = useState<string | null>(null);
  const [pendingOxtBuffer, setPendingOxtBuffer] = useState<ArrayBuffer | null>(null);
  const [pendingOxtCandidates, setPendingOxtCandidates] = useState<
    Array<{ name: string }>
  >([]);
  const importInputRef = useRef<HTMLInputElement>(null);
  const customAffInputRef = useRef<HTMLInputElement>(null);
  const customDicInputRef = useRef<HTMLInputElement>(null);
  const customOxtInputRef = useRef<HTMLInputElement>(null);

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

  const readFileText = (file: File) =>
    new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result ?? ""));
      reader.onerror = () => reject(reader.error);
    reader.readAsText(file);
  });

  const readFileBuffer = (file: File) =>
    new Promise<ArrayBuffer>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as ArrayBuffer);
      reader.onerror = () => reject(reader.error);
      reader.readAsArrayBuffer(file);
    });

  const handleCustomImport = async () => {
    setCustomError(null);
    if (!customAffFile || !customDicFile) {
      setCustomError("Please select both .aff and .dic files.");
      return;
    }
    const name =
      customName.trim() ||
      customDicFile.name.replace(/\.dic$/i, "") ||
      customAffFile.name.replace(/\.aff$/i, "");
    if (!name) {
      setCustomError("Please provide a name for this dictionary.");
      return;
    }
    try {
      const [aff, dic] = await Promise.all([
        readFileText(customAffFile),
        readFileText(customDicFile),
      ]);
      await addCustomDictionary({
        name,
        language: customLanguage,
        aff,
        dic,
      });
      setCustomName("");
      setCustomAffFile(null);
      setCustomDicFile(null);
    } catch (err) {
      console.error("Failed to import spellcheck dictionary:", err);
      setCustomError("Failed to import dictionary.");
    }
  };

  const handleOxtImport = async (file: File) => {
    setCustomError(null);
    try {
      const buffer = await readFileBuffer(file);
      const candidates = await listHunspellPairsFromOxt(buffer);
      if (candidates.length === 1) {
        const extracted = await extractHunspellFromOxt(buffer, candidates[0]?.name);
        const name = customName.trim() || extracted.name;
        await addCustomDictionary({
          name,
          language: customLanguage,
          aff: extracted.aff,
          dic: extracted.dic,
        });
        setCustomName("");
      } else {
        setPendingOxtBuffer(buffer);
        setPendingOxtCandidates(candidates.map((candidate) => ({ name: candidate.name })));
      }
    } catch (err) {
      console.error("Failed to import .oxt dictionary:", err);
      setCustomError("Failed to import .oxt dictionary.");
    }
  };

  const handleOxtCandidateSelect = async (candidateName: string) => {
    if (!pendingOxtBuffer) return;
    setCustomError(null);
    try {
      const extracted = await extractHunspellFromOxt(pendingOxtBuffer, candidateName);
      const name = customName.trim() || extracted.name;
      await addCustomDictionary({
        name,
        language: customLanguage,
        aff: extracted.aff,
        dic: extracted.dic,
      });
      setCustomName("");
    } catch (err) {
      console.error("Failed to import selected .oxt dictionary:", err);
      setCustomError("Failed to import selected dictionary.");
    } finally {
      setPendingOxtBuffer(null);
      setPendingOxtCandidates([]);
    }
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

          <div className="space-y-2 border-t pt-4">
            <div className="text-sm font-medium">Custom dictionaries</div>
            <div className="text-xs text-muted-foreground">
              Hunspell `.aff` + `.dic` files add extra terms. They are read-only after import.
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Input
                value={customName}
                onChange={(event) => setCustomName(event.target.value)}
                placeholder="Dictionary name..."
                className="min-w-[180px]"
              />
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant={customLanguage === "de" ? "secondary" : "outline"}
                  onClick={() => setCustomLanguage("de")}
                >
                  DE
                </Button>
                <Button
                  size="sm"
                  variant={customLanguage === "en" ? "secondary" : "outline"}
                  onClick={() => setCustomLanguage("en")}
                >
                  EN
                </Button>
              </div>
            </div>
            {pendingOxtCandidates.length > 1 && (
              <div className="space-y-2 rounded-md border p-2">
                <div className="text-xs text-muted-foreground">
                  This .oxt contains multiple dictionaries. Choose one:
                </div>
                <div className="flex flex-wrap gap-2">
                  {pendingOxtCandidates.map((candidate) => (
                    <Button
                      key={candidate.name}
                      size="sm"
                      variant="outline"
                      onClick={() => handleOxtCandidateSelect(candidate.name)}
                    >
                      {candidate.name}
                    </Button>
                  ))}
                </div>
              </div>
            )}
            <div className="flex flex-wrap items-center gap-2">
              <input
                ref={customOxtInputRef}
                type="file"
                accept=".oxt"
                className="hidden"
                onChange={(event) => {
                  const file = event.target.files?.[0] ?? null;
                  if (file) {
                    handleOxtImport(file);
                  }
                  if (event.target) {
                    event.target.value = "";
                  }
                }}
              />
              <Button variant="outline" onClick={() => customOxtInputRef.current?.click()}>
                Import .oxt
              </Button>
              <span className="text-xs text-muted-foreground">
                .oxt contains .aff/.dic
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <input
                ref={customAffInputRef}
                type="file"
                accept=".aff"
                className="hidden"
                onChange={(event) => {
                  const file = event.target.files?.[0] ?? null;
                  setCustomAffFile(file);
                  if (event.target) {
                    event.target.value = "";
                  }
                }}
              />
              <input
                ref={customDicInputRef}
                type="file"
                accept=".dic"
                className="hidden"
                onChange={(event) => {
                  const file = event.target.files?.[0] ?? null;
                  setCustomDicFile(file);
                  if (event.target) {
                    event.target.value = "";
                  }
                }}
              />
              <Button variant="outline" onClick={() => customAffInputRef.current?.click()}>
                Choose .aff
              </Button>
              <span className="text-xs text-muted-foreground">
                {customAffFile?.name ?? "No .aff file"}
              </span>
              <Button variant="outline" onClick={() => customDicInputRef.current?.click()}>
                Choose .dic
              </Button>
              <span className="text-xs text-muted-foreground">
                {customDicFile?.name ?? "No .dic file"}
              </span>
              <Button onClick={handleCustomImport} disabled={!customAffFile || !customDicFile}>
                Import dictionary
              </Button>
            </div>
            {customError && <div className="text-xs text-destructive">{customError}</div>}
            <ScrollArea className="h-32 rounded-md border">
              <div className="p-2 space-y-2">
                {customDictionaries.length === 0 ? (
                  <div className="text-sm text-muted-foreground">No custom dictionaries yet.</div>
                ) : (
                  customDictionaries.map((dictionary) => (
                    <div
                      key={dictionary.id}
                      className="flex items-center justify-between gap-2 rounded-md border px-2 py-1"
                    >
                      <div className="min-w-0">
                        <div className="text-sm truncate">{dictionary.name}</div>
                        <div className="text-xs text-muted-foreground">
                          {dictionary.language.toUpperCase()}
                        </div>
                      </div>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => removeCustomDictionary(dictionary.id)}
                        aria-label={`Remove ${dictionary.name}`}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ))
                )}
              </div>
            </ScrollArea>
            <div className="text-xs text-muted-foreground">
              Download Hunspell dictionaries:{" "}
              <a
                href="https://extensions.libreoffice.org/en/extensions?getCategories=Dictionary"
                target="_blank"
                rel="noreferrer"
                className="underline"
              >
                LibreOffice dictionary list
              </a>
              .
            </div>
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
