import {
  AlertCircle,
  Check,
  ChevronDown,
  ChevronRight,
  Settings2,
  Sparkles,
  StopCircle,
  Trash2,
  X,
} from "lucide-react";
import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer";

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
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { initializeSettings, type PersistedSettings } from "@/lib/settings/settingsStorage";
import { useTranscriptStore } from "@/lib/store";

interface SpeakerPanelProps {
  onOpenSettings: () => void;
}

export function SpeakerPanel({ onOpenSettings }: SpeakerPanelProps) {
  const segments = useTranscriptStore((s) => s.segments);

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

  const startAnalysis = useTranscriptStore((s) => s.startAnalysis);
  const cancelAnalysis = useTranscriptStore((s) => s.cancelAnalysis);
  const acceptManySuggestions = useTranscriptStore((s) => s.acceptManySuggestions);
  const rejectSuggestion = useTranscriptStore((s) => s.rejectSuggestion);
  const clearSuggestions = useTranscriptStore((s) => s.clearSuggestions);
  const updateConfig = useTranscriptStore((s) => s.updateConfig);
  const setActivePrompt = useTranscriptStore((s) => s.setActivePrompt);

  const setSelectedSegmentId = useTranscriptStore((s) => s.setSelectedSegmentId);

  const [isLogOpen, setIsLogOpen] = useState(false);
  const [excludeConfirmed, setExcludeConfirmed] = useState(true);
  const [batchSize, setBatchSize] = useState(config.batchSize.toString());
  const [settings, setSettings] = useState<PersistedSettings | null>(null);
  const [selectedProviderId, setSelectedProviderId] = useState<string>(
    config.selectedProviderId ?? "",
  );
  const [selectedModel, setSelectedModel] = useState<string>(config.selectedModel ?? "");
  const [highConfExpanded, setHighConfExpanded] = useState(true);
  const [medConfExpanded, setMedConfExpanded] = useState(false);
  const [lowConfExpanded, setLowConfExpanded] = useState(false);

  useEffect(() => {
    const loadedSettings = initializeSettings();
    setSettings(loadedSettings);

    let providerId = selectedProviderId;
    const providerExists = loadedSettings.aiProviders.some((p) => p.id === providerId);

    if (!providerExists) {
      providerId = loadedSettings.defaultAIProviderId ?? loadedSettings.aiProviders[0]?.id ?? "";
      setSelectedProviderId(providerId);
    }

    if (!providerId && loadedSettings.defaultAIProviderId) {
      setSelectedProviderId(loadedSettings.defaultAIProviderId);
    }
  }, [selectedProviderId]);

  useEffect(() => {
    if (selectedProviderId && settings) {
      const provider = settings.aiProviders.find((p) => p.id === selectedProviderId);
      if (provider) {
        const availableModels = provider.availableModels ?? [];
        if (!selectedModel || !availableModels.includes(selectedModel)) {
          setSelectedModel(provider.model || (availableModels[0] ?? ""));
        }
      }
    }
  }, [selectedProviderId, settings, selectedModel]);

  const selectedProvider = settings?.aiProviders.find((p) => p.id === selectedProviderId);
  const availableModels = selectedProvider?.availableModels ?? [];

  const pendingSuggestions = suggestions.filter((s) => s.status === "pending");
  const progressPercent =
    totalToProcess > 0 ? Math.round((processedCount / totalToProcess) * 100) : 0;

  const handleStartAnalysis = () => {
    const parsed = Number.parseInt(batchSize, 10);
    if (Number.isNaN(parsed) || parsed < 1 || parsed > 50) {
      return; // Invalid batch size
    }
    updateConfig({
      batchSize: parsed,
      selectedProviderId: selectedProviderId || undefined,
      selectedModel: selectedModel || undefined,
    });
    startAnalysis([], excludeConfirmed);
  };

  const handleScrollToSegment = (segmentId: string) => {
    setSelectedSegmentId(segmentId);
    // Scroll to segment
    requestAnimationFrame(() => {
      const element = document.querySelector(`[data-segment-id="${segmentId}"]`);
      if (element) {
        element.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    });
  };

  const truncateText = (text: string, maxLength: number) => {
    if (text.length <= maxLength) return text;
    return `${text.slice(0, maxLength)}...`;
  };

  // Calculate scoped segments for display
  const scopedSegmentIds = segments
    .filter((segment) => !excludeConfirmed || !segment.confirmed)
    .map((s) => s.id);
  // Check if we're working with filtered subset (less than total segments)
  const isFiltered = scopedSegmentIds.length < segments.length;

  return (
    <div className="space-y-5">
      <section className="space-y-3">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Scope
        </h3>
        <div className="text-sm text-foreground">
          {isFiltered ? "Filtered" : "All"}: {scopedSegmentIds.length} segment
          {scopedSegmentIds.length === 1 ? "" : "s"}
        </div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Checkbox
            id="speaker-exclude-confirmed"
            checked={excludeConfirmed}
            onCheckedChange={(value) => setExcludeConfirmed(Boolean(value))}
          />
          <Label htmlFor="speaker-exclude-confirmed" className="text-sm text-muted-foreground">
            Exclude confirmed
          </Label>
        </div>
      </section>

      <section className="space-y-3">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          AI Configuration
        </h3>
        {settings && settings.aiProviders.length > 0 ? (
          <div className="space-y-2">
            <Label htmlFor="speaker-provider" className="text-xs text-muted-foreground">
              Provider
            </Label>
            <Select
              value={selectedProviderId}
              onValueChange={(id) => {
                setSelectedProviderId(id);
                setSelectedModel("");
              }}
              disabled={isProcessing}
            >
              <SelectTrigger id="speaker-provider" className="h-8 text-sm">
                <SelectValue placeholder="Select provider..." />
              </SelectTrigger>
              <SelectContent>
                {settings.aiProviders.map((provider) => (
                  <SelectItem key={provider.id} value={provider.id}>
                    {provider.name}
                    {provider.isDefault && (
                      <span className="ml-2 text-xs text-muted-foreground">(Default)</span>
                    )}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ) : null}

        {selectedProvider && (
          <div className="space-y-2">
            <Label htmlFor="speaker-model" className="text-xs text-muted-foreground">
              Model
            </Label>
            {availableModels.length > 0 ? (
              <Select
                value={selectedModel || selectedProvider.model || ""}
                onValueChange={setSelectedModel}
                disabled={isProcessing}
              >
                <SelectTrigger id="speaker-model" className="h-8 text-sm">
                  <SelectValue placeholder="Select model..." />
                </SelectTrigger>
                <SelectContent>
                  {availableModels.map((model) => (
                    <SelectItem key={model} value={model}>
                      {model}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <div className="text-xs text-muted-foreground bg-muted rounded px-2 py-1.5">
                {selectedProvider.model || "No model configured"}
              </div>
            )}
          </div>
        )}

        <div className="space-y-2">
          <Label htmlFor="speaker-template" className="text-xs text-muted-foreground">
            Prompt Template
          </Label>
          <Select
            value={config.activePromptId}
            onValueChange={(value) => setActivePrompt(value)}
            disabled={isProcessing}
          >
            <SelectTrigger id="speaker-template" className="h-8 text-sm">
              <SelectValue placeholder="Select prompt" />
            </SelectTrigger>
            <SelectContent>
              {config.prompts.map((prompt) => (
                <SelectItem key={prompt.id} value={prompt.id}>
                  {prompt.name}
                  {prompt.isDefault && " (Default)"}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex-1">
            <Label htmlFor="speaker-batch-size" className="text-xs text-muted-foreground">
              Batch Size
            </Label>
            <input
              id="speaker-batch-size"
              type="number"
              min="1"
              max="50"
              value={batchSize}
              onChange={(e) => {
                const val = e.target.value;
                if (val === "" || (Number(val) >= 1 && Number(val) <= 50)) {
                  setBatchSize(val);
                }
              }}
              disabled={isProcessing}
              className="flex h-8 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            />
          </div>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="sm" onClick={onOpenSettings}>
                  <Settings2 className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Configure AI providers and prompts</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>

        {!selectedProviderId && settings?.aiProviders.length === 0 && (
          <div className="flex items-center gap-2 p-2 rounded-md bg-amber-100 text-amber-900 text-sm dark:bg-amber-900/20 dark:text-amber-200">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>No AI provider configured. Add one in Settings → AI → Server & Models.</span>
          </div>
        )}
      </section>

      <section className="space-y-3">
        {isProcessing && (
          <div className="space-y-2">
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
            <Button onClick={cancelAnalysis} variant="destructive" className="flex-1">
              <StopCircle className="h-4 w-4 mr-2" />
              Stop Analysis
            </Button>
          ) : (
            <Button
              onClick={handleStartAnalysis}
              disabled={segments.length === 0}
              className="flex-1"
            >
              <Sparkles className="h-4 w-4 mr-2" />
              Start Analysis
            </Button>
          )}
          {pendingSuggestions.length > 0 && (
            <Button variant="outline" onClick={clearSuggestions} className="flex-1">
              <Trash2 className="h-4 w-4 mr-2" />
              Clear
            </Button>
          )}
        </div>
      </section>

      {pendingSuggestions.length > 0 && (
        <section className="space-y-2">
          <div className="flex items-center justify-between">
            <Label className="text-sm font-medium">
              Suggestions ({pendingSuggestions.length} pending)
            </Label>
            {batchInsights.length > 0 && (
              <div className="text-xs text-muted-foreground">
                {batchInsights.length} runs, last update at{" "}
                {new Date(batchInsights[batchInsights.length - 1].loggedAt).toLocaleTimeString()}
              </div>
            )}
          </div>

          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>
              Total elapsed:{" "}
              {batchLog.length > 0
                ? `${((batchLog[batchLog.length - 1].elapsedMs ?? 0) / 1000).toFixed(2)}s`
                : "-"}
            </span>
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
                        const ignored = entry.ignoredCount ?? Math.max(0, returned - expected);
                        const used = Math.min(returned, expected);
                        const issueSummary =
                          entry.issues && entry.issues.length > 0 ? entry.issues[0].message : "—";
                        return (
                          <TableRow key={`${entry.batchIndex}-${entry.loggedAt}-${idx}`}>
                            <TableCell>{entry.batchIndex + 1}</TableCell>
                            <TableCell>{expected}</TableCell>
                            <TableCell>
                              <span className={returned !== expected ? "text-red-600" : ""}>
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
                            <TableCell>{entry.fatal ? "FATAL" : issueSummary}</TableCell>
                            <TableCell>{new Date(entry.loggedAt).toLocaleTimeString()}</TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              </DrawerContent>
            </Drawer>
          </div>

          {/* Results Summary with Confidence Grouping */}
          <div className="space-y-3">
            <h3 className="text-sm font-medium">Results Summary</h3>
            {(() => {
              const highConfidence = pendingSuggestions.filter((s) => (s.confidence ?? 0) >= 0.8);
              const mediumConfidence = pendingSuggestions.filter(
                (s) => (s.confidence ?? 0) >= 0.5 && (s.confidence ?? 0) < 0.8,
              );
              const lowConfidence = pendingSuggestions.filter((s) => (s.confidence ?? 0) < 0.5);

              const renderSuggestionItem = (suggestion: (typeof pendingSuggestions)[0]) => {
                const segment = segments.find((s) => s.id === suggestion.segmentId);
                const textSnippet = segment ? truncateText(segment.text, 40) : "";

                return (
                  <div
                    key={suggestion.segmentId}
                    className="flex items-center gap-2 text-xs p-2 rounded bg-muted/30 hover:bg-muted/50 cursor-pointer"
                    onClick={() => handleScrollToSegment(suggestion.segmentId)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        handleScrollToSegment(suggestion.segmentId);
                      }
                    }}
                    role="button"
                    tabIndex={0}
                    title={segment?.text}
                  >
                    <span className="flex-1 truncate text-muted-foreground min-w-0">{textSnippet}</span>
                    <Badge variant="secondary" className="shrink-0 text-[10px] px-1.5 py-0 whitespace-nowrap overflow-hidden text-ellipsis max-w-[120px]" title={`${suggestion.currentSpeaker} → ${suggestion.suggestedSpeaker}`}>
                      {suggestion.currentSpeaker} → {suggestion.suggestedSpeaker}
                    </Badge>
                    <span className="text-muted-foreground ml-1 shrink-0">
                      {((suggestion.confidence ?? 0) * 100).toFixed(0)}%
                    </span>
                  </div>
                );
              };

              return (
                <>
                  {highConfidence.length > 0 && (
                    <Collapsible open={highConfExpanded} onOpenChange={setHighConfExpanded}>
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <CollapsibleTrigger className="flex items-center gap-1 text-xs font-semibold text-green-600 dark:text-green-400 hover:underline">
                            {highConfExpanded ? (
                              <ChevronDown className="h-3 w-3" />
                            ) : (
                              <ChevronRight className="h-3 w-3" />
                            )}
                            High Confidence ({highConfidence.length})
                          </CollapsibleTrigger>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              // Batch update all high confidence suggestions
                              acceptManySuggestions(highConfidence.map((s) => s.segmentId));
                            }}
                            className="h-7 text-xs"
                          >
                            <Check className="h-3 w-3 mr-1" />
                            Accept All
                          </Button>
                        </div>
                        <CollapsibleContent>
                          <ScrollArea className="h-[200px]">
                            <div className="space-y-1 pr-3">
                              {highConfidence.map(renderSuggestionItem)}
                            </div>
                          </ScrollArea>
                        </CollapsibleContent>
                      </div>
                    </Collapsible>
                  )}

                  {mediumConfidence.length > 0 && (
                    <Collapsible open={medConfExpanded} onOpenChange={setMedConfExpanded}>
                      <div className="space-y-2">
                        <CollapsibleTrigger className="flex items-center gap-1 text-xs font-semibold text-amber-600 dark:text-amber-400 hover:underline">
                          {medConfExpanded ? (
                            <ChevronDown className="h-3 w-3" />
                          ) : (
                            <ChevronRight className="h-3 w-3" />
                          )}
                          Medium Confidence ({mediumConfidence.length})
                        </CollapsibleTrigger>
                        <CollapsibleContent>
                          <ScrollArea className="h-[200px]">
                            <div className="space-y-1 pr-3">
                              {mediumConfidence.map(renderSuggestionItem)}
                            </div>
                          </ScrollArea>
                        </CollapsibleContent>
                      </div>
                    </Collapsible>
                  )}

                  {lowConfidence.length > 0 && (
                    <Collapsible open={lowConfExpanded} onOpenChange={setLowConfExpanded}>
                      <div className="space-y-2">
                        <CollapsibleTrigger className="flex items-center gap-1 text-xs font-semibold text-red-600 dark:text-red-400 hover:underline">
                          {lowConfExpanded ? (
                            <ChevronDown className="h-3 w-3" />
                          ) : (
                            <ChevronRight className="h-3 w-3" />
                          )}
                          Low Confidence ({lowConfidence.length})
                        </CollapsibleTrigger>
                        <CollapsibleContent>
                          <ScrollArea className="h-[200px]">
                            <div className="space-y-1 pr-3">
                              {lowConfidence.map(renderSuggestionItem)}
                            </div>
                          </ScrollArea>
                        </CollapsibleContent>
                      </div>
                    </Collapsible>
                  )}

                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        for (const s of pendingSuggestions) {
                          rejectSuggestion(s.segmentId);
                        }
                      }}
                      className="flex-1"
                    >
                      <X className="h-3 w-3 mr-1" />
                      Reject All
                    </Button>
                  </div>
                </>
              );
            })()}
          </div>
        </section>
      )}
    </div>
  );
}
