import {
  AlertCircle,
  Check,
  ChevronDown,
  ChevronRight,
  Sparkles,
  StopCircle,
  Trash2,
  X,
} from "lucide-react";
import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useTranscriptStore } from "@/lib/store";
import { AIBatchControlSection } from "./AIBatchControlSection";
import { AIConfigurationSection } from "./AIConfigurationSection";
import { AIResultsSection } from "./AIResultsSection";
import { BatchLogDrawer } from "./BatchLogDrawer";
import { useAiSettingsSelection } from "./hooks/useAiSettingsSelection";
import { useScopedSegments } from "./hooks/useScopedSegments";
import { ResultsList } from "./ResultsList";
import { ScopeSection } from "./ScopeSection";
import { createSegmentNavigator } from "./utils/segmentNavigator";
import { truncateText } from "./utils/truncateText";

interface SpeakerPanelProps {
  filteredSegmentIds: string[];
  onOpenSettings: () => void;
}

export function SpeakerPanel({ filteredSegmentIds, onOpenSettings }: SpeakerPanelProps) {
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
  const setCurrentTime = useTranscriptStore((s) => s.setCurrentTime);
  const requestSeek = useTranscriptStore((s) => s.requestSeek);

  const [isLogOpen, setIsLogOpen] = useState(false);
  const [excludeConfirmed, setExcludeConfirmed] = useState(true);
  const [batchSize, setBatchSize] = useState(config.batchSize.toString());
  const [highConfExpanded, setHighConfExpanded] = useState(true);
  const [medConfExpanded, setMedConfExpanded] = useState(false);
  const [lowConfExpanded, setLowConfExpanded] = useState(false);

  const { settings, selectedProviderId, selectedModel, selectProvider, setSelectedModel } =
    useAiSettingsSelection({
      initialProviderId: config.selectedProviderId ?? "",
      initialModel: config.selectedModel ?? "",
    });

  const { segmentById, scopedSegmentIds, isFiltered } = useScopedSegments({
    segments,
    filteredSegmentIds,
    excludeConfirmed,
  });

  const pendingSuggestions = suggestions.filter((s) => s.status === "pending");
  const scrollToSegment = useMemo(
    () =>
      createSegmentNavigator(segmentById, {
        setSelectedSegmentId,
        setCurrentTime,
        requestSeek,
      }),
    [segmentById, setSelectedSegmentId, setCurrentTime, requestSeek],
  );

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
    startAnalysis([], excludeConfirmed, scopedSegmentIds);
  };

  return (
    <div className="space-y-5">
      <ScopeSection
        scopedSegmentCount={scopedSegmentIds.length}
        isFiltered={isFiltered}
        excludeConfirmed={excludeConfirmed}
        onExcludeConfirmedChange={setExcludeConfirmed}
        id="speaker"
      />

      <AIConfigurationSection
        id="speaker"
        settings={settings}
        selectedProviderId={selectedProviderId}
        selectedModel={selectedModel}
        isProcessing={isProcessing}
        promptValue={config.activePromptId}
        promptOptions={config.prompts}
        batchSize={batchSize}
        onProviderChange={selectProvider}
        onModelChange={setSelectedModel}
        onPromptChange={setActivePrompt}
        onBatchSizeChange={setBatchSize}
        onOpenSettings={onOpenSettings}
      />

      <AIBatchControlSection
        isProcessing={isProcessing}
        processedCount={processedCount}
        totalToProcess={totalToProcess}
        error={error}
        startAction={{
          label: "Start Batch",
          icon: <Sparkles className="h-4 w-4 mr-2" />,
          onClick: handleStartAnalysis,
          disabled: segments.length === 0,
        }}
        stopAction={{
          label: "Stop",
          icon: <StopCircle className="h-4 w-4 mr-2" />,
          onClick: cancelAnalysis,
          variant: "destructive",
        }}
        secondaryAction={
          pendingSuggestions.length > 0
            ? {
                label: "Clear",
                icon: <Trash2 className="h-4 w-4 mr-2" />,
                onClick: clearSuggestions,
                variant: "outline",
              }
            : undefined
        }
      >
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
      </AIBatchControlSection>

      {(pendingSuggestions.length > 0 || batchLog.length > 0 || isProcessing) && (
        <AIResultsSection
          title={`Suggestions (${pendingSuggestions.length} pending)`}
          meta={
            batchInsights.length > 0 ? (
              <div className="text-xs text-muted-foreground">
                {batchInsights.length} runs, last update at{" "}
                {new Date(batchInsights[batchInsights.length - 1].loggedAt).toLocaleTimeString()}
              </div>
            ) : null
          }
        >
          {(batchLog.length > 0 || isProcessing) && (
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>
                Total elapsed:{" "}
                {batchLog.length > 0
                  ? `${((batchLog[batchLog.length - 1].elapsedMs ?? 0) / 1000).toFixed(2)}s`
                  : "-"}
              </span>
              <BatchLogDrawer
                rows={batchLog.map((entry, idx) => {
                  const returned = entry.rawItemCount;
                  const expected = entry.batchSize;
                  const ignored = entry.ignoredCount ?? Math.max(0, returned - expected);
                  const used = Math.min(returned, expected);
                  const issueSummary =
                    entry.issues && entry.issues.length > 0 ? entry.issues[0].message : "—";
                  console.log(`[DEBUG UI] Batch ${idx}: processedTotal=${entry.processedTotal}, totalExpected=${entry.totalExpected}`);
                  return {
                    id: `${entry.batchIndex}-${entry.loggedAt}-${idx}`,
                    batchLabel: `${entry.batchIndex + 1}`,
                    expected,
                    returned,
                    durationMs: entry.batchDurationMs,
                    used,
                    ignored,
                    suggestions: entry.suggestionCount,
                    unchanged: entry.unchangedAssignments,
                    processed: `${entry.processedTotal}/${entry.totalExpected}`,
                    issues: entry.fatal ? "FATAL" : issueSummary,
                    loggedAt: entry.loggedAt,
                  };
                })}
                open={isLogOpen}
                onOpenChange={setIsLogOpen}
                total={totalToProcess}
                title="Batch Log"
                description="Batch processing summary and issues."
              />
            </div>
          )}

          {/* Results Summary with Confidence Grouping */}
          {pendingSuggestions.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-sm font-medium">Results Summary</h3>
              {(() => {
                const highConfidence = pendingSuggestions.filter((s) => (s.confidence ?? 0) >= 0.8);
                const mediumConfidence = pendingSuggestions.filter(
                  (s) => (s.confidence ?? 0) >= 0.5 && (s.confidence ?? 0) < 0.8,
                );
                const lowConfidence = pendingSuggestions.filter((s) => (s.confidence ?? 0) < 0.5);

                const renderSuggestionItem = (suggestion: (typeof pendingSuggestions)[0]) => {
                  const segment = segmentById.get(suggestion.segmentId);
                  const textSnippet = segment ? truncateText(segment.text, 40) : "";

                  return (
                    <>
                      <span className="flex-1 truncate text-muted-foreground min-w-0">
                        {textSnippet}
                      </span>
                      <Badge
                        variant="secondary"
                        className="shrink-0 text-[10px] px-1.5 py-0 truncate max-w-[120px]"
                        title={`${suggestion.currentSpeaker} → ${suggestion.suggestedSpeaker}`}
                      >
                        {suggestion.currentSpeaker} → {suggestion.suggestedSpeaker}
                      </Badge>
                      <span className="text-muted-foreground ml-1 shrink-0">
                        {((suggestion.confidence ?? 0) * 100).toFixed(0)}%
                      </span>
                    </>
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
                            <ResultsList
                              items={highConfidence}
                              getKey={(suggestion) => suggestion.segmentId}
                              onActivate={(suggestion) => scrollToSegment(suggestion.segmentId)}
                              getItemTitle={(suggestion) =>
                                segmentById.get(suggestion.segmentId)?.text
                              }
                              renderItem={renderSuggestionItem}
                            />
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
                            <ResultsList
                              items={mediumConfidence}
                              getKey={(suggestion) => suggestion.segmentId}
                              onActivate={(suggestion) => scrollToSegment(suggestion.segmentId)}
                              getItemTitle={(suggestion) =>
                                segmentById.get(suggestion.segmentId)?.text
                              }
                              renderItem={renderSuggestionItem}
                            />
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
                            <ResultsList
                              items={lowConfidence}
                              getKey={(suggestion) => suggestion.segmentId}
                              onActivate={(suggestion) => scrollToSegment(suggestion.segmentId)}
                              getItemTitle={(suggestion) =>
                                segmentById.get(suggestion.segmentId)?.text
                              }
                              renderItem={renderSuggestionItem}
                            />
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
          )}
        </AIResultsSection>
      )}
    </div>
  );
}
