import { AlertCircle, BookOpen, Info, Sparkles, Wand2 } from "lucide-react";
import { useState } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  CHAPTER_DETECTION_SYSTEM_PROMPT as DEFAULT_CHAPTER_DETECTION_SYSTEM_PROMPT,
  CHAPTER_DETECTION_USER_PROMPT_TEMPLATE as DEFAULT_CHAPTER_DETECTION_USER_PROMPT_TEMPLATE,
} from "@/lib/ai/features/chapterDetection";
import { getExpectedResponseFormat } from "@/lib/ai/features/chapterOperations/types";
import type { AIPrompt, PromptType } from "@/lib/store/types";

// ==================== Constants ====================

const PLACEHOLDER_HELP = {
  detection: [
    { placeholder: "{{batchIndex}}", description: "Current batch number (1-based)" },
    { placeholder: "{{totalBatches}}", description: "Total number of batches" },
    { placeholder: "{{batchSize}}", description: "Batch segment count" },
    { placeholder: "{{minChapterLength}}", description: "Minimum segments per chapter" },
    { placeholder: "{{maxChapterLength}}", description: "Maximum segments per chapter" },
    { placeholder: "{{tagsAvailable}}", description: "Allowed tag IDs for suggestions" },
    { placeholder: "{{segments}}", description: "Segments in this batch (SimpleID formatted)" },
    {
      placeholder: "{{previousChapter}}",
      description: "Previous batch chapter context (optional)",
    },
  ],
  metadata: [
    { placeholder: "{{chapterSegments}}", description: "Full content of the chapter" },
    { placeholder: "{{chapterTitle}}", description: "Current chapter title" },
    { placeholder: "{{currentSummary}}", description: "Current summary (if available)" },
    { placeholder: "{{currentNotes}}", description: "Current notes (if available)" },
  ],
  rewrite: [
    { placeholder: "{{chapterSegments}}", description: "Full content of the chapter" },
    { placeholder: "{{chapterTitle}}", description: "Current chapter title" },
    { placeholder: "{{wordCount}}", description: "Approximate word count of source" },
  ],
} as const;

export interface ChapterPromptFormData {
  name: string;
  type: PromptType;
  operation: "detection" | "rewrite" | "metadata";
  systemPrompt: string;
  userPromptTemplate: string;
}

const getEmptyForm = (operation: ChapterPromptFormData["operation"]): ChapterPromptFormData => ({
  name: "",
  type: "chapter-detect",
  operation,
  systemPrompt: operation === "detection" ? DEFAULT_CHAPTER_DETECTION_SYSTEM_PROMPT : "",
  userPromptTemplate:
    operation === "detection" ? DEFAULT_CHAPTER_DETECTION_USER_PROMPT_TEMPLATE : "",
});

interface ChapterPromptEditorProps {
  initialData?: Partial<AIPrompt>;
  onSave: (data: ChapterPromptFormData) => void;
  onCancel: () => void;
  isEditing?: boolean;
  isBuiltIn?: boolean;
}

export function ChapterPromptEditor({
  initialData,
  onSave,
  onCancel,
  isEditing,
  isBuiltIn,
}: ChapterPromptEditorProps) {
  // Infer initial operation from data or default to 'detection'
  const initialOperation =
    (initialData?.operation as ChapterPromptFormData["operation"]) || "detection";

  const [form, setForm] = useState<ChapterPromptFormData>({
    ...getEmptyForm(initialOperation),
    ...initialData,
    // Ensure fallback to empty strings if undefined
    systemPrompt:
      initialData?.systemPrompt ||
      (initialOperation === "detection" ? DEFAULT_CHAPTER_DETECTION_SYSTEM_PROMPT : ""),
    userPromptTemplate:
      initialData?.userPromptTemplate ||
      (initialOperation === "detection" ? DEFAULT_CHAPTER_DETECTION_USER_PROMPT_TEMPLATE : ""),
    operation: initialOperation,
  });

  const [errors, setErrors] = useState<string[]>([]);

  const placeholders = PLACEHOLDER_HELP[form.operation] || [];

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

  const handleOperationChange = (op: ChapterPromptFormData["operation"]) => {
    setForm((prev) => ({
      ...getEmptyForm(op),
      name: prev.name, // Preserve name
    }));
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
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

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="prompt-name">Prompt Name</Label>
          <Input
            id="prompt-name"
            value={form.name}
            onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
            placeholder="e.g., Creative Chapter Titles"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="prompt-operation">Operation Category</Label>
          <Select
            value={form.operation}
            onValueChange={(val) =>
              handleOperationChange(val as ChapterPromptFormData["operation"])
            }
            disabled={isEditing || isBuiltIn} // Lock operation type when editing existing prompt
          >
            <SelectTrigger id="prompt-operation">
              <SelectValue placeholder="Select operation" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="detection">
                <div className="flex items-center gap-2">
                  <BookOpen className="h-4 w-4" />
                  <span>Chapter Detection</span>
                </div>
              </SelectItem>
              <SelectItem value="metadata">
                <div className="flex items-center gap-2">
                  <Wand2 className="h-4 w-4" />
                  <span>Metadata (Title/Summary/Notes)</span>
                </div>
              </SelectItem>
              <SelectItem value="rewrite">
                <div className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4" />
                  <span>Content Rewrite</span>
                </div>
              </SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="prompt-system">System Prompt</Label>
        <Textarea
          id="prompt-system"
          value={form.systemPrompt}
          onChange={(e) => setForm((prev) => ({ ...prev, systemPrompt: e.target.value }))}
          placeholder="System instructions for the AI..."
          className="min-h-[150px] font-mono text-sm"
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
        />
        <div className="text-xs text-muted-foreground space-y-1">
          <p className="font-medium">Available placeholders:</p>
          <ul className="list-disc pl-4">
            {placeholders.map((p) => (
              <li key={p.placeholder}>
                <code className="bg-muted px-1 rounded">{p.placeholder}</code> - {p.description}
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="rounded-md bg-muted p-4">
        <div className="flex items-center gap-2 mb-2">
          <Info className="h-4 w-4 text-primary" />
          <h4 className="text-sm font-medium">Expected Response Format</h4>
        </div>
        <pre className="text-xs overflow-x-auto bg-background p-2 rounded border font-mono">
          {getExpectedResponseFormat(form.operation)}
        </pre>
      </div>

      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit">{isEditing ? "Save Changes" : "Create Prompt"}</Button>
      </div>
    </form>
  );
}
