/**
 * AI Speaker Dialog
 *
 * Main dialog for running AI-powered speaker classification.
 * Features: AI provider selection, prompt templates, speaker filters, progress
 * tracking, and suggestions list with accept/reject controls.
 *
 * AI Provider and Template configuration is managed in Settings.
 */

import {
  AlertCircle,
  Check,
  Download,
  Pause,
  Play,
  Plus,
  Settings2,
  Sparkles,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { type AISpeakerSuggestion, type PromptTemplate, useTranscriptStore } from "@/lib/store";
import type { PromptTemplateExport } from "@/lib/store/types";
import { initializeSettings, type PersistedSettings } from "@/lib/settings/settingsStorage";
import { cn } from "@/lib/utils";

interface AISpeakerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AISpeakerDialog({ open, onOpenChange }: AISpeakerDialogProps) {
  // Store state - use individual selectors to avoid object creation on every render
  const speakers = useTranscriptStore((s) => s.speakers);
  const segments = useTranscriptStore((s) => s.segments);

  // AI Speaker state - individual selectors
  const suggestions = useTranscriptStore((s) => s.aiSpeakerSuggestions);
  const isProcessing = useTranscriptStore((s) => s.aiSpeakerIsProcessing);
  const processedCount = useTranscriptStore((s) => s.aiSpeakerProcessedCount);
  const totalToProcess = useTranscriptStore((s) => s.aiSpeakerTotalToProcess);
  const config = useTranscriptStore((s) => s.aiSpeakerConfig);
  const error = useTranscriptStore((s) => s.aiSpeakerError);
  const batchInsights = useTranscriptStore((s) => s.aiSpeakerBatchInsights);
  const discrepancyNotice = useTranscriptStore((s) => s.aiSpeakerDiscrepancyNotice);
  const batchLog = useTranscriptStore((s) => s.aiSpeakerBatchLog);
  const setDiscrepancyNotice = useTranscriptStore((s) => s.setDiscrepancyNotice);
  const [isLogOpen, setIsLogOpen] = useState(false);

  // AI Speaker actions
  const startAnalysis = useTranscriptStore((s) => s.startAnalysis);
  const cancelAnalysis = useTranscriptStore((s) => s.cancelAnalysis);
  const acceptSuggestion = useTranscriptStore((s) => s.acceptSuggestion);
  const rejectSuggestion = useTranscriptStore((s) => s.rejectSuggestion);
  const clearSuggestions = useTranscriptStore((s) => s.clearSuggestions);
  const updateConfig = useTranscriptStore((s) => s.updateConfig);
  const addTemplate = useTranscriptStore((s) => s.addTemplate);
  const updateTemplate = useTranscriptStore((s) => s.updateTemplate);
  const deleteTemplate = useTranscriptStore((s) => s.deleteTemplate);
  const setActiveTemplate = useTranscriptStore((s) => s.setActiveTemplate);

  // Local state
  const [selectedSpeakers, setSelectedSpeakers] = useState<string[]>([]);
  const [excludeConfirmed, setExcludeConfirmed] = useState(true);
  const [editingTemplate, setEditingTemplate] = useState<PromptTemplate | null>(null);
  const [newTemplateName, setNewTemplateName] = useState("");
  const [newSystemPrompt, setNewSystemPrompt] = useState("");
  const [newUserPrompt, setNewUserPrompt] = useState("");
  const [batchSize, setBatchSize] = useState(config.batchSize.toString());
  const [settings, setSettings] = useState<PersistedSettings | null>(null);
  const [selectedProviderId, setSelectedProviderId] = useState<string>(
    config.selectedProviderId ?? "",
  );
  const importInputRef = useRef<HTMLInputElement | null>(null);

  // Load settings on mount
  useEffect(() => {
    const loadedSettings = initializeSettings();
    setSettings(loadedSettings);
    // Set initial provider from config or default
    if (!selectedProviderId && loadedSettings.defaultAIProviderId) {
      setSelectedProviderId(loadedSettings.defaultAIProviderId);
    }
  }, [selectedProviderId]);

  // Get selected provider info
  const selectedProvider = settings?.aiProviders.find((p) => p.id === selectedProviderId);

  const pendingSuggestions = suggestions.filter((s) => s.status === "pending");
  const progressPercent =
    totalToProcess > 0 ? Math.round((processedCount / totalToProcess) * 100) : 0;

  // Handlers
  const handleStartAnalysis = () => {
    // Save config changes
    updateConfig({
      batchSize: Number.parseInt(batchSize, 10) || 10,
      selectedProviderId: selectedProviderId || undefined,
    });
    startAnalysis(selectedSpeakers, excludeConfirmed);
  };

  const handleSpeakerToggle = (speakerName: string) => {
    setSelectedSpeakers((prev) =>
      prev.includes(speakerName) ? prev.filter((s) => s !== speakerName) : [...prev, speakerName],
    );
  };

  const handleSelectAllSpeakers = () => {
    if (selectedSpeakers.length === speakers.length) {
      setSelectedSpeakers([]);
    } else {
      setSelectedSpeakers(speakers.map((s) => s.name));
    }
  };

  const handleEditTemplate = (template: PromptTemplate) => {
    setEditingTemplate(template);
    setNewTemplateName(template.name);
    setNewSystemPrompt(template.systemPrompt);
    setNewUserPrompt(template.userPromptTemplate);
  };

  const handleSaveTemplate = () => {
    if (editingTemplate) {
      if (editingTemplate.id === "new") {
        addTemplate({
          name: newTemplateName,
          systemPrompt: newSystemPrompt,
          userPromptTemplate: newUserPrompt,
        });
      } else {
        updateTemplate(editingTemplate.id, {
          name: newTemplateName,
          systemPrompt: newSystemPrompt,
          userPromptTemplate: newUserPrompt,
        });
      }
    }
    setEditingTemplate(null);
    setNewTemplateName("");
    setNewSystemPrompt("");
    setNewUserPrompt("");
  };

  const handleCancelEdit = () => {
    setEditingTemplate(null);
    setNewTemplateName("");
    setNewSystemPrompt("");
    setNewUserPrompt("");
  };

  const handleExportTemplates = () => {
    const exportData: PromptTemplateExport = {
      version: 1,
      templates: config.templates
        .filter((t) => !t.isDefault)
        .map(({ name, systemPrompt, userPromptTemplate }) => ({
          name,
          systemPrompt,
          userPromptTemplate,
        })),
    };
    const blob = new Blob([JSON.stringify(exportData, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "ai-speaker-templates.json";
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(url);
  };

  const handleImportTemplates = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(String(reader.result)) as PromptTemplateExport;
        if (data.version === 1 && Array.isArray(data.templates)) {
          for (const template of data.templates) {
            addTemplate({
              name: template.name,
              systemPrompt: template.systemPrompt,
              userPromptTemplate: template.userPromptTemplate,
            });
          }
        }
      } catch (err) {
        console.error("Failed to import templates:", err);
      }
    };
    reader.readAsText(file);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5" />
            AI Speaker Classification (Experimental)
          </DialogTitle>
          <DialogDescription>
            Use AI to suggest correct speaker assignments for transcript segments.
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="analyze" className="flex-1 min-h-0 flex flex-col">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="analyze">Analyze</TabsTrigger>
            <TabsTrigger value="templates">Templates</TabsTrigger>
          </TabsList>

          {/* Analyze Tab */}
          <TabsContent value="analyze" className="flex-1 min-h-0 flex flex-col space-y-4">
            {/* Speaker Filter */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-medium">Filter Speakers</Label>
                <Button variant="ghost" size="sm" onClick={handleSelectAllSpeakers}>
                  {selectedSpeakers.length === speakers.length ? "Deselect All" : "Select All"}
                </Button>
              </div>
              <div className="flex flex-wrap gap-2">
                {speakers.map((speaker) => {
                  const checkboxId = `speaker-${speaker.id}`;
                  return (
                    <div
                      key={speaker.id}
                      className={cn(
                        "flex items-center gap-2 px-3 py-1.5 rounded-md border cursor-pointer transition-colors",
                        selectedSpeakers.includes(speaker.name)
                          ? "bg-primary/10 border-primary"
                          : "hover:bg-accent",
                      )}
                    >
                      <Checkbox
                        id={checkboxId}
                        checked={selectedSpeakers.includes(speaker.name)}
                        onCheckedChange={() => handleSpeakerToggle(speaker.name)}
                      />
                      <label
                        htmlFor={checkboxId}
                        className="flex items-center gap-2 cursor-pointer"
                      >
                        <span
                          className="w-3 h-3 rounded-full"
                          style={{ backgroundColor: speaker.color }}
                        />
                        <span className="text-sm">{speaker.name}</span>
                      </label>
                    </div>
                  );
                })}
              </div>
              {selectedSpeakers.length === 0 && (
                <p className="text-xs text-muted-foreground">
                  All speakers will be analyzed (no filter applied)
                </p>
              )}
            </div>

            {/* Options */}
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <Checkbox
                  id="exclude-confirmed"
                  checked={excludeConfirmed}
                  onCheckedChange={(checked) => setExcludeConfirmed(Boolean(checked))}
                />
                <Label htmlFor="exclude-confirmed" className="text-sm cursor-pointer">
                  Exclude confirmed segments
                </Label>
              </div>
            </div>

            {/* AI Provider & Batch Size Selection */}
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2 flex-1">
                <Label className="text-sm whitespace-nowrap">AI Provider:</Label>
                <Select value={selectedProviderId} onValueChange={setSelectedProviderId}>
                  <SelectTrigger className="flex-1">
                    <SelectValue placeholder="Select AI provider..." />
                  </SelectTrigger>
                  <SelectContent>
                    {settings?.aiProviders.map((provider) => (
                      <SelectItem key={provider.id} value={provider.id}>
                        {provider.name} ({provider.model})
                        {provider.isDefault && " ⭐"}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => {
                          // Open settings - this would require a way to open settings
                          // For now, just show a hint
                        }}
                      >
                        <Settings2 className="h-4 w-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Configure AI providers in Settings</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
              <div className="flex items-center gap-2">
                <Label htmlFor="batch-size" className="text-sm whitespace-nowrap">
                  Batch:
                </Label>
                <Input
                  id="batch-size"
                  type="number"
                  min={1}
                  max={50}
                  value={batchSize}
                  onChange={(e) => setBatchSize(e.target.value)}
                  className="w-16"
                />
              </div>
            </div>

            {!selectedProviderId && settings?.aiProviders.length === 0 && (
              <div className="flex items-center gap-2 p-2 rounded-md bg-amber-100 text-amber-900 text-sm dark:bg-amber-900/20 dark:text-amber-200">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>No AI provider configured. Add one in Settings → AI → Server & Models.</span>
              </div>
            )}

            {/* Template Selection */}
            <div className="flex items-center gap-2">
              <Label className="text-sm whitespace-nowrap">Prompt Template:</Label>
              <Select
                value={config.activeTemplateId}
                onValueChange={(value) => setActiveTemplate(value)}
              >
                <SelectTrigger className="flex-1">
                  <SelectValue placeholder="Select template" />
                </SelectTrigger>
                <SelectContent>
                  {config.templates.map((template) => (
                    <SelectItem key={template.id} value={template.id}>
                      {template.name}
                      {template.isDefault && " (Default)"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Progress & Control */}
            <div className="space-y-2">
              {isProcessing && (
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-sm">
                    <span>Processing...</span>
                    <span>
                      {processedCount} / {totalToProcess} segments
                    </span>
                  </div>
                  <Progress value={progressPercent} className="h-2" />
                </div>
              )}

              {error && (
                <div className="flex items-center gap-2 p-2 rounded-md bg-destructive/10 text-destructive text-sm">
                  <AlertCircle className="h-4 w-4" />
                  {error}
                </div>
              )}

              {discrepancyNotice && processedCount === totalToProcess && (
                <div className="flex items-center gap-2 p-2 rounded-md bg-amber-100 text-amber-900 text-sm">
                  <AlertCircle className="h-4 w-4" />
                  <div className="flex-1">
                    {discrepancyNotice.replace(/See batch log\.?/i, "").trim()}
                  </div>
                  <Button variant="outline" size="sm" onClick={() => setIsLogOpen(true)}>
                    See batch log
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => setDiscrepancyNotice(null)}>
                    Got it
                  </Button>
                </div>
              )}

              <div className="flex items-center gap-2">
                {isProcessing ? (
                  <Button onClick={cancelAnalysis} variant="destructive">
                    <Pause className="h-4 w-4 mr-2" />
                    Stop Analysis
                  </Button>
                ) : (
                  <Button onClick={handleStartAnalysis} disabled={segments.length === 0}>
                    <Play className="h-4 w-4 mr-2" />
                    Start Analysis
                  </Button>
                )}
                {pendingSuggestions.length > 0 && (
                  <Button variant="outline" onClick={clearSuggestions}>
                    <Trash2 className="h-4 w-4 mr-2" />
                    Clear Suggestions
                  </Button>
                )}
              </div>
            </div>

            {/* Suggestions List */}
            {pendingSuggestions.length > 0 && (
              <div className="flex-1 min-h-0 flex flex-col space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-medium">
                    Suggestions ({pendingSuggestions.length} pending)
                  </Label>
                  {batchInsights.length > 0 && (
                    <div className="flex items-center gap-3 text-xs text-muted-foreground w-full">
                      <span>
                        {batchInsights.length} runs, last update at{" "}
                        {new Date(
                          batchInsights[batchInsights.length - 1].loggedAt,
                        ).toLocaleTimeString()}
                      </span>

                      <div className="ml-auto">
                        <div className="mr-4 text-xs text-muted-foreground">
                          Total elapsed:{" "}
                          {batchLog.length > 0
                            ? `${((batchLog[batchLog.length - 1].elapsedMs ?? 0) / 1000).toFixed(2)}s`
                            : "-"}
                        </div>
                        <Drawer open={isLogOpen} onOpenChange={setIsLogOpen}>
                          <DrawerTrigger asChild>
                            <Button variant="ghost" size="sm">
                              Batch Log ({batchLog.length})
                            </Button>
                          </DrawerTrigger>
                          <DrawerContent className="max-h-[70vh]">
                            <DrawerHeader>
                              <DrawerTitle>Batch Log</DrawerTitle>
                            </DrawerHeader>
                            <div className="px-6 pb-6 overflow-auto">
                              <Table>
                                <TableHeader>
                                  <TableRow>
                                    <TableHead>Batch</TableHead>
                                    <TableHead>Expected</TableHead>
                                    <TableHead>Returned</TableHead>
                                    <TableHead>Duration</TableHead>
                                    <TableHead>Used</TableHead>
                                    <TableHead>Ignored</TableHead>
                                    <TableHead>Suggestions</TableHead>
                                    <TableHead>Unchanged</TableHead>
                                    <TableHead>Processed</TableHead>
                                    <TableHead>Issues</TableHead>
                                    <TableHead>Time</TableHead>
                                  </TableRow>
                                </TableHeader>
                                <TableBody>
                                  {batchLog.map((entry, idx) => {
                                    const returned = entry.rawItemCount;
                                    const expected = entry.batchSize;
                                    const ignored =
                                      entry.ignoredCount ?? Math.max(0, returned - expected);
                                    const used = Math.min(returned, expected);
                                    const issueSummary =
                                      entry.issues && entry.issues.length > 0
                                        ? entry.issues[0].message
                                        : "—";
                                    return (
                                      <TableRow
                                        key={`${entry.batchIndex}-${entry.loggedAt}-${idx}`}
                                      >
                                        <TableCell>{entry.batchIndex + 1}</TableCell>
                                        <TableCell>{expected}</TableCell>
                                        <TableCell>
                                          <span
                                            className={returned !== expected ? "text-red-600" : ""}
                                          >
                                            {returned}
                                            {ignored > 0 && (
                                              <span className="ml-2 text-[11px] text-muted-foreground">
                                                (+{ignored})
                                              </span>
                                            )}
                                          </span>
                                        </TableCell>
                                        <TableCell>
                                          {entry.batchDurationMs
                                            ? `${(entry.batchDurationMs / 1000).toFixed(2)}s`
                                            : "-"}
                                        </TableCell>
                                        <TableCell>{used}</TableCell>
                                        <TableCell>{ignored}</TableCell>
                                        <TableCell>{entry.suggestionCount}</TableCell>
                                        <TableCell>{entry.unchangedAssignments}</TableCell>
                                        <TableCell>
                                          {entry.processedTotal}/{entry.totalExpected}
                                        </TableCell>
                                        <TableCell>
                                          {entry.fatal ? "FATAL" : issueSummary}
                                        </TableCell>
                                        <TableCell>
                                          {new Date(entry.loggedAt).toLocaleTimeString()}
                                        </TableCell>
                                      </TableRow>
                                    );
                                  })}
                                </TableBody>
                              </Table>
                            </div>
                          </DrawerContent>
                        </Drawer>
                      </div>
                    </div>
                  )}
                </div>
                <div className="flex-1 min-h-[300px] rounded-md border overflow-y-auto">
                  <div className="p-2 space-y-2">
                    {pendingSuggestions.map((suggestion) => (
                      <SuggestionCard
                        key={suggestion.segmentId}
                        suggestion={suggestion}
                        segments={segments}
                        onAccept={() => acceptSuggestion(suggestion.segmentId)}
                        onReject={() => rejectSuggestion(suggestion.segmentId)}
                      />
                    ))}
                  </div>
                </div>
              </div>
            )}
          </TabsContent>

          {/* Templates Tab */}
          <TabsContent value="templates" className="flex-1 min-h-0 flex flex-col space-y-4">
            {editingTemplate ? (
              <div className="space-y-3">
                <Input
                  value={newTemplateName}
                  onChange={(e) => setNewTemplateName(e.target.value)}
                  placeholder="Template name"
                />
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">System Prompt</Label>
                  <Textarea
                    value={newSystemPrompt}
                    onChange={(e) => setNewSystemPrompt(e.target.value)}
                    className="h-48 font-mono text-xs"
                    placeholder="System instructions for the AI..."
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">
                    User Prompt Template (use {"{{speakers}}"} and {"{{segments}}"})
                  </Label>
                  <Textarea
                    value={newUserPrompt}
                    onChange={(e) => setNewUserPrompt(e.target.value)}
                    className="h-32 font-mono text-xs"
                    placeholder="User prompt with placeholders..."
                  />
                </div>
                <div className="flex gap-2">
                  <Button onClick={handleSaveTemplate} disabled={!newTemplateName.trim()}>
                    <Check className="h-4 w-4 mr-2" />
                    Save
                  </Button>
                  <Button variant="ghost" onClick={handleCancelEdit}>
                    Cancel
                  </Button>
                </div>
              </div>
            ) : (
              <>
                <div className="flex items-center gap-2">
                  <Button
                    onClick={() =>
                      handleEditTemplate({
                        id: "new",
                        name: "",
                        systemPrompt: "",
                        userPromptTemplate: "",
                      })
                    }
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    New Template
                  </Button>
                  <input
                    ref={importInputRef}
                    type="file"
                    accept=".json"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleImportTemplates(file);
                      e.target.value = "";
                    }}
                  />
                  <Button variant="outline" onClick={() => importInputRef.current?.click()}>
                    <Upload className="h-4 w-4 mr-2" />
                    Import
                  </Button>
                  <Button
                    variant="outline"
                    onClick={handleExportTemplates}
                    disabled={config.templates.filter((t) => !t.isDefault).length === 0}
                  >
                    <Download className="h-4 w-4 mr-2" />
                    Export
                  </Button>
                </div>

                <ScrollArea className="flex-1 rounded-md border">
                  <div className="p-2 space-y-2">
                    {config.templates.map((template) => (
                      <div
                        key={template.id}
                        className={cn(
                          "flex items-center justify-between gap-2 rounded-md border px-3 py-2",
                          template.id === config.activeTemplateId && "bg-accent",
                        )}
                      >
                        <div className="min-w-0 flex-1">
                          <div className="text-sm font-medium">
                            {template.name}
                            {template.isDefault && (
                              <span className="text-xs text-muted-foreground ml-2">(Built-in)</span>
                            )}
                          </div>
                          <div className="text-xs text-muted-foreground truncate">
                            {template.systemPrompt.slice(0, 80)}...
                          </div>
                        </div>
                        <div className="flex items-center gap-1">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleEditTemplate(template)}
                          >
                            Edit
                          </Button>
                          {!template.isDefault && (
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={() => deleteTemplate(template.id)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </>
            )}
          </TabsContent>
        </Tabs>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Suggestion Card Component
interface SuggestionCardProps {
  suggestion: AISpeakerSuggestion;
  segments: Array<{ id: string; text: string; speaker: string }>;
  onAccept: () => void;
  onReject: () => void;
}

function SuggestionCard({ suggestion, segments, onAccept, onReject }: SuggestionCardProps) {
  const segment = segments.find((s) => s.id === suggestion.segmentId);
  if (!segment) return null;

  return (
    <div className="rounded-md border p-3 space-y-2">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="text-sm line-clamp-2">{segment.text}</p>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-xs text-muted-foreground">Current:</span>
            <span className="text-xs font-medium">{suggestion.currentSpeaker}</span>
            <span className="text-xs text-muted-foreground">→</span>
            <span className="text-xs font-medium text-primary">{suggestion.suggestedSpeaker}</span>
            {suggestion.isNewSpeaker && (
              <span className="text-[10px] font-semibold uppercase tracking-wide px-1 py-0.5 rounded border border-dashed border-primary/40 text-primary/70 bg-background/80">
                New
              </span>
            )}
            {suggestion.confidence !== undefined && (
              <span
                className={cn(
                  "text-xs px-1.5 py-0.5 rounded",
                  suggestion.confidence >= 0.8
                    ? "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300"
                    : suggestion.confidence >= 0.6
                      ? "bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300"
                      : "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300",
                )}
              >
                {Math.round(suggestion.confidence * 100)}%
              </span>
            )}
          </div>
          {suggestion.reason && (
            <p className="text-xs text-muted-foreground mt-1 italic">{suggestion.reason}</p>
          )}
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <Button size="sm" variant="outline" onClick={onAccept}>
            <Check className="h-4 w-4" />
          </Button>
          <Button size="sm" variant="ghost" onClick={onReject}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
