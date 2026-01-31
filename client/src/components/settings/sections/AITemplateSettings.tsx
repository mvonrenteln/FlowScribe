/**
 * AI Prompt Settings
 *
 * Unified configuration UI for all AI prompts.
 * Supports both Speaker Classification prompts (type: 'speaker') and
 * Text Revision prompts (type: 'text').
 */

import {
  AlertCircle,
  BookOpen,
  Check,
  ChevronDown,
  ChevronUp,
  Copy,
  Download,
  FileText,
  GitMerge,
  MessageSquare,
  Plus,
  Sparkles,
  Trash2,
  Upload,
} from "lucide-react";
import { useCallback, useRef, useState } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import {
  CHAPTER_DETECTION_SYSTEM_PROMPT as DEFAULT_CHAPTER_DETECTION_SYSTEM_PROMPT,
  CHAPTER_DETECTION_USER_PROMPT_TEMPLATE as DEFAULT_CHAPTER_DETECTION_USER_PROMPT_TEMPLATE,
} from "@/lib/ai/features/chapterDetection";
import {
  SPEAKER_SYSTEM_PROMPT as DEFAULT_SYSTEM_PROMPT,
  SPEAKER_USER_PROMPT_TEMPLATE as DEFAULT_USER_PROMPT_TEMPLATE,
} from "@/lib/ai/features/speaker";
import { useTranscriptStore } from "@/lib/store";
import type { AIPrompt, PromptType } from "@/lib/store/types";
import { buildPromptExportData } from "@/lib/store/utils/aiPromptExport";
import { cn } from "@/lib/utils";

// ==================== Constants ====================

const DEFAULT_TEXT_SYSTEM_PROMPT = `You are an expert text editor. Your task is to improve the given transcript text.

Rules:
- Fix spelling and grammar errors
- Remove filler words (um, uh, like, you know)
- Improve clarity while preserving meaning
- Keep the same tone and style
- Return ONLY the revised text, no explanations`;

const DEFAULT_TEXT_USER_PROMPT = `Please revise the following text:

{{text}}`;

const DEFAULT_SEGMENT_MERGE_SYSTEM_PROMPT = `You analyze transcript segments to identify which ones should be merged together.

Your task is to evaluate the CONTENT and determine if merging makes semantic sense.`;

const DEFAULT_SEGMENT_MERGE_USER_PROMPT = `Analyze these pre-filtered transcript segment pairs for potential merges.

CONTEXT:
- Maximum time gap allowed: {{maxTimeGap}} seconds
- Text smoothing: {{enableSmoothing}}

SEGMENT PAIRS TO ANALYZE:
{{segmentPairs}}

Return merge suggestions as a JSON array.`;

