/**
 * AI Template Settings
 *
 * Configuration UI for prompt templates.
 * Allows managing templates for different AI features (speaker classification, grammar, etc.).
 */

import {
  AlertCircle,
  Check,
  ChevronDown,
  ChevronUp,
  Copy,
  Download,
  FileText,
  Plus,
  Trash2,
  Upload,
} from "lucide-react";
import { useCallback, useRef, useState } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { DEFAULT_SYSTEM_PROMPT, DEFAULT_USER_PROMPT_TEMPLATE } from "@/lib/aiSpeakerService";
import { useTranscriptStore } from "@/lib/store";
import type { AIPrompt } from "@/lib/store/types";
import { cn } from "@/lib/utils";

// ==================== Prompt Types ====================

// Note: This settings page is for Speaker prompts only (type: 'speaker')
// Text revision prompts are managed in AIRevisionTemplateSettings.tsx

// ==================== Prompt Form ====================

interface PromptFormData {
  name: string;
  systemPrompt: string;
  userPromptTemplate: string;
}

const EMPTY_FORM: PromptFormData = {
  name: "",
  systemPrompt: DEFAULT_SYSTEM_PROMPT,
  userPromptTemplate: DEFAULT_USER_PROMPT_TEMPLATE,
};

interface PromptFormProps {
  initialData?: Partial<PromptFormData>;
  onSave: (data: PromptFormData) => void;
  onCancel: () => void;
  isEditing?: boolean;
}

