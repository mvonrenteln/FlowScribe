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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { DEFAULT_SYSTEM_PROMPT, DEFAULT_USER_PROMPT_TEMPLATE } from "@/lib/aiSpeakerService";
import { useTranscriptStore } from "@/lib/store";
import type { PromptTemplate, TemplateCategory } from "@/lib/store/types";
import { cn } from "@/lib/utils";

// ==================== Template Types ====================

interface TemplateCategoryOption {
  value: TemplateCategory;
  label: string;
  description: string;
}

const TEMPLATE_CATEGORIES: TemplateCategoryOption[] = [
  {
    value: "speaker",
    label: "Speaker Classification",
    description: "Classify transcript segments by speaker",
  },
  {
    value: "grammar",
    label: "Grammar Check",
    description: "Check and correct grammar issues",
  },
  {
    value: "summary",
    label: "Summary",
    description: "Generate summaries of content",
  },
  {
    value: "custom",
    label: "Custom",
    description: "Custom use case",
  },
];

// ==================== Template Form ====================

interface TemplateFormData {
  name: string;
  category: TemplateCategory;
  systemPrompt: string;
  userPromptTemplate: string;
}

const EMPTY_FORM: TemplateFormData = {
  name: "",
  category: "speaker",
  systemPrompt: DEFAULT_SYSTEM_PROMPT,
  userPromptTemplate: DEFAULT_USER_PROMPT_TEMPLATE,
};

interface TemplateFormProps {
  initialData?: Partial<TemplateFormData>;
  onSave: (data: TemplateFormData) => void;
  onCancel: () => void;
  isEditing?: boolean;
}

