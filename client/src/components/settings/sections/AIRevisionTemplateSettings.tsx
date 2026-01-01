/**
 * AI Revision Template Settings
 *
 * Configuration UI for AI Revision prompt templates.
 * Allows managing templates for text revision features.
 */

import {
  AlertCircle,
  Check,
  ChevronDown,
  ChevronUp,
  Edit2,
  Plus,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import { useCallback, useState } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { useTranscriptStore } from "@/lib/store";
import type { AIRevisionTemplate } from "@/lib/store/types";
import { cn } from "@/lib/utils";

// ==================== Template Form ====================

interface TemplateFormData {
  name: string;
  systemPrompt: string;
  userPromptTemplate: string;
}

const EMPTY_FORM: TemplateFormData = {
  name: "",
  systemPrompt: `You are an expert in text revision. Your task is to improve the given text.

IMPORTANT:
- Keep the original style and tone
- Do NOT change the content or meaning
- Reply ONLY with the improved text, no explanations`,
  userPromptTemplate: `Revise the following text:

{{text}}

Reply ONLY with the revised text, no explanations or quotes.`,
};

interface TemplateFormProps {
  initialData?: Partial<TemplateFormData>;
  onSave: (data: TemplateFormData) => void;
  onCancel: () => void;
  isEditing?: boolean;
  isDefault?: boolean;
}

function TemplateForm({
  initialData,
  onSave,
  onCancel,
  isEditing,
  isDefault: _isDefault,
}: TemplateFormProps) {
  const [form, setForm] = useState<TemplateFormData>({
    ...EMPTY_FORM,
    ...initialData,
  });
  const [errors, setErrors] = useState<string[]>([]);

  const validate = (): string[] => {
    const errs: string[] = [];
    if (!form.name.trim()) {
      errs.push("Template name is required");
    }
    if (!form.systemPrompt.trim()) {
      errs.push("System Prompt is required");
    }
    if (!form.userPromptTemplate.trim()) {
      errs.push("User Prompt Template is required");
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
        <Label htmlFor="template-name">Name</Label>
        <Input
          id="template-name"
          value={form.name}
          onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
          placeholder="e.g. Grammar Correction"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="system-prompt">System Prompt</Label>
        <Textarea
          id="system-prompt"
          value={form.systemPrompt}
          onChange={(e) => setForm((prev) => ({ ...prev, systemPrompt: e.target.value }))}
          placeholder="Instructions for the AI model..."
          className="min-h-[120px] font-mono text-sm"
        />
        <p className="text-xs text-muted-foreground">
          Defines the behavior and role of the AI model.
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="user-prompt">User Prompt Template</Label>
        <Textarea
          id="user-prompt"
          value={form.userPromptTemplate}
          onChange={(e) => setForm((prev) => ({ ...prev, userPromptTemplate: e.target.value }))}
          placeholder="Template for the user request..."
          className="min-h-[150px] font-mono text-sm"
        />
        <p className="text-xs text-muted-foreground">
          Available placeholders: <code className="bg-muted px-1 rounded">{"{{text}}"}</code>,{" "}
          <code className="bg-muted px-1 rounded">{"{{previousText}}"}</code>,{" "}
          <code className="bg-muted px-1 rounded">{"{{nextText}}"}</code>,{" "}
          <code className="bg-muted px-1 rounded">{"{{speaker}}"}</code>
        </p>
      </div>

      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="outline" onClick={onCancel}>
          <X className="h-4 w-4 mr-1" />
          Cancel
        </Button>
        <Button type="submit">
          <Check className="h-4 w-4 mr-1" />
          {isEditing ? "Save" : "Create"}
        </Button>
      </div>
    </form>
  );
}

// ==================== Template Card ====================

interface TemplateCardProps {
  template: AIRevisionTemplate;
  isDefaultTemplate: boolean;
  isQuickAccess: boolean;
  onEdit: () => void;
  onDelete: () => void;
  onToggleQuickAccess: () => void;
  onSetAsDefault: () => void;
}

function TemplateCard({
  template,
  isDefaultTemplate,
  isQuickAccess,
  onEdit,
  onDelete,
  onToggleQuickAccess,
  onSetAsDefault,
}: TemplateCardProps) {
  const [expanded, setExpanded] = useState(false);

  return (
    <Card className={cn(isDefaultTemplate && "border-primary/50")}>
      <CardHeader className="py-3 px-4">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <CardTitle className="text-base font-medium">{template.name}</CardTitle>
              {template.isDefault && (
                <Badge variant="secondary" className="text-xs">
                  Default Template
                </Badge>
              )}
              {isDefaultTemplate && (
                <Badge variant="default" className="text-xs">
                  Hotkey
                </Badge>
              )}
              {isQuickAccess && (
                <Badge variant="outline" className="text-xs">
                  Quick-Access
                </Badge>
              )}
            </div>
          </div>

          <div className="flex items-center gap-1 shrink-0">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => setExpanded(!expanded)}
              aria-label={expanded ? "Collapse" : "Expand"}
            >
              {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </Button>
          </div>
        </div>
      </CardHeader>

      {expanded && (
        <CardContent className="pt-0 pb-4 px-4 space-y-4">
          <Separator />

          {/* Quick Access & Default Settings */}
          <div className="flex flex-wrap gap-4">
            <div className="flex items-center gap-2">
              <Checkbox
                id={`quick-access-${template.id}`}
                checked={isQuickAccess}
                onCheckedChange={onToggleQuickAccess}
              />
              <Label
                htmlFor={`quick-access-${template.id}`}
                className="text-sm font-normal cursor-pointer"
              >
                Show in Quick-Access menu
              </Label>
            </div>

            {!isDefaultTemplate && (
              <Button variant="outline" size="sm" onClick={onSetAsDefault} className="h-8">
                <Sparkles className="h-3 w-3 mr-1" />
                Set as hotkey default
              </Button>
            )}
          </div>

          {/* Prompts Preview */}
          <div className="space-y-3">
            <div>
              <Label className="text-xs text-muted-foreground">System Prompt</Label>
              <pre className="mt-1 p-2 bg-muted rounded-md text-xs font-mono overflow-auto max-h-32">
                {template.systemPrompt}
              </pre>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">User Prompt Template</Label>
              <pre className="mt-1 p-2 bg-muted rounded-md text-xs font-mono overflow-auto max-h-32">
                {template.userPromptTemplate}
              </pre>
            </div>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" size="sm" onClick={onEdit}>
              <Edit2 className="h-4 w-4 mr-1" />
              Edit
            </Button>
            {!template.isDefault && (
              <Button
                variant="outline"
                size="sm"
                onClick={onDelete}
                className="text-destructive hover:text-destructive"
              >
                <Trash2 className="h-4 w-4 mr-1" />
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

export function AIRevisionTemplateSettings() {
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Store state
  const prompts = useTranscriptStore((s) => s.aiRevisionConfig.prompts);
  const defaultPromptId = useTranscriptStore((s) => s.aiRevisionConfig.defaultPromptId);
  const quickAccessIds = useTranscriptStore((s) => s.aiRevisionConfig.quickAccessPromptIds);

  // Store actions
  const addPrompt = useTranscriptStore((s) => s.addRevisionPrompt);
  const updatePrompt = useTranscriptStore((s) => s.updateRevisionPrompt);
  const deletePrompt = useTranscriptStore((s) => s.deleteRevisionPrompt);
  const setDefaultPrompt = useTranscriptStore((s) => s.setDefaultRevisionPrompt);
  const toggleQuickAccess = useTranscriptStore((s) => s.toggleQuickAccessPrompt);

  const handleAddPrompt = useCallback(
    (data: TemplateFormData) => {
      addPrompt({
        name: data.name,
        type: "text" as const,
        systemPrompt: data.systemPrompt,
        userPromptTemplate: data.userPromptTemplate,
        isBuiltIn: false,
        quickAccess: false,
      });
      setShowForm(false);
    },
    [addPrompt],
  );

  const handleUpdatePrompt = useCallback(
    (id: string, data: TemplateFormData) => {
      updatePrompt(id, {
        name: data.name,
        systemPrompt: data.systemPrompt,
        userPromptTemplate: data.userPromptTemplate,
      });
      setEditingId(null);
    },
    [updatePrompt],
  );

  const handleDeletePrompt = useCallback(
    (id: string) => {
      if (window.confirm("Are you sure you want to delete this prompt?")) {
        deletePrompt(id);
      }
    },
    [deletePrompt],
  );

  // Separate built-in and custom prompts
  const builtInPrompts = prompts.filter((p) => p.isBuiltIn);
  const customPrompts = prompts.filter((p) => !p.isBuiltIn);

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium">AI Text Revision Prompts</h3>
        <p className="text-sm text-muted-foreground">
          Manage your prompts for AI text revision. Built-in prompts can be edited but not deleted.
        </p>
      </div>

      <Separator />

      {/* Default prompt Selection */}
      <div className="space-y-2">
        <Label>Hotkey Default (Alt+R)</Label>
        <Select value={defaultPromptId ?? ""} onValueChange={(id) => setDefaultPrompt(id)}>
          <SelectTrigger className="w-full max-w-xs">
            <SelectValue placeholder="Select prompt..." />
          </SelectTrigger>
          <SelectContent>
            {prompts.map((promptItem) => (
              <SelectItem key={promptItem.id} value={promptItem.id}>
                {promptItem.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground">
          This prompt will be executed when you press Alt+R.
        </p>
      </div>

      <Separator />

      {/* Add Prompt Button */}
      {!showForm && !editingId && (
        <Button onClick={() => setShowForm(true)}>
          <Plus className="h-4 w-4 mr-1" />
          Create New Prompt
        </Button>
      )}

      {/* Add Prompt Form */}
      {showForm && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Create New Prompt</CardTitle>
          </CardHeader>
          <CardContent>
            <TemplateForm onSave={handleAddPrompt} onCancel={() => setShowForm(false)} />
          </CardContent>
        </Card>
      )}

      {/* Built-in Prompts */}
      {builtInPrompts.length > 0 && (
        <div className="space-y-3">
          <h4 className="text-sm font-medium text-muted-foreground">Built-in Prompts</h4>
          <div className="space-y-2">
            {builtInPrompts.map((promptItem) =>
              editingId === promptItem.id ? (
                <Card key={promptItem.id}>
                  <CardHeader>
                    <CardTitle className="text-base">Edit Prompt</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <TemplateForm
                      initialData={{
                        name: promptItem.name,
                        systemPrompt: promptItem.systemPrompt,
                        userPromptTemplate: promptItem.userPromptTemplate,
                      }}
                      onSave={(data) => handleUpdatePrompt(promptItem.id, data)}
                      onCancel={() => setEditingId(null)}
                      isEditing
                      isDefault={promptItem.isBuiltIn}
                    />
                  </CardContent>
                </Card>
              ) : (
                <TemplateCard
                  key={promptItem.id}
                  template={promptItem}
                  isDefaultTemplate={promptItem.id === defaultPromptId}
                  isQuickAccess={quickAccessIds.includes(promptItem.id)}
                  onEdit={() => setEditingId(promptItem.id)}
                  onDelete={() => handleDeletePrompt(promptItem.id)}
                  onToggleQuickAccess={() => toggleQuickAccess(promptItem.id)}
                  onSetAsDefault={() => setDefaultPrompt(promptItem.id)}
                />
              ),
            )}
          </div>
        </div>
      )}

      {/* Custom Prompts */}
      {customPrompts.length > 0 && (
        <div className="space-y-3">
          <h4 className="text-sm font-medium text-muted-foreground">Custom Prompts</h4>
          <div className="space-y-2">
            {customPrompts.map((promptItem) =>
              editingId === promptItem.id ? (
                <Card key={promptItem.id}>
                  <CardHeader>
                    <CardTitle className="text-base">Edit Prompt</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <TemplateForm
                      initialData={{
                        name: promptItem.name,
                        systemPrompt: promptItem.systemPrompt,
                        userPromptTemplate: promptItem.userPromptTemplate,
                      }}
                      onSave={(data) => handleUpdatePrompt(promptItem.id, data)}
                      onCancel={() => setEditingId(null)}
                      isEditing
                    />
                  </CardContent>
                </Card>
              ) : (
                <TemplateCard
                  key={promptItem.id}
                  template={promptItem}
                  isDefaultTemplate={promptItem.id === defaultPromptId}
                  isQuickAccess={quickAccessIds.includes(promptItem.id)}
                  onEdit={() => setEditingId(promptItem.id)}
                  onDelete={() => handleDeletePrompt(promptItem.id)}
                  onToggleQuickAccess={() => toggleQuickAccess(promptItem.id)}
                  onSetAsDefault={() => setDefaultPrompt(promptItem.id)}
                />
              ),
            )}
          </div>
        </div>
      )}

      {/* Empty state for custom prompts */}
      {customPrompts.length === 0 && !showForm && (
        <p className="text-sm text-muted-foreground py-4">
          You haven't created any custom prompts yet. Click "Create New Prompt" to get started.
        </p>
      )}
    </div>
  );
}
