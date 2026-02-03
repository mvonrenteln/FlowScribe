/**
 * Chapter Rewrite Settings
 *
 * Configuration UI for chapter rewrite prompts and settings.
 */

import { AlertCircle, Check, ChevronDown, ChevronUp, Plus, Sparkles, Trash2 } from "lucide-react";
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
import type { RewritePrompt } from "@/lib/ai/features/rewrite/types";
import { useTranscriptStore } from "@/lib/store";
import { cn } from "@/lib/utils";

export function ChapterRewriteSettings() {
  const prompts = useTranscriptStore((s) => s.rewritePrompts);
  const config = useTranscriptStore((s) => s.rewriteConfig);
  const addPrompt = useTranscriptStore((s) => s.addRewritePrompt);
  const updatePrompt = useTranscriptStore((s) => s.updateRewritePrompt);
  const deletePrompt = useTranscriptStore((s) => s.deleteRewritePrompt);
  const setDefaultPrompt = useTranscriptStore((s) => s.setDefaultRewritePrompt);
  const toggleQuickAccess = useTranscriptStore((s) => s.toggleQuickAccessRewritePrompt);
  const updateConfig = useTranscriptStore((s) => s.updateRewriteConfig);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [newPrompt, setNewPrompt] = useState<Partial<RewritePrompt>>({
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
    (id: string, updates: Partial<RewritePrompt>) => {
      updatePrompt(id, updates);
      setEditingId(null);
    },
    [updatePrompt],
  );

  const handleDelete = useCallback(
    (id: string) => {
      if (confirm("Really delete this prompt?")) {
        deletePrompt(id);
      }
    },
    [deletePrompt],
  );

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium">Chapter Rewrite</h3>
        <p className="text-sm text-muted-foreground">
          Configure prompts and settings for chapter rewrite.
        </p>
      </div>

      <Separator />

      {/* Context Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Context Settings</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center space-x-2">
            <Checkbox
              id="includeContext"
              checked={config.includeContext}
              onCheckedChange={(checked) => updateConfig({ includeContext: checked === true })}
            />
            <Label htmlFor="includeContext" className="text-sm font-normal cursor-pointer">
              Include context (summaries + previous chapter)
            </Label>
          </div>

          {config.includeContext && (
            <div className="space-y-2 ml-6">
              <Label htmlFor="contextWordLimit" className="text-sm">
                Maximum words from previous chapter
              </Label>
              <Input
                id="contextWordLimit"
                type="number"
                min={100}
                max={2000}
                value={config.contextWordLimit}
                onChange={(e) =>
                  updateConfig({ contextWordLimit: parseInt(e.target.value, 10) || 500 })
                }
                className="w-32"
              />
              <p className="text-xs text-muted-foreground">Default: 500 words</p>
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
            New Prompt
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
                    placeholder="e.g., Detailed Summary"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="new-prompt-instructions">Instructions</Label>
                  <Textarea
                    id="new-prompt-instructions"
                    value={newPrompt.instructions || ""}
                    onChange={(e) => setNewPrompt({ ...newPrompt, instructions: e.target.value })}
                    rows={6}
                    placeholder="Describe how the text should be rewritten..."
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
                    Cancel
                  </Button>
                  <Button
                    size="sm"
                    onClick={handleSaveNewPrompt}
                    disabled={!newPrompt.name?.trim() || !newPrompt.instructions?.trim()}
                  >
                    <Check className="mr-2 h-4 w-4" />
                    Save
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Existing Prompts */}
          {prompts.map((prompt) => {
            const isExpanded = expandedId === prompt.id;
            const _isEditing = editingId === prompt.id;
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
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleDelete(prompt.id)}
                          className="h-8 w-8 p-0"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
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
                      <Label className="text-xs text-muted-foreground">Instructions</Label>
                      <Textarea
                        value={prompt.instructions}
                        readOnly={prompt.isBuiltin}
                        onChange={(e) =>
                          handleSaveEdit(prompt.id, { instructions: e.target.value })
                        }
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
                          Show in Quick Access
                        </Label>
                      </div>

                      {!isDefault && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setDefaultPrompt(prompt.id)}
                          className="w-full"
                        >
                          Set as Default
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
                No prompts available yet. Create your first prompt!
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