function TemplateForm({ initialData, onSave, onCancel, isEditing }: TemplateFormProps) {
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

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="template-name">Template Name</Label>
          <Input
            id="template-name"
            value={form.name}
            onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
            placeholder="e.g., RPG Session Classifier"
            data-testid="input-template-name"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="template-category">Category</Label>
          <Select
            value={form.category}
            onValueChange={(value) =>
              setForm((prev) => ({ ...prev, category: value as TemplateCategory }))
            }
          >
            <SelectTrigger id="template-category" data-testid="select-template-category">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {TEMPLATE_CATEGORIES.map((cat) => (
                <SelectItem key={cat.value} value={cat.value}>
                  {cat.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label htmlFor="template-system">System Prompt</Label>
          <Button type="button" variant="ghost" size="sm" onClick={handleReset} className="text-xs">
            Reset to Default
          </Button>
        </div>
        <Textarea
          id="template-system"
          value={form.systemPrompt}
          onChange={(e) => setForm((prev) => ({ ...prev, systemPrompt: e.target.value }))}
          placeholder="System instructions for the AI..."
          className="min-h-[200px] font-mono text-sm"
          data-testid="textarea-template-system"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="template-user">User Prompt Template</Label>
        <Textarea
          id="template-user"
          value={form.userPromptTemplate}
          onChange={(e) => setForm((prev) => ({ ...prev, userPromptTemplate: e.target.value }))}
          placeholder="User message template with {{variables}}..."
          className="min-h-[150px] font-mono text-sm"
          data-testid="textarea-template-user"
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

// ==================== Template Card ====================

interface TemplateCardProps {
  template: PromptTemplate;
  isActive: boolean;
  onEdit: () => void;
  onDelete: () => void;
  onSetActive: () => void;
  onDuplicate: () => void;
}

function TemplateCard({
  template,
  isActive,
  onEdit,
  onDelete,
  onSetActive,
  onDuplicate,
}: TemplateCardProps) {
  const [expanded, setExpanded] = useState(false);

  const categoryLabel =
    TEMPLATE_CATEGORIES.find((c) => c.value === template.category)?.label ||
    TEMPLATE_CATEGORIES.find((c) => c.value === "speaker")?.label ||
    "Speaker Classification";

  return (
    <Card className={cn(isActive && "ring-2 ring-primary")}>
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                {template.name}
                {isActive && (
                  <Badge variant="secondary" className="text-xs">
                    Active
                  </Badge>
                )}
                {template.isDefault && (
                  <Badge variant="outline" className="text-xs">
                    Default
                  </Badge>
                )}
              </CardTitle>
              <CardDescription className="text-xs">{categoryLabel}</CardDescription>
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setExpanded(!expanded)}
            aria-label={expanded ? "Collapse template details" : "Expand template details"}
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
              {template.systemPrompt.slice(0, 300)}
              {template.systemPrompt.length > 300 && "..."}
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
            {!template.isDefault && (
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
  const templates = useTranscriptStore((s) => s.aiSpeakerConfig.templates);
  const activeTemplateId = useTranscriptStore((s) => s.aiSpeakerConfig.activeTemplateId);
  const addTemplate = useTranscriptStore((s) => s.addTemplate);
  const updateTemplate = useTranscriptStore((s) => s.updateTemplate);
  const deleteTemplate = useTranscriptStore((s) => s.deleteTemplate);
  const setActiveTemplate = useTranscriptStore((s) => s.setActiveTemplate);

  const [showAddForm, setShowAddForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const importInputRef = useRef<HTMLInputElement>(null);

  const handleAddTemplate = useCallback(
    (data: TemplateFormData) => {
      addTemplate({
        name: data.name,
        category: data.category,
        systemPrompt: data.systemPrompt,
        userPromptTemplate: data.userPromptTemplate,
      });
      setShowAddForm(false);
    },
    [addTemplate],
  );

  const handleEditTemplate = useCallback(
    (id: string, data: TemplateFormData) => {
      updateTemplate(id, {
        name: data.name,
        category: data.category,
        systemPrompt: data.systemPrompt,
        userPromptTemplate: data.userPromptTemplate,
      });
      setEditingId(null);
    },
    [updateTemplate],
  );

  const handleDuplicate = useCallback(
    (template: PromptTemplate) => {
      addTemplate({
        name: `${template.name} (Copy)`,
        category: template.category,
        systemPrompt: template.systemPrompt,
        userPromptTemplate: template.userPromptTemplate,
      });
    },
    [addTemplate],
  );

  const handleExport = useCallback(() => {
    const exportData = {
      version: 1,
      templates: templates.map((t) => ({
        name: t.name,
        category: t.category,
        systemPrompt: t.systemPrompt,
        userPromptTemplate: t.userPromptTemplate,
        isDefault: t.isDefault,
      })),
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "flowscribe-templates.json";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [templates]);

  const handleImport = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = () => {
        try {
          const content = String(reader.result);
          const data = JSON.parse(content);

          if (data.version === 1 && Array.isArray(data.templates)) {
            for (const t of data.templates) {
              if (t.name && t.systemPrompt && t.userPromptTemplate) {
                addTemplate({
                  name: t.name,
                  category: t.category || "custom",
                  systemPrompt: t.systemPrompt,
                  userPromptTemplate: t.userPromptTemplate,
                });
              }
            }
          }
        } catch (error) {
          console.error("[Templates] Failed to import", error);
        }
      };
      reader.readAsText(file);

      // Reset input
      if (importInputRef.current) {
        importInputRef.current.value = "";
      }
    },
    [addTemplate],
  );

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">Prompt Templates</h2>
        <p className="text-sm text-muted-foreground">
          Create and manage prompt templates for AI features like speaker classification.
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

      {/* Template List */}
      <div className="space-y-3">
        {templates.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center text-muted-foreground">
              <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No templates configured.</p>
              <p className="text-sm">Create a template to customize AI behavior.</p>
            </CardContent>
          </Card>
        ) : (
          templates.map((template) =>
            editingId === template.id ? (
              <Card key={template.id}>
                <CardHeader>
                  <CardTitle className="text-base">Edit Template</CardTitle>
                </CardHeader>
                <CardContent>
                  <TemplateForm
                    initialData={{
                      name: template.name,
                      category: template.category || "speaker",
                      systemPrompt: template.systemPrompt,
                      userPromptTemplate: template.userPromptTemplate,
                    }}
                    onSave={(data) => handleEditTemplate(template.id, data)}
                    onCancel={() => setEditingId(null)}
                    isEditing
                  />
                </CardContent>
              </Card>
            ) : (
              <TemplateCard
                key={template.id}
                template={template}
                isActive={template.id === activeTemplateId}
                onEdit={() => setEditingId(template.id)}
                onDelete={() => deleteTemplate(template.id)}
                onSetActive={() => setActiveTemplate(template.id)}
                onDuplicate={() => handleDuplicate(template)}
              />
            ),
          )
        )}
      </div>

      {/* Add Template Form */}
      {showAddForm ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Create New Template</CardTitle>
          </CardHeader>
          <CardContent>
            <TemplateForm onSave={handleAddTemplate} onCancel={() => setShowAddForm(false)} />
          </CardContent>
        </Card>
      ) : (
        <Button
          variant="outline"
          className="w-full"
          onClick={() => setShowAddForm(true)}
          data-testid="button-add-template"
        >
          <Plus className="h-4 w-4 mr-2" />
          Create Template
        </Button>
      )}
    </div>
  );
}
