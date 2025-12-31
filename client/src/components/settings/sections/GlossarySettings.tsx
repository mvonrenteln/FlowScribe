/**
 * Glossary Settings
 *
 * Configuration UI for the glossary/lexicon feature including:
 * - Fuzzy matching threshold
 * - Highlight options
 * - Term management (add, edit, delete, import, export)
 */

import { Check, Download, Plus, Upload, X } from "lucide-react";
import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { useTranscriptStore } from "@/lib/store";
import { cn } from "@/lib/utils";

export function GlossarySettings() {
  // Store state
  const lexiconEntries = useTranscriptStore((s) => s.lexiconEntries);
  const lexiconThreshold = useTranscriptStore((s) => s.lexiconThreshold);
  const lexiconHighlightUnderline = useTranscriptStore((s) => s.lexiconHighlightUnderline);
  const lexiconHighlightBackground = useTranscriptStore((s) => s.lexiconHighlightBackground);
  const addLexiconEntry = useTranscriptStore((s) => s.addLexiconEntry);
  const removeLexiconEntry = useTranscriptStore((s) => s.removeLexiconEntry);
  const setLexiconEntries = useTranscriptStore((s) => s.setLexiconEntries);
  const updateLexiconEntry = useTranscriptStore((s) => s.updateLexiconEntry);
  const setLexiconThreshold = useTranscriptStore((s) => s.setLexiconThreshold);
  const setLexiconHighlightUnderline = useTranscriptStore((s) => s.setLexiconHighlightUnderline);
  const setLexiconHighlightBackground = useTranscriptStore((s) => s.setLexiconHighlightBackground);

  // Local state
  const [newTerm, setNewTerm] = useState("");
  const [newVariants, setNewVariants] = useState("");
  const [newFalsePositives, setNewFalsePositives] = useState("");
  const [selectedTerm, setSelectedTerm] = useState<string | null>(null);
  const importInputRef = useRef<HTMLInputElement>(null);

  // Helpers
  const parseList = (value: string) =>
    value
      .split(",")
      .map((v) => v.trim())
      .filter(Boolean);

  const stripFalsePositiveLabel = (value: string) =>
    value.replace(/^false positives?:/i, "").trim();

  // Handlers
  const handleAdd = () => {
    if (!newTerm.trim()) return;
    const variants = parseList(newVariants);
    const falsePositives = parseList(newFalsePositives);
    if (selectedTerm) {
      updateLexiconEntry(selectedTerm, newTerm.trim(), variants, falsePositives);
    } else {
      addLexiconEntry(newTerm.trim(), variants, falsePositives);
    }
    resetForm();
  };

  const resetForm = () => {
    setNewTerm("");
    setNewVariants("");
    setNewFalsePositives("");
    setSelectedTerm(null);
  };

  const handleEdit = (entry: { term: string; variants: string[]; falsePositives: string[] }) => {
    setSelectedTerm(entry.term);
    setNewTerm(entry.term);
    setNewVariants(entry.variants.join(", "));
    setNewFalsePositives(entry.falsePositives.join(", "));
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
          const [termPart, variantsPart, falsePositivesPart] = line.split("|");
          const term = termPart?.trim() ?? "";
          const variants = variantsPart ? parseList(variantsPart) : [];
          const falsePositives = falsePositivesPart
            ? parseList(stripFalsePositiveLabel(falsePositivesPart))
            : [];
          return { term, variants, falsePositives };
        });
      setLexiconEntries(entries);
    };
    reader.readAsText(file);
  };

  const handleExport = () => {
    const content = lexiconEntries
      .map((entry) => {
        const variantsPart = entry.variants.length > 0 ? ` | ${entry.variants.join(", ")}` : "";
        const fpPart =
          entry.falsePositives.length > 0
            ? ` | false positives: ${entry.falsePositives.join(", ")}`
            : "";
        return `${entry.term}${variantsPart}${fpPart}`;
      })
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
    <div className="space-y-6">
      {/* Matching Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Fuzzy Matching</CardTitle>
          <CardDescription>
            Configure how similar a word needs to be to trigger a glossary match.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Match Threshold</Label>
              <span className="text-sm font-mono">{lexiconThreshold.toFixed(2)}</span>
            </div>
            <Slider
              value={[lexiconThreshold]}
              min={0.6}
              max={0.95}
              step={0.01}
              onValueChange={(value) => setLexiconThreshold(value[0] ?? 0.82)}
            />
            <p className="text-xs text-muted-foreground">
              Higher = stricter matching (fewer false positives). Lower = more matches (may include
              false positives).
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Highlight Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Highlighting</CardTitle>
          <CardDescription>How glossary matches are displayed in the editor.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="underline-matches">Underline Matches</Label>
              <p className="text-xs text-muted-foreground">
                Applies to all matches, including 100% matches
              </p>
            </div>
            <Switch
              id="underline-matches"
              checked={lexiconHighlightUnderline}
              onCheckedChange={setLexiconHighlightUnderline}
            />
          </div>

          <Separator />

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="highlight-background">Highlight Background</Label>
              <p className="text-xs text-muted-foreground">Only for uncertain (fuzzy) matches</p>
            </div>
            <Switch
              id="highlight-background"
              checked={lexiconHighlightBackground}
              onCheckedChange={setLexiconHighlightBackground}
            />
          </div>
        </CardContent>
      </Card>

      {/* Terms Management */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Glossary Terms</CardTitle>
          <CardDescription>
            Manage terms, variants, and false positives for matching.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Add/Edit Form */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Input
                value={newTerm}
                onChange={(e) => setNewTerm(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleAdd();
                  }
                }}
                placeholder="Term..."
                className="flex-1"
              />
              <Button onClick={handleAdd} disabled={!newTerm.trim()}>
                {selectedTerm ? (
                  <>
                    <Check className="h-4 w-4 mr-1" />
                    Save
                  </>
                ) : (
                  <>
                    <Plus className="h-4 w-4 mr-1" />
                    Add
                  </>
                )}
              </Button>
              {selectedTerm && (
                <Button variant="ghost" onClick={resetForm}>
                  Cancel
                </Button>
              )}
            </div>
            <Input
              value={newVariants}
              onChange={(e) => setNewVariants(e.target.value)}
              placeholder="Variants (comma-separated, optional)"
              className="text-sm"
            />
            <Input
              value={newFalsePositives}
              onChange={(e) => setNewFalsePositives(e.target.value)}
              placeholder="False positives to ignore (comma-separated, optional)"
              className="text-sm"
            />
          </div>

          {/* Terms List */}
          <ScrollArea className="h-48 rounded-md border">
            <div className="p-2 space-y-1">
              {lexiconEntries.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">
                  No glossary terms yet
                </p>
              ) : (
                lexiconEntries.map((entry) => (
                  <div
                    key={entry.term}
                    role="button"
                    tabIndex={0}
                    className={cn(
                      "flex items-center justify-between gap-2 rounded px-2 py-1.5 hover:bg-accent cursor-pointer",
                      selectedTerm === entry.term && "bg-accent",
                    )}
                    onClick={() => handleEdit(entry)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        handleEdit(entry);
                      }
                    }}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium truncate">{entry.term}</div>
                      {entry.variants.length > 0 && (
                        <div className="text-xs text-muted-foreground truncate">
                          Variants: {entry.variants.join(", ")}
                        </div>
                      )}
                    </div>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-6 w-6 shrink-0"
                      onClick={(e) => {
                        e.stopPropagation();
                        removeLexiconEntry(entry.term);
                        if (selectedTerm === entry.term) {
                          resetForm();
                        }
                      }}
                      aria-label={`Remove ${entry.term}`}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                ))
              )}
            </div>
          </ScrollArea>

          {/* Import/Export */}
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
              disabled={lexiconEntries.length === 0}
            >
              <Download className="h-4 w-4 mr-1" />
              Export
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Format: term | variants | false positives: exclusions (one per line)
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
