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
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
  systemPrompt: `Du bist ein Experte für Textüberarbeitung. Deine Aufgabe ist es, den gegebenen Text zu verbessern.

WICHTIG:
- Behalte den originalen Stil und Ton bei
- Verändere NICHT den Inhalt oder die Bedeutung
- Antworte NUR mit dem verbesserten Text, keine Erklärungen`,
  userPromptTemplate: `Überarbeite den folgenden Text:

{{text}}

Antworte NUR mit dem überarbeiteten Text, keine Erklärungen oder Anführungszeichen.`,
};

interface TemplateFormProps {
  initialData?: Partial<TemplateFormData>;
  onSave: (data: TemplateFormData) => void;
  onCancel: () => void;
  isEditing?: boolean;
  isDefault?: boolean;
}

function TemplateForm({ initialData, onSave, onCancel, isEditing, isDefault }: TemplateFormProps) {
  const [form, setForm] = useState<TemplateFormData>({
    ...EMPTY_FORM,
    ...initialData,
  });
  const [errors, setErrors] = useState<string[]>([]);

  const validate = (): string[] => {
    const errs: string[] = [];
    if (!form.name.trim()) {
      errs.push("Template-Name ist erforderlich");
    }
    if (!form.systemPrompt.trim()) {
      errs.push("System Prompt ist erforderlich");
    }
    if (!form.userPromptTemplate.trim()) {
      errs.push("User Prompt Template ist erforderlich");
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
          placeholder="z.B. Grammatik-Korrektur"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="system-prompt">System Prompt</Label>
        <Textarea
          id="system-prompt"
          value={form.systemPrompt}
          onChange={(e) => setForm((prev) => ({ ...prev, systemPrompt: e.target.value }))}
          placeholder="Anweisungen für das AI-Modell..."
          className="min-h-[120px] font-mono text-sm"
        />
        <p className="text-xs text-muted-foreground">
          Definiert das Verhalten und die Rolle des AI-Modells.
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="user-prompt">User Prompt Template</Label>
        <Textarea
          id="user-prompt"
          value={form.userPromptTemplate}
          onChange={(e) => setForm((prev) => ({ ...prev, userPromptTemplate: e.target.value }))}
          placeholder="Vorlage für die Benutzeranfrage..."
          className="min-h-[150px] font-mono text-sm"
        />
        <p className="text-xs text-muted-foreground">
          Verfügbare Platzhalter: <code className="bg-muted px-1 rounded">{"{{text}}"}</code>,{" "}
          <code className="bg-muted px-1 rounded">{"{{previousText}}"}</code>,{" "}
          <code className="bg-muted px-1 rounded">{"{{nextText}}"}</code>,{" "}
          <code className="bg-muted px-1 rounded">{"{{speaker}}"}</code>
        </p>
      </div>

      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="outline" onClick={onCancel}>
          <X className="h-4 w-4 mr-1" />
          Abbrechen
        </Button>
        <Button type="submit">
          <Check className="h-4 w-4 mr-1" />
          {isEditing ? "Speichern" : "Erstellen"}
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
                  Standard-Template
                </Badge>
              )}
              {isDefaultTemplate && (
                <Badge variant="default" className="text-xs">
                  Tastenkürzel
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
              aria-label={expanded ? "Einklappen" : "Ausklappen"}
            >
              {expanded ? (
                <ChevronUp className="h-4 w-4" />
              ) : (
                <ChevronDown className="h-4 w-4" />
              )}
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
                Im Quick-Access Menü anzeigen
              </Label>
            </div>

            {!isDefaultTemplate && (
              <Button
                variant="outline"
                size="sm"
                onClick={onSetAsDefault}
                className="h-8"
              >
                <Sparkles className="h-3 w-3 mr-1" />
                Als Tastenkürzel-Standard setzen
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
              Bearbeiten
            </Button>
            {!template.isDefault && (
              <Button
                variant="outline"
                size="sm"
                onClick={onDelete}
                className="text-destructive hover:text-destructive"
              >
                <Trash2 className="h-4 w-4 mr-1" />
                Löschen
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
  const templates = useTranscriptStore((s) => s.aiRevisionConfig.templates);
  const defaultTemplateId = useTranscriptStore((s) => s.aiRevisionConfig.defaultTemplateId);
  const quickAccessIds = useTranscriptStore((s) => s.aiRevisionConfig.quickAccessTemplateIds);

  // Store actions
  const addTemplate = useTranscriptStore((s) => s.addRevisionTemplate);
  const updateTemplate = useTranscriptStore((s) => s.updateRevisionTemplate);
  const deleteTemplate = useTranscriptStore((s) => s.deleteRevisionTemplate);
  const setDefaultTemplate = useTranscriptStore((s) => s.setDefaultRevisionTemplate);
  const toggleQuickAccess = useTranscriptStore((s) => s.toggleQuickAccessTemplate);

  const handleAddTemplate = useCallback(
    (data: TemplateFormData) => {
      addTemplate({
        name: data.name,
        systemPrompt: data.systemPrompt,
        userPromptTemplate: data.userPromptTemplate,
      });
      setShowForm(false);
    },
    [addTemplate],
  );

  const handleUpdateTemplate = useCallback(
    (id: string, data: TemplateFormData) => {
      updateTemplate(id, {
        name: data.name,
        systemPrompt: data.systemPrompt,
        userPromptTemplate: data.userPromptTemplate,
      });
      setEditingId(null);
    },
    [updateTemplate],
  );

  const handleDeleteTemplate = useCallback(
    (id: string) => {
      if (window.confirm("Möchten Sie dieses Template wirklich löschen?")) {
        deleteTemplate(id);
      }
    },
    [deleteTemplate],
  );

  // Separate default and custom templates
  const defaultTemplates = templates.filter((t) => t.isDefault);
  const customTemplates = templates.filter((t) => !t.isDefault);

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium">AI Revision Templates</h3>
        <p className="text-sm text-muted-foreground">
          Verwalten Sie Ihre Prompt-Templates für die AI-Textüberarbeitung.
          Standard-Templates können bearbeitet, aber nicht gelöscht werden.
        </p>
      </div>

      <Separator />

      {/* Default Template Selection */}
      <div className="space-y-2">
        <Label>Tastenkürzel-Standard (Alt+R)</Label>
        <Select
          value={defaultTemplateId ?? ""}
          onValueChange={(id) => setDefaultTemplate(id)}
        >
          <SelectTrigger className="w-full max-w-xs">
            <SelectValue placeholder="Template wählen..." />
          </SelectTrigger>
          <SelectContent>
            {templates.map((template) => (
              <SelectItem key={template.id} value={template.id}>
                {template.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground">
          Dieses Template wird ausgeführt, wenn Sie Alt+R drücken.
        </p>
      </div>

      <Separator />

      {/* Add Template Button */}
      {!showForm && !editingId && (
        <Button onClick={() => setShowForm(true)}>
          <Plus className="h-4 w-4 mr-1" />
          Neues Template erstellen
        </Button>
      )}

      {/* Add Template Form */}
      {showForm && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Neues Template erstellen</CardTitle>
          </CardHeader>
          <CardContent>
            <TemplateForm
              onSave={handleAddTemplate}
              onCancel={() => setShowForm(false)}
            />
          </CardContent>
        </Card>
      )}

      {/* Standard Templates */}
      {defaultTemplates.length > 0 && (
        <div className="space-y-3">
          <h4 className="text-sm font-medium text-muted-foreground">Standard-Templates</h4>
          <div className="space-y-2">
            {defaultTemplates.map((template) =>
              editingId === template.id ? (
                <Card key={template.id}>
                  <CardHeader>
                    <CardTitle className="text-base">Template bearbeiten</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <TemplateForm
                      initialData={{
                        name: template.name,
                        systemPrompt: template.systemPrompt,
                        userPromptTemplate: template.userPromptTemplate,
                      }}
                      onSave={(data) => handleUpdateTemplate(template.id, data)}
                      onCancel={() => setEditingId(null)}
                      isEditing
                      isDefault={template.isDefault}
                    />
                  </CardContent>
                </Card>
              ) : (
                <TemplateCard
                  key={template.id}
                  template={template}
                  isDefaultTemplate={template.id === defaultTemplateId}
                  isQuickAccess={quickAccessIds.includes(template.id)}
                  onEdit={() => setEditingId(template.id)}
                  onDelete={() => handleDeleteTemplate(template.id)}
                  onToggleQuickAccess={() => toggleQuickAccess(template.id)}
                  onSetAsDefault={() => setDefaultTemplate(template.id)}
                />
              ),
            )}
          </div>
        </div>
      )}

      {/* Custom Templates */}
      {customTemplates.length > 0 && (
        <div className="space-y-3">
          <h4 className="text-sm font-medium text-muted-foreground">Eigene Templates</h4>
          <div className="space-y-2">
            {customTemplates.map((template) =>
              editingId === template.id ? (
                <Card key={template.id}>
                  <CardHeader>
                    <CardTitle className="text-base">Template bearbeiten</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <TemplateForm
                      initialData={{
                        name: template.name,
                        systemPrompt: template.systemPrompt,
                        userPromptTemplate: template.userPromptTemplate,
                      }}
                      onSave={(data) => handleUpdateTemplate(template.id, data)}
                      onCancel={() => setEditingId(null)}
                      isEditing
                    />
                  </CardContent>
                </Card>
              ) : (
                <TemplateCard
                  key={template.id}
                  template={template}
                  isDefaultTemplate={template.id === defaultTemplateId}
                  isQuickAccess={quickAccessIds.includes(template.id)}
                  onEdit={() => setEditingId(template.id)}
                  onDelete={() => handleDeleteTemplate(template.id)}
                  onToggleQuickAccess={() => toggleQuickAccess(template.id)}
                  onSetAsDefault={() => setDefaultTemplate(template.id)}
                />
              ),
            )}
          </div>
        </div>
      )}

      {/* Empty state for custom templates */}
      {customTemplates.length === 0 && !showForm && (
        <p className="text-sm text-muted-foreground py-4">
          Sie haben noch keine eigenen Templates erstellt. Klicken Sie auf "Neues Template erstellen" um zu beginnen.
        </p>
      )}
    </div>
  );
}

