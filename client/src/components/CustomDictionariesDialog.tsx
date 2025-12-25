import { X } from "lucide-react";
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
import { ScrollArea } from "@/components/ui/scroll-area";
import { extractHunspellFromOxt, listHunspellPairsFromOxt } from "@/lib/oxt";
import { useTranscriptStore } from "@/lib/store";

interface CustomDictionariesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CustomDictionariesDialog({ open, onOpenChange }: CustomDictionariesDialogProps) {
  const customDictionaries = useTranscriptStore((state) => state.spellcheckCustomDictionaries);
  const addCustomDictionary = useTranscriptStore((state) => state.addSpellcheckCustomDictionary);
  const removeCustomDictionary = useTranscriptStore(
    (state) => state.removeSpellcheckCustomDictionary,
  );
  const [customAffFile, setCustomAffFile] = useState<File | null>(null);
  const [customDicFile, setCustomDicFile] = useState<File | null>(null);
  const [customError, setCustomError] = useState<string | null>(null);
  const [pendingOxtBuffer, setPendingOxtBuffer] = useState<ArrayBuffer | null>(null);
  const [pendingOxtCandidates, setPendingOxtCandidates] = useState<Array<{ name: string }>>([]);
  const [showManualImport, setShowManualImport] = useState(false);
  const customAffInputRef = useRef<HTMLInputElement>(null);
  const customDicInputRef = useRef<HTMLInputElement>(null);
  const customOxtInputRef = useRef<HTMLInputElement>(null);

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
      customDicFile.name.replace(/\.dic$/i, "") ||
      customAffFile.name.replace(/\.aff$/i, "") ||
      "Custom Dictionary";
    try {
      const [aff, dic] = await Promise.all([
        readFileText(customAffFile),
        readFileText(customDicFile),
      ]);
      await addCustomDictionary({
        name,
        aff,
        dic,
      });
      setCustomAffFile(null);
      setCustomDicFile(null);
      setShowManualImport(false);
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
        await addCustomDictionary({
          name: extracted.name,
          aff: extracted.aff,
          dic: extracted.dic,
        });
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
      await addCustomDictionary({
        name: extracted.name,
        aff: extracted.aff,
        dic: extracted.dic,
      });
    } catch (err) {
      console.error("Failed to import selected .oxt dictionary:", err);
      setCustomError("Failed to import selected dictionary.");
    } finally {
      setPendingOxtBuffer(null);
      setPendingOxtCandidates([]);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Custom Dictionaries</DialogTitle>
          <DialogDescription>
            Import Hunspell dictionaries to add extra languages or special terms.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
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
            <Button onClick={() => customOxtInputRef.current?.click()}>Import .oxt</Button>
            <Button variant="outline" onClick={() => setShowManualImport((prev) => !prev)}>
              {showManualImport ? "Hide .aff/.dic import" : "Import .aff/.dic"}
            </Button>
          </div>
          <div className="space-y-2">
            {showManualImport && (
              <div className="rounded-md border p-2">
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
              </div>
            )}
          </div>
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

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
