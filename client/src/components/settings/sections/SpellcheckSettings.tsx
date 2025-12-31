/**
 * Spellcheck Settings
 *
 * Configuration UI for spellcheck preferences including:
 * - Enable/disable spellcheck
 * - Language selection
 * - Ignored words management
 * - Custom dictionaries toggle
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
  const ignoreWords = useTranscriptStore((s) => s.spellcheckIgnoreWords);
  const setIgnoreWords = useTranscriptStore((s) => s.setSpellcheckIgnoreWords);
  const addIgnoreWord = useTranscriptStore((s) => s.addSpellcheckIgnoreWord);
  const removeIgnoreWord = useTranscriptStore((s) => s.removeSpellcheckIgnoreWord);
  const clearIgnoreWords = useTranscriptStore((s) => s.clearSpellcheckIgnoreWords);

  // Local state
  const [newWord, setNewWord] = useState("");
  const importInputRef = useRef<HTMLInputElement>(null);

  const sortedWords = useMemo(
    () => [...ignoreWords].sort((a, b) => a.localeCompare(b)),
    [ignoreWords],
  );

  // Handlers
  const handleAddWord = () => {
    if (!newWord.trim()) return;
    addIgnoreWord(newWord.trim());
    setNewWord("");
  };

  const handleToggleLanguage = (langCode: string) => {
    const current = spellcheckLanguages ?? [];
    if (current.includes(langCode)) {
      setSpellcheckLanguages(current.filter((l) => l !== langCode));
    } else {
      setSpellcheckLanguages([...current, langCode]);
    }
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
    <div className="space-y-6">
      {/* Enable/Disable */}
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
            <Label>Languages</Label>
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
              Click to toggle. At least one language should be active.
            </p>
          </div>

          <Separator />

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="custom-dictionaries">Custom Dictionaries</Label>
              <p className="text-xs text-muted-foreground">
                Use additional custom dictionary files
              </p>
            </div>
            <Switch
              id="custom-dictionaries"
              checked={spellcheckCustomEnabled}
              onCheckedChange={setSpellcheckCustomEnabled}
            />
          </div>
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
                if (file) handleImport(file);
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
              onClick={handleExport}
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
