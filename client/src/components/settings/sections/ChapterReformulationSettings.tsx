/**
 * Chapter Reformulation Settings
 *
 * Configuration UI for chapter reformulation prompts and settings.
 */

import {
  AlertCircle,
  Check,
  ChevronDown,
  ChevronUp,
  Plus,
  Sparkles,
  Trash2,
} from "lucide-react";
import { useCallback, useState } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { useStore } from "@/lib/store";
import { cn } from "@/lib/utils";
import type { ReformulationPrompt } from "@/lib/ai/features/reformulation/types";

export function ChapterReformulationSettings() {
  const prompts = useStore((s) => s.reformulationPrompts);
  const config = useStore((s) => s.reformulationConfig);
  const addPrompt = useStore((s) => s.addReformulationPrompt);
  const updatePrompt = useStore((s) => s.updateReformulationPrompt);
  const deletePrompt = useStore((s) => s.deleteReformulationPrompt);
  const setDefaultPrompt = useStore((s) => s.setDefaultReformulationPrompt);
  const toggleQuickAccess = useStore((s) => s.toggleQuickAccessReformulationPrompt);
  const updateConfig = useStore((s) => s.updateReformulationConfig);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [newPrompt, setNewPrompt] = useState<Partial<ReformulationPrompt>>({
    name: "",
    instructions: "",
  });
  const [showNewPromptForm, setShowNewPromptForm] = useState(false);

  const handleSaveNewPrompt = useCallback(() => {
    if (!newPrompt.name?.trim() || !newPrompt.instructions?.trim()) return;

    addPrompt({
      name: newPrompt.name.trim(),
      instructions: newPrompt.instructions.trim(),
    });

    setNewPrompt({ name: "", instructions: "" });
    setShowNewPromptForm(false);
  }, [newPrompt, addPrompt]);

  const handleSaveEdit = useCallback(
    (id: string, updates: Partial<ReformulationPrompt>) => {
      updatePrompt(id, updates);
      setEditingId(null);
    },
    [updatePrompt],
  );

  const handleDelete = useCallback(
    (id: string) => {
      if (confirm("Diesen Prompt wirklich löschen?")) {
        deletePrompt(id);
      }
    },
    [deletePrompt],
  );

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium">Kapitel-Umformulierung</h3>
        <p className="text-sm text-muted-foreground">
          Konfiguriere Prompts und Einstellungen für die Umformulierung von Kapiteln.
        </p>
      </div>

      <Separator />

      {/* Context Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Kontext-Einstellungen</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center space-x-2">
            <Checkbox
              id="includeContext"
              checked={config.includeContext}
              onCheckedChange={(checked) =>
                updateConfig({ includeContext: checked === true })
              }
            />
            <Label htmlFor="includeContext" className="text-sm font-normal cursor-pointer">
              Kontext einbeziehen (Zusammenfassungen + vorheriges Kapitel)
            </Label>
          </div>

          {config.includeContext && (
            <div className="space-y-2 ml-6">
              <Label htmlFor="contextWordLimit" className="text-sm">
                Maximale Wörter aus vorherigem Kapitel
              </Label>
              <Input
                id="contextWordLimit"
                type="number"
                min={100}
                max={2000}
                value={config.contextWordLimit}
                onChange={(e) =>
                  updateConfig({ contextWordLimit: parseInt(e.target.value) || 500 })
                }
                className="w-32"
              />
              <p className="text-xs text-muted-foreground">
                Standardwert: 500 Wörter
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Prompts */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Prompts</CardTitle>
          <Button
            size="sm"
            variant="outline"
            onClick={() => setShowNewPromptForm(true)}
            className="h-8"
          >
            <Plus className="mr-2 h-4 w-4" />
            Neuer Prompt
          </Button>
        </CardHeader>
        <CardContent className="space-y-3">
          {/* New Prompt Form */}
          {showNewPromptForm && (
            <Card className="border-primary">
              <CardContent className="pt-6 space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="new-prompt-name">Name</Label>
                  <Input
                    id="new-prompt-name"
                    value={newPrompt.name || ""}
                    onChange={(e) => setNewPrompt({ ...newPrompt, name: e.target.value })}
                    placeholder="z.B. Ausführliche Zusammenfassung"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="new-prompt-instructions">Anweisungen</Label>
                  <Textarea
                    id="new-prompt-instructions"
                    value={newPrompt.instructions || ""}
                    onChange={(e) =>
                      setNewPrompt({ ...newPrompt, instructions: e.target.value })
                    }
                    rows={6}
                    placeholder="Beschreibe, wie der Text umformuliert werden soll..."
                    className="font-mono text-sm"
                  />
                </div>

                <div className="flex justify-end gap-2">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      setShowNewPromptForm(false);
                      setNewPrompt({ name: "", instructions: "" });
                    }}
                  >
                    Abbrechen
                  </Button>
                  <Button
                    size="sm"
                    onClick={handleSaveNewPrompt}
                    disabled={!newPrompt.name?.trim() || !newPrompt.instructions?.trim()}
                  >
                    <Check className="mr-2 h-4 w-4" />
                    Speichern
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Existing Prompts */}
          {prompts.map((prompt) => {
            const isExpanded = expandedId === prompt.id;
            const isEditing = editingId === prompt.id;
            const isQuickAccess = config.quickAccessPromptIds.includes(prompt.id);
            const isDefault = config.defaultPromptId === prompt.id;

            return (
              <Card key={prompt.id} className={cn(isDefault && "border-primary")}>
                <CardHeader className="py-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 flex-1">
                      <Sparkles className="h-4 w-4 text-primary" />
                      <span className="font-medium">{prompt.name}</span>
                      {prompt.isBuiltin && (
                        <Badge variant="secondary" className="text-xs">
                          Built-in
                        </Badge>
                      )}
                      {isDefault && (
                        <Badge variant="default" className="text-xs">
                          Standard
                        </Badge>
                      )}
                    </div>

                    <div className="flex items-center gap-1">
                      {!prompt.isBuiltin && (
                        <>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleDelete(prompt.id)}
                            className="h-8 w-8 p-0"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </>
                      )}
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setExpandedId(isExpanded ? null : prompt.id)}
                        className="h-8 w-8 p-0"
                      >
                        {isExpanded ? (
                          <ChevronUp className="h-4 w-4" />
                        ) : (
                          <ChevronDown className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                  </div>
                </CardHeader>

                {isExpanded && (
                  <CardContent className="pt-0 space-y-4">
                    <div className="space-y-2">
                      <Label className="text-xs text-muted-foreground">Anweisungen</Label>
                      <Textarea
                        value={prompt.instructions}
                        readOnly={prompt.isBuiltin}
                        onChange={(e) => handleSaveEdit(prompt.id, { instructions: e.target.value })}
                        rows={6}
                        className="font-mono text-sm"
                      />
                    </div>

                    <Separator />

                    <div className="space-y-3">
                      <div className="flex items-center space-x-2">
                        <Checkbox
                          id={`quick-${prompt.id}`}
                          checked={isQuickAccess}
                          onCheckedChange={() => toggleQuickAccess(prompt.id)}
                        />
                        <Label
                          htmlFor={`quick-${prompt.id}`}
                          className="text-sm font-normal cursor-pointer"
                        >
                          Quick Access anzeigen
                        </Label>
                      </div>

                      {!isDefault && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setDefaultPrompt(prompt.id)}
                          className="w-full"
                        >
                          Als Standard festlegen
                        </Button>
                      )}
                    </div>
                  </CardContent>
                )}
              </Card>
            );
          })}

          {prompts.length === 0 && (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Noch keine Prompts vorhanden. Erstelle deinen ersten Prompt!
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