const PLACEHOLDER_HELP = {
  speaker: [
    { placeholder: "{{speakers}}", description: "List of known speaker names" },
    { placeholder: "{{segments}}", description: "Transcript segments with speaker labels" },
  ],
  text: [
    { placeholder: "{{text}}", description: "The segment text to revise" },
    { placeholder: "{{speaker}}", description: "Name of the speaker" },
    { placeholder: "{{previousText}}", description: "Previous segment text (optional)" },
    { placeholder: "{{nextText}}", description: "Next segment text (optional)" },
  ],
  "segment-merge": [
    { placeholder: "{{segmentPairs}}", description: "Pre-filtered segment pairs to analyze" },
    { placeholder: "{{segments}}", description: "All segments for context" },
    { placeholder: "{{maxTimeGap}}", description: "Maximum time gap in seconds" },
    { placeholder: "{{enableSmoothing}}", description: "Whether smoothing is enabled" },
  ],
  "chapter-detect": [
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
} as const;

// ==================== Prompt Form ====================

interface PromptFormData {
  name: string;
  type: PromptType;
  systemPrompt: string;
  userPromptTemplate: string;
  quickAccess: boolean;
}

const getEmptyForm = (type: PromptType): PromptFormData => ({
  name: "",
  type,
  systemPrompt:
    type === "speaker"
      ? DEFAULT_SYSTEM_PROMPT
      : type === "text"
        ? DEFAULT_TEXT_SYSTEM_PROMPT
        : type === "segment-merge"
          ? DEFAULT_SEGMENT_MERGE_SYSTEM_PROMPT
          : DEFAULT_CHAPTER_DETECTION_SYSTEM_PROMPT,
  userPromptTemplate:
    type === "speaker"
      ? DEFAULT_USER_PROMPT_TEMPLATE
      : type === "text"
        ? DEFAULT_TEXT_USER_PROMPT
        : type === "segment-merge"
          ? DEFAULT_SEGMENT_MERGE_USER_PROMPT
          : DEFAULT_CHAPTER_DETECTION_USER_PROMPT_TEMPLATE,
  quickAccess: false,
});

interface PromptFormProps {
  initialData?: Partial<PromptFormData>;
  onSave: (data: PromptFormData) => void;
  onCancel: () => void;
  isEditing?: boolean;
  promptType: PromptType;
  isBuiltIn?: boolean;
}

function PromptForm({
  initialData,
  onSave,
  onCancel,
  isEditing,
  promptType,
  isBuiltIn,
}: PromptFormProps) {
  const [form, setForm] = useState<PromptFormData>({
    ...getEmptyForm(promptType),
    ...initialData,
  });
  const [errors, setErrors] = useState<string[]>([]);

  const placeholders = PLACEHOLDER_HELP[promptType];

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
    onSave({ ...form, type: promptType });
  };

  const handleReset = () => {
    const defaults = getEmptyForm(promptType);
    setForm((prev) => ({
      ...prev,
      systemPrompt: defaults.systemPrompt,
      userPromptTemplate: defaults.userPromptTemplate,
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
          placeholder={
            promptType === "speaker" ? "e.g., RPG Session Classifier" : "e.g., Grammar Fix"
          }
          data-testid="input-prompt-name"
        />
      </div>

      {promptType === "text" && (
        <div className="flex items-center gap-2">
          <Checkbox
            id="quick-access"
            checked={form.quickAccess}
            onCheckedChange={(checked) => setForm((prev) => ({ ...prev, quickAccess: !!checked }))}
          />
          <div>
            <Label htmlFor="quick-access" className="text-sm">
              Show in Quick Access menu
            </Label>
            <p className="text-xs text-muted-foreground">
              Appears in the segment action menu for one-tap AI revisions.
            </p>
          </div>
        </div>
      )}

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label htmlFor="prompt-system">System Prompt</Label>
          {isBuiltIn && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleReset}
              className="text-xs"
            >
              Reset to Default
            </Button>
          )}
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

      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit">{isEditing ? "Save Changes" : "Create Prompt"}</Button>
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
  onToggleQuickAccess?: () => void;
}

function PromptCard({
  promptItem,
  isActive,
  onEdit,
  onDelete,
  onSetActive,
  onDuplicate,
  onToggleQuickAccess,
}: PromptCardProps) {
  const [expanded, setExpanded] = useState(false);
  const typeLabel = promptItem.type === "speaker" ? "Speaker Classification" : "Text Revision";
  const TypeIcon = promptItem.type === "speaker" ? MessageSquare : Sparkles;

  return (
    <Card className={cn(isActive && "ring-2 ring-primary")}>
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2">
            <TypeIcon className="h-5 w-5 text-muted-foreground" aria-label={typeLabel} />
            <div>
              <CardTitle className="text-base flex items-center gap-2" title={typeLabel}>
                {promptItem.name}
                {isActive && (
                  <Badge variant="secondary" className="text-xs">
                    Default
                  </Badge>
                )}
                {promptItem.quickAccess && (
                  <Badge variant="secondary" className="text-xs">
                    Quick Access
                  </Badge>
                )}
                {promptItem.isBuiltIn && (
                  <Badge variant="outline" className="text-xs">
                    Built-in
                  </Badge>
                )}
              </CardTitle>
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
                Set as Default
              </Button>
            )}
            <Button variant="outline" size="sm" onClick={onEdit}>
              Edit
            </Button>
            {promptItem.type === "text" && (
              <Button variant="outline" size="sm" onClick={onToggleQuickAccess}>
                {promptItem.quickAccess ? "Remove from Quick Access" : "Add to Quick Access"}
              </Button>
            )}
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
  const [activeTab, setActiveTab] = useState<PromptType>("speaker");

  // Speaker prompts
  const speakerPrompts = useTranscriptStore((s) => s.aiSpeakerConfig.prompts);
  const activeSpeakerPromptId = useTranscriptStore((s) => s.aiSpeakerConfig.activePromptId);
  const addSpeakerPrompt = useTranscriptStore((s) => s.addPrompt);
  const updateSpeakerPrompt = useTranscriptStore((s) => s.updatePrompt);
  const deleteSpeakerPrompt = useTranscriptStore((s) => s.deletePrompt);
  const setActiveSpeakerPrompt = useTranscriptStore((s) => s.setActivePrompt);

  // Text revision prompts
  const textPrompts = useTranscriptStore((s) => s.aiRevisionConfig.prompts);
  const activeTextPromptId = useTranscriptStore((s) => s.aiRevisionConfig.defaultPromptId);
  const quickAccessIds = useTranscriptStore((s) => s.aiRevisionConfig.quickAccessPromptIds);
  const addTextPrompt = useTranscriptStore((s) => s.addRevisionPrompt);
  const updateTextPrompt = useTranscriptStore((s) => s.updateRevisionPrompt);
  const deleteTextPrompt = useTranscriptStore((s) => s.deleteRevisionPrompt);
  const setActiveTextPrompt = useTranscriptStore((s) => s.setDefaultRevisionPrompt);
  const toggleQuickAccess = useTranscriptStore((s) => s.toggleQuickAccessPrompt);

  // Segment merge prompts
  const segmentMergePrompts = useTranscriptStore((s) => s.aiSegmentMergeConfig.prompts);
  const activeSegmentMergePromptId = useTranscriptStore(
    (s) => s.aiSegmentMergeConfig.activePromptId,
  );
  const addSegmentMergePrompt = useTranscriptStore((s) => s.addSegmentMergePrompt);
  const updateSegmentMergePrompt = useTranscriptStore((s) => s.updateSegmentMergePrompt);
  const deleteSegmentMergePrompt = useTranscriptStore((s) => s.deleteSegmentMergePrompt);
  const setActiveSegmentMergePrompt = useTranscriptStore((s) => s.setActiveSegmentMergePrompt);

  // Chapter detection prompts
  const chapterDetectionPrompts = useTranscriptStore((s) => s.aiChapterDetectionConfig.prompts);
  const activeChapterDetectionPromptId = useTranscriptStore(
    (s) => s.aiChapterDetectionConfig.activePromptId,
  );
  const addChapterDetectionPrompt = useTranscriptStore((s) => s.addChapterDetectionPrompt);
  const updateChapterDetectionPrompt = useTranscriptStore((s) => s.updateChapterDetectionPrompt);
  const deleteChapterDetectionPrompt = useTranscriptStore((s) => s.deleteChapterDetectionPrompt);
  const setActiveChapterDetectionPrompt = useTranscriptStore(
    (s) => s.setActiveChapterDetectionPrompt,
  );

  const [showAddForm, setShowAddForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const importInputRef = useRef<HTMLInputElement>(null);

  // Get prompts for current tab
  const prompts =
    activeTab === "speaker"
      ? speakerPrompts
      : activeTab === "text"
        ? textPrompts
        : activeTab === "segment-merge"
          ? segmentMergePrompts
          : chapterDetectionPrompts;
  const activePromptId =
    activeTab === "speaker"
      ? activeSpeakerPromptId
      : activeTab === "text"
        ? activeTextPromptId
        : activeTab === "segment-merge"
          ? activeSegmentMergePromptId
          : activeChapterDetectionPromptId;

  const handleAddPrompt = useCallback(
    (data: PromptFormData) => {
      const promptData = {
        name: data.name,
        type: data.type,
        systemPrompt: data.systemPrompt,
        userPromptTemplate: data.userPromptTemplate,
        isBuiltIn: false,
        quickAccess: data.quickAccess,
      };

      if (data.type === "speaker") {
        addSpeakerPrompt(promptData);
      } else if (data.type === "text") {
        addTextPrompt(promptData);
      } else if (data.type === "segment-merge") {
        addSegmentMergePrompt(promptData);
      } else {
        addChapterDetectionPrompt(promptData);
      }
      setShowAddForm(false);
    },
    [addSpeakerPrompt, addTextPrompt, addSegmentMergePrompt, addChapterDetectionPrompt],
  );

  const handleEditPrompt = useCallback(
    (id: string, data: PromptFormData) => {
      const updates = {
        name: data.name,
        systemPrompt: data.systemPrompt,
        userPromptTemplate: data.userPromptTemplate,
        quickAccess: data.quickAccess,
      };

      if (activeTab === "speaker") {
        updateSpeakerPrompt(id, updates);
      } else if (activeTab === "text") {
        updateTextPrompt(id, updates);
      } else if (activeTab === "segment-merge") {
        updateSegmentMergePrompt(id, updates);
      } else {
        updateChapterDetectionPrompt(id, updates);
      }
      setEditingId(null);
    },
    [
      activeTab,
      updateSpeakerPrompt,
      updateTextPrompt,
      updateSegmentMergePrompt,
      updateChapterDetectionPrompt,
    ],
  );

  const handleDeletePrompt = useCallback(
    (id: string) => {
      if (activeTab === "speaker") {
        deleteSpeakerPrompt(id);
      } else if (activeTab === "text") {
        deleteTextPrompt(id);
      } else if (activeTab === "segment-merge") {
        deleteSegmentMergePrompt(id);
      } else {
        deleteChapterDetectionPrompt(id);
      }
    },
    [
      activeTab,
      deleteSpeakerPrompt,
      deleteTextPrompt,
      deleteSegmentMergePrompt,
      deleteChapterDetectionPrompt,
    ],
  );

  const handleSetActivePrompt = useCallback(
    (id: string) => {
      if (activeTab === "speaker") {
        setActiveSpeakerPrompt(id);
      } else if (activeTab === "text") {
        setActiveTextPrompt(id);
      } else if (activeTab === "segment-merge") {
        setActiveSegmentMergePrompt(id);
      } else {
        setActiveChapterDetectionPrompt(id);
      }
    },
    [
      activeTab,
      setActiveSpeakerPrompt,
      setActiveTextPrompt,
      setActiveSegmentMergePrompt,
      setActiveChapterDetectionPrompt,
    ],
  );

  const handleDuplicate = useCallback(
    (promptItem: AIPrompt) => {
      const promptData = {
        name: `${promptItem.name} (Copy)`,
        type: promptItem.type,
        systemPrompt: promptItem.systemPrompt,
        userPromptTemplate: promptItem.userPromptTemplate,
        isBuiltIn: false,
        quickAccess: false,
      };

      if (promptItem.type === "speaker") {
        addSpeakerPrompt(promptData);
      } else if (promptItem.type === "text") {
        addTextPrompt(promptData);
      } else if (promptItem.type === "segment-merge") {
        addSegmentMergePrompt(promptData);
      } else {
        addChapterDetectionPrompt(promptData);
      }
    },
    [addSpeakerPrompt, addTextPrompt, addSegmentMergePrompt, addChapterDetectionPrompt],
  );

  const handleToggleQuickAccess = useCallback(
    (id: string) => {
      if (activeTab === "text") {
        toggleQuickAccess(id);
      }
    },
    [activeTab, toggleQuickAccess],
  );

  const handleExport = useCallback(() => {
    const allPrompts = [
      ...speakerPrompts,
      ...textPrompts,
      ...segmentMergePrompts,
      ...chapterDetectionPrompts,
    ];
    const exportData = buildPromptExportData(allPrompts);

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
  }, [speakerPrompts, textPrompts, segmentMergePrompts, chapterDetectionPrompts]);

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
                const promptData = {
                  name: item.name,
                  type: item.type || activeTab,
                  systemPrompt: item.systemPrompt,
                  userPromptTemplate: item.userPromptTemplate,
                  isBuiltIn: false,
                  quickAccess: item.quickAccess || false,
                };

                if (promptData.type === "speaker") {
                  addSpeakerPrompt(promptData);
                } else if (promptData.type === "text") {
                  addTextPrompt(promptData);
                } else if (promptData.type === "segment-merge") {
                  addSegmentMergePrompt(promptData);
                } else if (promptData.type === "chapter-detect") {
                  addChapterDetectionPrompt(promptData);
                }
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
    [activeTab, addSpeakerPrompt, addTextPrompt, addSegmentMergePrompt, addChapterDetectionPrompt],
  );

  // Calculate quick access status for text prompts
  const isQuickAccess = (id: string) => quickAccessIds.includes(id);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">AI Prompts</h2>
        <p className="text-sm text-muted-foreground">
          Manage prompts for AI-powered features like speaker classification and text revision.
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

      {/* Tabs for prompt types */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as PromptType)}>
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="speaker" className="flex items-center gap-2">
            <MessageSquare className="h-4 w-4" />
            Speaker Classification
          </TabsTrigger>
          <TabsTrigger value="text" className="flex items-center gap-2">
            <Sparkles className="h-4 w-4" />
            Text Revision
          </TabsTrigger>
          <TabsTrigger value="segment-merge" className="flex items-center gap-2">
            <GitMerge className="h-4 w-4" />
            Segment Merge
          </TabsTrigger>
          <TabsTrigger value="chapter-detect" className="flex items-center gap-2">
            <BookOpen className="h-4 w-4" />
            Chapters
          </TabsTrigger>
        </TabsList>

        <TabsContent value="speaker" className="space-y-4 mt-4">
          <p className="text-sm text-muted-foreground">
            Prompts for automatically classifying speakers in your transcript.
          </p>
        </TabsContent>

        <TabsContent value="text" className="space-y-4 mt-4">
          <p className="text-sm text-muted-foreground">
            Prompts for revising and improving transcript text. Quick Access prompts appear in the
            segment menu.
          </p>
          <Alert className="border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950">
            <AlertCircle className="h-4 w-4 text-blue-500 dark:text-blue-400" />
            <AlertDescription className="text-xs text-blue-800 dark:text-blue-200">
              <strong>Tip:</strong> Smaller models often follow the prompt language instead of the
              input text language. If you work with non-English transcripts, consider translating
              the prompts to your language to avoid unwanted translations.
            </AlertDescription>
          </Alert>
        </TabsContent>

        <TabsContent value="segment-merge" className="space-y-4 mt-4">
          <p className="text-sm text-muted-foreground">
            Prompts for analyzing segments and suggesting which ones should be merged together.
          </p>
        </TabsContent>

        <TabsContent value="chapter-detect" className="space-y-4 mt-4">
          <p className="text-sm text-muted-foreground">
            Prompts for detecting chapter boundaries and suggesting chapter titles and summaries.
          </p>
        </TabsContent>
      </Tabs>

      {/* Prompt List */}
      <div className="space-y-3">
        {prompts.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center text-muted-foreground">
              <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No prompts configured for this feature.</p>
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
                      type: promptItem.type,
                      systemPrompt: promptItem.systemPrompt,
                      userPromptTemplate: promptItem.userPromptTemplate,
                      quickAccess: activeTab === "text" ? isQuickAccess(promptItem.id) : false,
                    }}
                    onSave={(data) => handleEditPrompt(promptItem.id, data)}
                    onCancel={() => setEditingId(null)}
                    isEditing
                    promptType={activeTab}
                    isBuiltIn={promptItem.isBuiltIn}
                  />
                </CardContent>
              </Card>
            ) : (
              <PromptCard
                key={promptItem.id}
                promptItem={{
                  ...promptItem,
                  quickAccess: activeTab === "text" ? isQuickAccess(promptItem.id) : false,
                }}
                isActive={promptItem.id === activePromptId}
                onEdit={() => setEditingId(promptItem.id)}
                onDelete={() => handleDeletePrompt(promptItem.id)}
                onSetActive={() => handleSetActivePrompt(promptItem.id)}
                onDuplicate={() => handleDuplicate(promptItem)}
                onToggleQuickAccess={
                  activeTab === "text" ? () => handleToggleQuickAccess(promptItem.id) : undefined
                }
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
            <PromptForm
              onSave={handleAddPrompt}
              onCancel={() => setShowAddForm(false)}
              promptType={activeTab}
              isBuiltIn={false}
            />
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
