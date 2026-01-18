/**
 * Spellcheck Settings
 *
 * Configuration UI for spellcheck preferences including:
 * - Enable/disable spellcheck
 * - Language selection (built-in de/en)
 * - Custom dictionaries (replace built-in languages)
 * - Ignored words management
 */

import { Download, Plus, Upload, X } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { extractHunspellFromOxt, listHunspellPairsFromOxt } from "@/lib/oxt";
import { useTranscriptStore } from "@/lib/store";

const AVAILABLE_LANGUAGES = [
  { code: "de", label: "Deutsch" },
  { code: "en", label: "English" },
] as const;

export function SpellcheckSettings() {
  // Store state
  const spellcheckEnabled = useTranscriptStore((s) => s.spellcheckEnabled);
  const setSpellcheckEnabled = useTranscriptStore((s) => s.setSpellcheckEnabled);
  const spellcheckLanguages = useTranscriptStore((s) => s.spellcheckLanguages);
  const setSpellcheckLanguages = useTranscriptStore((s) => s.setSpellcheckLanguages);
  const spellcheckCustomEnabled = useTranscriptStore((s) => s.spellcheckCustomEnabled);
  const setSpellcheckCustomEnabled = useTranscriptStore((s) => s.setSpellcheckCustomEnabled);
  const customDictionaries = useTranscriptStore((s) => s.spellcheckCustomDictionaries);
  const addCustomDictionary = useTranscriptStore((s) => s.addSpellcheckCustomDictionary);
  const removeCustomDictionary = useTranscriptStore((s) => s.removeSpellcheckCustomDictionary);
  const ignoreWords = useTranscriptStore((s) => s.spellcheckIgnoreWords);
  const setIgnoreWords = useTranscriptStore((s) => s.setSpellcheckIgnoreWords);
  const addIgnoreWord = useTranscriptStore((s) => s.addSpellcheckIgnoreWord);
  const removeIgnoreWord = useTranscriptStore((s) => s.removeSpellcheckIgnoreWord);
  const clearIgnoreWords = useTranscriptStore((s) => s.clearSpellcheckIgnoreWords);

  // Local state
  const [newWord, setNewWord] = useState("");
  const [customError, setCustomError] = useState<string | null>(null);
  const [customAffFile, setCustomAffFile] = useState<File | null>(null);
  const [customDicFile, setCustomDicFile] = useState<File | null>(null);
  const [showManualImport, setShowManualImport] = useState(false);
  const [pendingOxtBuffer, setPendingOxtBuffer] = useState<ArrayBuffer | null>(null);
  const [pendingOxtCandidates, setPendingOxtCandidates] = useState<Array<{ name: string }>>([]);

  const importInputRef = useRef<HTMLInputElement>(null);
  const customOxtInputRef = useRef<HTMLInputElement>(null);
  const customAffInputRef = useRef<HTMLInputElement>(null);
  const customDicInputRef = useRef<HTMLInputElement>(null);

  const sortedWords = useMemo(
    () => [...ignoreWords].sort((a, b) => a.localeCompare(b)),
    [ignoreWords],
  );

  // File reading helpers
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

  // Handlers - Ignore Words
  const handleAddWord = () => {
    if (!newWord.trim()) return;
    addIgnoreWord(newWord.trim());
    setNewWord("");
  };

  const handleToggleLanguage = (langCode: "de" | "en") => {
    const current = spellcheckLanguages ?? [];
    if (current.length === 1 && current[0] === langCode) return;
    setSpellcheckLanguages([langCode]);
  };

  const handleImportWords = (file: File) => {
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

  const handleExportWords = () => {
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

  // Handlers - Custom Dictionaries
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
      } else if (candidates.length > 1) {
        setPendingOxtBuffer(buffer);
        setPendingOxtCandidates(candidates.map((c) => ({ name: c.name })));
      } else {
        setCustomError("No Hunspell dictionaries found in this .oxt file.");
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

  const handleManualDictImport = async () => {
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
      await addCustomDictionary({ name, aff, dic });
      setCustomAffFile(null);
      setCustomDicFile(null);
      setShowManualImport(false);
    } catch (err) {
      console.error("Failed to import spellcheck dictionary:", err);
      setCustomError("Failed to import dictionary.");
    }
  };

  return (
    <div className="space-y-6">
      {/* Enable/Disable & Languages */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Spellcheck</CardTitle>
          <CardDescription>
            Enable spellcheck to highlight potential spelling errors in the transcript.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="spellcheck-enabled">Enable Spellcheck</Label>
              <p className="text-xs text-muted-foreground">
                Underlines misspelled words in the editor
              </p>
            </div>
            <Switch
              id="spellcheck-enabled"
              checked={spellcheckEnabled}
              onCheckedChange={setSpellcheckEnabled}
            />
          </div>

          <Separator />

          <div className="space-y-2">
            <Label>Built-in Languages</Label>
            <div className="flex flex-wrap gap-2">
              {AVAILABLE_LANGUAGES.map((lang) => {
                const isActive = spellcheckLanguages?.includes(lang.code);
                return (
                  <Badge
                    key={lang.code}
                    variant={isActive ? "default" : "outline"}
                    className="cursor-pointer"
                    onClick={() => handleToggleLanguage(lang.code)}
                  >
                    {lang.label}
                    {isActive && <span className="ml-1">✓</span>}
                  </Badge>
                );
              })}
            </div>
            <p className="text-xs text-muted-foreground">
              {spellcheckCustomEnabled
                ? "Built-in languages are disabled when custom dictionaries are active."
                : "Click to switch. Only one language can be active at a time."}
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Custom Dictionaries */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Custom Dictionaries</CardTitle>
          <CardDescription>
            Import Hunspell dictionaries to replace the built-in languages with your own.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="custom-dictionaries">Use Custom Dictionaries</Label>
              <p className="text-xs text-muted-foreground">
                When enabled, custom dictionaries replace built-in de/en
              </p>
            </div>
            <Switch
              id="custom-dictionaries"
              checked={spellcheckCustomEnabled}
              onCheckedChange={setSpellcheckCustomEnabled}
            />
          </div>

          <Separator />

          {/* OXT Candidate Selection */}
          {pendingOxtCandidates.length > 1 && (
            <div className="space-y-2 rounded-md border p-3 bg-muted/50">
              <p className="text-sm font-medium">
                This .oxt contains multiple dictionaries. Choose one:
              </p>
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
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setPendingOxtBuffer(null);
                    setPendingOxtCandidates([]);
                  }}
                >
                  Cancel
                </Button>
              </div>
            </div>
          )}

          {customError && <p className="text-sm text-destructive">{customError}</p>}

          {/* Dictionary List */}
          <ScrollArea className="h-32 rounded-md border">
            <div className="p-2 space-y-1">
              {customDictionaries.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No custom dictionaries imported
                </p>
              ) : (
                customDictionaries.map((dict) => (
                  <div
                    key={dict.id}
                    className="flex items-center justify-between gap-2 rounded px-2 py-1 hover:bg-accent"
                  >
                    <span className="text-sm">{dict.name}</span>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-6 w-6"
                      onClick={() => removeCustomDictionary(dict.id)}
                      aria-label={`Remove ${dict.name}`}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                ))
              )}
            </div>
          </ScrollArea>

          {/* Import Buttons */}
          <div className="flex flex-wrap items-center gap-2">
            <input
              ref={customOxtInputRef}
              type="file"
              accept=".oxt"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleOxtImport(file);
                e.target.value = "";
              }}
            />
            <Button size="sm" onClick={() => customOxtInputRef.current?.click()}>
              <Upload className="h-4 w-4 mr-1" />
              Import .oxt
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setShowManualImport((prev) => !prev)}
            >
              {showManualImport ? "Hide .aff/.dic" : "Import .aff/.dic"}
            </Button>
          </div>

          {/* Manual Import */}
          {showManualImport && (
            <div className="rounded-md border p-3 space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <input
                  ref={customAffInputRef}
                  type="file"
                  accept=".aff"
                  className="hidden"
                  onChange={(e) => {
                    setCustomAffFile(e.target.files?.[0] ?? null);
                    e.target.value = "";
                  }}
                />
                <input
                  ref={customDicInputRef}
                  type="file"
                  accept=".dic"
                  className="hidden"
                  onChange={(e) => {
                    setCustomDicFile(e.target.files?.[0] ?? null);
                    e.target.value = "";
                  }}
                />
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => customAffInputRef.current?.click()}
                >
                  Choose .aff
                </Button>
                <span className="text-xs text-muted-foreground">
                  {customAffFile?.name ?? "No file"}
                </span>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => customDicInputRef.current?.click()}
                >
                  Choose .dic
                </Button>
                <span className="text-xs text-muted-foreground">
                  {customDicFile?.name ?? "No file"}
                </span>
              </div>
              <Button
                size="sm"
                onClick={handleManualDictImport}
                disabled={!customAffFile || !customDicFile}
              >
                Import Dictionary
              </Button>
            </div>
          )}

          <p className="text-xs text-muted-foreground">
            Download Hunspell dictionaries:{" "}
            <a
              href="https://extensions.libreoffice.org/en/extensions?getCategories=Dictionary"
              target="_blank"
              rel="noreferrer"
              className="underline hover:text-foreground"
            >
              LibreOffice dictionary list
            </a>
          </p>
        </CardContent>
      </Card>

      {/* Ignored Words */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Ignored Words</CardTitle>
          <CardDescription>Words that should never be flagged as spelling errors.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-2">
            <Input
              value={newWord}
              onChange={(e) => setNewWord(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleAddWord();
                }
              }}
              placeholder="Add word to ignore..."
              className="flex-1"
            />
            <Button onClick={handleAddWord} disabled={!newWord.trim()}>
              <Plus className="h-4 w-4 mr-1" />
              Add
            </Button>
          </div>

          <ScrollArea className="h-32 rounded-md border">
            <div className="p-2 space-y-1">
              {sortedWords.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No ignored words yet
                </p>
              ) : (
                sortedWords.map((word) => (
                  <div
                    key={word}
                    className="flex items-center justify-between gap-2 rounded px-2 py-1 hover:bg-accent"
                  >
                    <span className="text-sm">{word}</span>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-6 w-6"
                      onClick={() => removeIgnoreWord(word)}
                      aria-label={`Remove ${word}`}
                    >
                      <X className="h-3 w-3" />
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
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleImportWords(file);
                e.target.value = "";
              }}
            />
            <Button variant="outline" size="sm" onClick={() => importInputRef.current?.click()}>
              <Upload className="h-4 w-4 mr-1" />
              Import
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleExportWords}
              disabled={sortedWords.length === 0}
            >
              <Download className="h-4 w-4 mr-1" />
              Export
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={clearIgnoreWords}
              disabled={ignoreWords.length === 0}
            >
              Clear All
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Import/Export format: one word per line (plain text)
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