function PromptForm({ initialData, onSave, onCancel, isEditing }: PromptFormProps) {
  const [form, setForm] = useState<PromptFormData>({
    ...EMPTY_FORM,
    ...initialData,
  });
  const [errors, setErrors] = useState<string[]>([]);

  const validate = (): string[] => {
    const errs: string[] = [];
    if (!form.name.trim()) {
      errs.push("Prompt name is required");
    }
    if (!form.systemPrompt.trim()) {
      errs.push("System prompt is required");
    }
    if (!form.userPromptTemplate.trim()) {
      errs.push("User prompt template is required");
    }
    return errs;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const validationErrors = validate();
    if (validationErrors.length > 0) {
      setErrors(validationErrors);
      return;
    }
    setErrors([]);
    onSave(form);
  };

  const handleReset = () => {
    setForm((prev) => ({
      ...prev,
      systemPrompt: DEFAULT_SYSTEM_PROMPT,
      userPromptTemplate: DEFAULT_USER_PROMPT_TEMPLATE,
    }));
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {errors.length > 0 && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            <ul className="list-disc pl-4">
              {errors.map((error) => (
                <li key={error}>{error}</li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      )}

      <div className="space-y-2">
        <Label htmlFor="prompt-name">Prompt Name</Label>
        <Input
          id="prompt-name"
          value={form.name}
          onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
          placeholder="e.g., RPG Session Classifier"
          data-testid="input-prompt-name"
        />
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label htmlFor="prompt-system">System Prompt</Label>
          <Button type="button" variant="ghost" size="sm" onClick={handleReset} className="text-xs">
            Reset to Default
          </Button>
        </div>
        <Textarea
          id="prompt-system"
          value={form.systemPrompt}
          onChange={(e) => setForm((prev) => ({ ...prev, systemPrompt: e.target.value }))}
          placeholder="System instructions for the AI..."
          className="min-h-[200px] font-mono text-sm"
          data-testid="textarea-prompt-system"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="prompt-user">User Prompt Template</Label>
        <Textarea
          id="prompt-user"
          value={form.userPromptTemplate}
          onChange={(e) => setForm((prev) => ({ ...prev, userPromptTemplate: e.target.value }))}
          placeholder="User message template with {{variables}}..."
          className="min-h-[150px] font-mono text-sm"
          data-testid="textarea-prompt-user"
        />
        <p className="text-xs text-muted-foreground">
          Available variables: <code className="bg-muted px-1 rounded">{"{{speakers}}"}</code>,{" "}
          <code className="bg-muted px-1 rounded">{"{{segments}}"}</code>
        </p>
      </div>

      <Separator />

      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" data-testid="button-save-template">
          {isEditing ? "Save Changes" : "Create Template"}
        </Button>
      </div>
    </form>
  );
}

// ==================== Prompt Card ====================

interface PromptCardProps {
  promptItem: AIPrompt;
  isActive: boolean;
  onEdit: () => void;
  onDelete: () => void;
  onSetActive: () => void;
  onDuplicate: () => void;
}

function PromptCard({
  promptItem,
  isActive,
  onEdit,
  onDelete,
  onSetActive,
  onDuplicate,
}: PromptCardProps) {
  const [expanded, setExpanded] = useState(false);

  return (
    <Card className={cn(isActive && "ring-2 ring-primary")}>
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                {promptItem.name}
                {isActive && (
                  <Badge variant="secondary" className="text-xs">
                    Active
                  </Badge>
                )}
                {promptItem.isBuiltIn && (
                  <Badge variant="outline" className="text-xs">
                    Built-in
                  </Badge>
                )}
              </CardTitle>
              <CardDescription className="text-xs">Speaker Classification</CardDescription>
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setExpanded(!expanded)}
            aria-label={expanded ? "Collapse prompt details" : "Expand prompt details"}
            aria-expanded={expanded}
          >
            {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </Button>
        </div>
      </CardHeader>

      {expanded && (
        <CardContent className="pt-2 space-y-4">
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">System Prompt Preview</Label>
            <pre className="text-xs bg-muted p-2 rounded-md overflow-auto max-h-32">
              {promptItem.systemPrompt.slice(0, 300)}
              {promptItem.systemPrompt.length > 300 && "..."}
            </pre>
          </div>

          <Separator />

          <div className="flex flex-wrap gap-2">
            {!isActive && (
              <Button variant="outline" size="sm" onClick={onSetActive}>
                <Check className="h-3 w-3 mr-1" />
                Set Active
              </Button>
            )}
            <Button variant="outline" size="sm" onClick={onEdit}>
              Edit
            </Button>
            <Button variant="outline" size="sm" onClick={onDuplicate}>
              <Copy className="h-3 w-3 mr-1" />
              Duplicate
            </Button>
            {!promptItem.isBuiltIn && (
              <Button
                variant="outline"
                size="sm"
                onClick={onDelete}
                className="text-destructive hover:text-destructive"
              >
                <Trash2 className="h-3 w-3 mr-1" />
                Delete
              </Button>
            )}
          </div>
        </CardContent>
      )}
    </Card>
  );
}

// ==================== Main Component ====================

export function AITemplateSettings() {
  const prompts = useTranscriptStore((s) => s.aiSpeakerConfig.prompts);
  const activePromptId = useTranscriptStore((s) => s.aiSpeakerConfig.activePromptId);
  const addPrompt = useTranscriptStore((s) => s.addPrompt);
  const updatePrompt = useTranscriptStore((s) => s.updatePrompt);
  const deletePrompt = useTranscriptStore((s) => s.deletePrompt);
  const setActivePrompt = useTranscriptStore((s) => s.setActivePrompt);

  const [showAddForm, setShowAddForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const importInputRef = useRef<HTMLInputElement>(null);

  const handleAddPrompt = useCallback(
    (data: PromptFormData) => {
      addPrompt({
        name: data.name,
        type: "speaker" as const,
        systemPrompt: data.systemPrompt,
        userPromptTemplate: data.userPromptTemplate,
        isBuiltIn: false,
        quickAccess: false,
      });
      setShowAddForm(false);
    },
    [addPrompt],
  );

  const handleEditPrompt = useCallback(
    (id: string, data: PromptFormData) => {
      updatePrompt(id, {
        name: data.name,
        systemPrompt: data.systemPrompt,
        userPromptTemplate: data.userPromptTemplate,
      });
      setEditingId(null);
    },
    [updatePrompt],
  );

  const handleDuplicate = useCallback(
    (promptItem: AIPrompt) => {
      addPrompt({
        name: `${promptItem.name} (Copy)`,
        type: "speaker" as const,
        systemPrompt: promptItem.systemPrompt,
        userPromptTemplate: promptItem.userPromptTemplate,
        isBuiltIn: false,
        quickAccess: false,
      });
    },
    [addPrompt],
  );

  const handleExport = useCallback(() => {
    const exportData = {
      version: 1,
      prompts: prompts.map((p) => ({
        name: p.name,
        type: p.type,
        systemPrompt: p.systemPrompt,
        userPromptTemplate: p.userPromptTemplate,
        isBuiltIn: p.isBuiltIn,
        quickAccess: p.quickAccess,
      })),
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "flowscribe-prompts.json";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [prompts]);

  const handleImport = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = () => {
        try {
          const content = String(reader.result);
          const data = JSON.parse(content);

          // Support both old format (templates) and new format (prompts)
          const items = data.prompts ?? data.templates ?? [];
          if (data.version === 1 && Array.isArray(items)) {
            for (const item of items) {
              if (item.name && item.systemPrompt && item.userPromptTemplate) {
                addPrompt({
                  name: item.name,
                  type: "speaker" as const,
                  systemPrompt: item.systemPrompt,
                  userPromptTemplate: item.userPromptTemplate,
                  isBuiltIn: false,
                  quickAccess: false,
                });
              }
            }
          }
        } catch (error) {
          console.error("[Prompts] Failed to import", error);
        }
      };
      reader.readAsText(file);

      // Reset input
      if (importInputRef.current) {
        importInputRef.current.value = "";
      }
    },
    [addPrompt],
  );

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">AI Speaker Prompts</h2>
        <p className="text-sm text-muted-foreground">
          Create and manage prompts for AI speaker classification.
        </p>
      </div>

      {/* Import/Export Actions */}
      <div className="flex gap-2">
        <Button variant="outline" size="sm" onClick={handleExport}>
          <Download className="h-4 w-4 mr-2" />
          Export All
        </Button>
        <Button variant="outline" size="sm" onClick={() => importInputRef.current?.click()}>
          <Upload className="h-4 w-4 mr-2" />
          Import
        </Button>
        <input
          ref={importInputRef}
          type="file"
          accept=".json"
          className="hidden"
          onChange={handleImport}
        />
      </div>

      {/* Prompt List */}
      <div className="space-y-3">
        {prompts.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center text-muted-foreground">
              <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No prompts configured.</p>
              <p className="text-sm">Create a prompt to customize AI behavior.</p>
            </CardContent>
          </Card>
        ) : (
          prompts.map((promptItem) =>
            editingId === promptItem.id ? (
              <Card key={promptItem.id}>
                <CardHeader>
                  <CardTitle className="text-base">Edit Prompt</CardTitle>
                </CardHeader>
                <CardContent>
                  <PromptForm
                    initialData={{
                      name: promptItem.name,
                      systemPrompt: promptItem.systemPrompt,
                      userPromptTemplate: promptItem.userPromptTemplate,
                    }}
                    onSave={(data) => handleEditPrompt(promptItem.id, data)}
                    onCancel={() => setEditingId(null)}
                    isEditing
                  />
                </CardContent>
              </Card>
            ) : (
              <PromptCard
                key={promptItem.id}
                promptItem={promptItem}
                isActive={promptItem.id === activePromptId}
                onEdit={() => setEditingId(promptItem.id)}
                onDelete={() => deletePrompt(promptItem.id)}
                onSetActive={() => setActivePrompt(promptItem.id)}
                onDuplicate={() => handleDuplicate(promptItem)}
              />
            ),
          )
        )}
      </div>

      {/* Add Prompt Form */}
      {showAddForm ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Create New Prompt</CardTitle>
          </CardHeader>
          <CardContent>
            <PromptForm onSave={handleAddPrompt} onCancel={() => setShowAddForm(false)} />
          </CardContent>
        </Card>
      ) : (
        <Button
          variant="outline"
          className="w-full"
          onClick={() => setShowAddForm(true)}
          data-testid="button-add-prompt"
        >
          <Plus className="h-4 w-4 mr-2" />
          Create Prompt
        </Button>
      )}
    </div>
  );
}
