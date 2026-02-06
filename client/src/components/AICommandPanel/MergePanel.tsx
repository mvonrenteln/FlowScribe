import { Check, ChevronDown, ChevronRight, Info, Sparkles, StopCircle, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { formatDurationMs } from "@/lib/formatting";
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
import { getConsecutiveSegmentIds } from "./utils/segmentScope";
import { truncateText } from "./utils/truncateText";

interface MergePanelProps {
  filteredSegmentIds: string[];
  onOpenSettings: () => void;
}

export function MergePanel({ filteredSegmentIds, onOpenSettings }: Readonly<MergePanelProps>) {
  const segments = useTranscriptStore((s) => s.segments);
  const suggestions = useTranscriptStore((s) => s.aiSegmentMergeSuggestions);
  const isProcessing = useTranscriptStore((s) => s.aiSegmentMergeIsProcessing);
  const isCancelling = useTranscriptStore((s) => s.aiSegmentMergeIsCancelling);
  const processedCount = useTranscriptStore((s) => s.aiSegmentMergeProcessedCount);
  const totalToProcess = useTranscriptStore((s) => s.aiSegmentMergeTotalToProcess);
  const config = useTranscriptStore((s) => s.aiSegmentMergeConfig);
  const error = useTranscriptStore((s) => s.aiSegmentMergeError);
  const batchLog = useTranscriptStore((s) => s.aiSegmentMergeBatchLog);

  const startMergeAnalysis = useTranscriptStore((s) => s.startMergeAnalysis);
  const cancelMergeAnalysis = useTranscriptStore((s) => s.cancelMergeAnalysis);
  const acceptAllHighConfidence = useTranscriptStore((s) => s.acceptAllHighConfidence);
  const rejectAllSuggestions = useTranscriptStore((s) => s.rejectAllSuggestions);
  const clearMergeSuggestions = useTranscriptStore((s) => s.clearMergeSuggestions);
  const updateMergeConfig = useTranscriptStore((s) => s.updateMergeConfig);
  const setActiveSegmentMergePrompt = useTranscriptStore((s) => s.setActiveSegmentMergePrompt);

  const setSelectedSegmentId = useTranscriptStore((s) => s.setSelectedSegmentId);
  const seekToTime = useTranscriptStore((s) => s.seekToTime);

  const [excludeConfirmed, setExcludeConfirmed] = useState(true);
  const [batchSize, setBatchSize] = useState(config.batchSize.toString());
  const [maxTimeGap, setMaxTimeGap] = useState(config.defaultMaxTimeGap.toString());
  const [minConfidence, setMinConfidence] = useState(config.defaultMinConfidence);
  const [sameSpeakerOnly, setSameSpeakerOnly] = useState(true);
  const [enableSmoothing, setEnableSmoothing] = useState(config.defaultEnableSmoothing);
  const [isLogOpen, setIsLogOpen] = useState(false);
  const [highExpanded, setHighExpanded] = useState(true);
  const [mediumExpanded, setMediumExpanded] = useState(false);
  const [lowExpanded, setLowExpanded] = useState(false);

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

  const analysisSegmentIds = useMemo(
    () => getConsecutiveSegmentIds(segments, scopedSegmentIds),
    [segments, scopedSegmentIds],
  );

  const batchLogRows = useMemo(
    () =>
      batchLog.map((entry, idx) => {
        const skipped = Math.max(0, entry.pairCount - entry.normalizedCount);
        const issueSummary = entry.issues.length > 0 ? entry.issues[0]?.message : "—";
        return {
          id: `${entry.batchIndex}-${entry.loggedAt ?? 0}-${idx}`,
          batchLabel: `${entry.batchIndex}`,
          expected: entry.pairCount,
          returned: entry.normalizedCount,
          skipped,
          durationMs: entry.batchDurationMs,
          used: entry.normalizedCount,
          ignored: 0,
          suggestions: entry.suggestionCount,
          processed: `${entry.processedTotal}/${entry.totalExpected}`,
          issues: entry.fatal ? "FATAL" : issueSummary,
          loggedAt: entry.loggedAt ?? Date.now(),
          requestPayload: entry.requestPayload,
          responsePayload: entry.responsePayload,
        };
      }),
    [batchLog],
  );

  const pendingSuggestions = suggestions.filter((s) => s.status === "pending");
  const highConfidence = pendingSuggestions.filter((s) => s.confidence === "high");
  const mediumConfidence = pendingSuggestions.filter((s) => s.confidence === "medium");
  const lowConfidence = pendingSuggestions.filter((s) => s.confidence === "low");

  const scrollToSegment = useMemo(
    () =>
      createSegmentNavigator(segmentById, {
        setSelectedSegmentId,
        seekToTime,
      }),
    [segmentById, setSelectedSegmentId, seekToTime],
  );

  const handleStart = () => {
    const parsedBatch = Number.parseInt(batchSize, 10);
    const parsedGap = Number.parseFloat(maxTimeGap);
    if (Number.isNaN(parsedBatch) || parsedBatch < 1 || parsedBatch > 50) {
      return;
    }
    if (Number.isNaN(parsedGap) || parsedGap <= 0) {
      return;
    }
    if (analysisSegmentIds.length < 2) {
      return;
    }

    updateMergeConfig({
      selectedProviderId: selectedProviderId || undefined,
      selectedModel: selectedModel || undefined,
      defaultMaxTimeGap: parsedGap,
      defaultMinConfidence: minConfidence,
      defaultEnableSmoothing: enableSmoothing,
      batchSize: parsedBatch,
    });

    startMergeAnalysis({
      segmentIds: analysisSegmentIds,
      maxTimeGap: parsedGap,
      minConfidence,
      sameSpeakerOnly,
      enableSmoothing,
      batchSize: parsedBatch,
      providerId: selectedProviderId || undefined,
      model: selectedModel || undefined,
    });
  };

  return (
    <div className="space-y-6">
      <ScopeSection
        scopedSegmentCount={scopedSegmentIds.length}
        isFiltered={isFiltered}
        excludeConfirmed={excludeConfirmed}
        onExcludeConfirmedChange={setExcludeConfirmed}
        id="merge"
      />

      <AIConfigurationSection
        id="merge"
        settings={settings}
        selectedProviderId={selectedProviderId}
        selectedModel={selectedModel}
        isProcessing={isProcessing}
        promptValue={config.activePromptId}
        promptOptions={config.prompts}
        batchSize={batchSize}
        onProviderChange={(value) => {
          selectProvider(value);
          updateMergeConfig({
            selectedProviderId: value || undefined,
            selectedModel: undefined,
          });
        }}
        onModelChange={(value) => {
          setSelectedModel(value);
          updateMergeConfig({ selectedModel: value || undefined });
        }}
        onPromptChange={setActiveSegmentMergePrompt}
        onBatchSizeChange={setBatchSize}
        onOpenSettings={onOpenSettings}
      />

      <section className="space-y-3">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Merge Settings
        </h3>
        <div className="grid gap-3">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Label htmlFor="merge-max-gap" className="text-xs text-muted-foreground">
                Max Time Gap (seconds)
              </Label>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      className="text-muted-foreground hover:text-foreground"
                      aria-label="Max time gap help"
                    >
                      <Info className="h-3.5 w-3.5" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Only consider adjacent segments separated by less than this gap.</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
            <Input
              id="merge-max-gap"
              type="number"
              min={0.1}
              max={10}
              step={0.1}
              value={maxTimeGap}
              onChange={(event) => setMaxTimeGap(event.target.value)}
              disabled={isProcessing}
              className="h-8 text-sm"
            />
          </div>
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Label htmlFor="merge-confidence" className="text-xs text-muted-foreground">
                Min Confidence
              </Label>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      className="text-muted-foreground hover:text-foreground"
                      aria-label="Minimum confidence help"
                    >
                      <Info className="h-3.5 w-3.5" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Filter suggestions by AI confidence threshold.</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
            <Select
              value={minConfidence}
              onValueChange={(value) => setMinConfidence(value as typeof minConfidence)}
              disabled={isProcessing}
            >
              <SelectTrigger id="merge-confidence" className="h-8 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="high">High only</SelectItem>
                <SelectItem value="medium">Medium and above</SelectItem>
                <SelectItem value="low">All (including low)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Checkbox
                id="merge-same-speaker"
                checked={sameSpeakerOnly}
                onCheckedChange={(checked) => setSameSpeakerOnly(Boolean(checked))}
                disabled={isProcessing}
              />
              <Label htmlFor="merge-same-speaker" className="text-xs text-muted-foreground">
                Same speaker only
              </Label>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      className="text-muted-foreground hover:text-foreground"
                      aria-label="Same speaker only help"
                    >
                      <Info className="h-3.5 w-3.5" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Skip merges across speaker changes.</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
            <div className="flex items-center gap-2">
              <Checkbox
                id="merge-smoothing"
                checked={enableSmoothing}
                onCheckedChange={(checked) => setEnableSmoothing(Boolean(checked))}
                disabled={isProcessing}
              />
              <Label htmlFor="merge-smoothing" className="text-xs text-muted-foreground">
                Enable text smoothing
              </Label>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      className="text-muted-foreground hover:text-foreground"
                      aria-label="Enable text smoothing help"
                    >
                      <Info className="h-3.5 w-3.5" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Allow the AI to fix punctuation and casing across the merge.</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
          </div>
        </div>
      </section>

      <AIBatchControlSection
        isProcessing={isProcessing}
        isCancelling={isCancelling}
        processedCount={processedCount}
        totalToProcess={totalToProcess}
        progressUnitLabel="segment pairs"
        error={error}
        startAction={{
          label: "Start Batch",
          icon: <Sparkles className="mr-2 h-4 w-4" />,
          onClick: handleStart,
          disabled: analysisSegmentIds.length < 2 || !selectedProviderId,
        }}
        stopAction={{
          label: "Stop",
          icon: <StopCircle className="mr-2 h-4 w-4" />,
          onClick: cancelMergeAnalysis,
          variant: "destructive",
        }}
        secondaryAction={
          pendingSuggestions.length > 0
            ? {
                label: "Clear",
                icon: <Trash2 className="mr-2 h-4 w-4" />,
                onClick: clearMergeSuggestions,
                variant: "outline",
              }
            : undefined
        }
      >
        {(batchLog.length > 0 || isProcessing) && (
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Batch log entries: {batchLog.length}</span>
            <BatchLogDrawer
              rows={batchLogRows}
              open={isLogOpen}
              onOpenChange={setIsLogOpen}
              total={totalToProcess}
              title="Batch Log"
              description="Batch merge status updates and issues."
            />
          </div>
        )}
      </AIBatchControlSection>

      {(pendingSuggestions.length > 0 || isProcessing) && (
        <AIResultsSection title={`Suggestions (${pendingSuggestions.length} pending)`}>
          {pendingSuggestions.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span>High: {highConfidence.length}</span>
                <span>•</span>
                <span>Medium: {mediumConfidence.length}</span>
                <span>•</span>
                <span>Low: {lowConfidence.length}</span>
              </div>
              {highConfidence.length > 0 && (
                <div className="space-y-2">
                  <button
                    type="button"
                    className="flex items-center gap-1 text-xs font-semibold text-green-600 hover:underline"
                    onClick={() => setHighExpanded((open) => !open)}
                  >
                    {highExpanded ? (
                      <ChevronDown className="h-3 w-3" />
                    ) : (
                      <ChevronRight className="h-3 w-3" />
                    )}
                    High Confidence ({highConfidence.length})
                  </button>
                  {highExpanded && (
                    <>
                      <ResultsList
                        items={highConfidence}
                        getKey={(suggestion) => suggestion.id}
                        onActivate={(suggestion) => scrollToSegment(suggestion.segmentIds[0] ?? "")}
                        getItemTitle={(suggestion) =>
                          segmentById.get(suggestion.segmentIds[0] ?? "")?.text
                        }
                        renderItem={(suggestion) => {
                          const first = segmentById.get(suggestion.segmentIds[0] ?? "");
                          const second = segmentById.get(suggestion.segmentIds[1] ?? "");
                          return (
                            <>
                              <span className="flex-1 truncate text-muted-foreground min-w-0">
                                {first && second
                                  ? `${truncateText(first.text, 22)} + ${truncateText(
                                      second.text,
                                      22,
                                    )}`
                                  : suggestion.segmentIds.join(" + ")}
                              </span>
                              <Badge variant="secondary" className="text-[10px] shrink-0">
                                Gap {formatDurationMs(Math.round(suggestion.timeGap * 1000))}
                              </Badge>
                            </>
                          );
                        }}
                      />
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full"
                        onClick={acceptAllHighConfidence}
                      >
                        <Check className="mr-2 h-3.5 w-3.5" />
                        Accept All High
                      </Button>
                    </>
                  )}
                </div>
              )}

              {mediumConfidence.length > 0 && (
                <div className="space-y-2">
                  <button
                    type="button"
                    className="flex items-center gap-1 text-xs font-semibold text-amber-600 hover:underline"
                    onClick={() => setMediumExpanded((open) => !open)}
                  >
                    {mediumExpanded ? (
                      <ChevronDown className="h-3 w-3" />
                    ) : (
                      <ChevronRight className="h-3 w-3" />
                    )}
                    Medium Confidence ({mediumConfidence.length})
                  </button>
                  {mediumExpanded && (
                    <ResultsList
                      items={mediumConfidence}
                      getKey={(suggestion) => suggestion.id}
                      onActivate={(suggestion) => scrollToSegment(suggestion.segmentIds[0] ?? "")}
                      getItemTitle={(suggestion) =>
                        segmentById.get(suggestion.segmentIds[0] ?? "")?.text
                      }
                      renderItem={(suggestion) => {
                        const first = segmentById.get(suggestion.segmentIds[0] ?? "");
                        const second = segmentById.get(suggestion.segmentIds[1] ?? "");
                        return (
                          <>
                            <span className="flex-1 truncate text-muted-foreground min-w-0">
                              {first && second
                                ? `${truncateText(first.text, 22)} + ${truncateText(
                                    second.text,
                                    22,
                                  )}`
                                : suggestion.segmentIds.join(" + ")}
                            </span>
                            <Badge variant="secondary" className="text-[10px] shrink-0">
                              Gap {formatDurationMs(Math.round(suggestion.timeGap * 1000))}
                            </Badge>
                          </>
                        );
                      }}
                    />
                  )}
                </div>
              )}

              {lowConfidence.length > 0 && (
                <div className="space-y-2">
                  <button
                    type="button"
                    className="flex items-center gap-1 text-xs font-semibold text-red-600 hover:underline"
                    onClick={() => setLowExpanded((open) => !open)}
                  >
                    {lowExpanded ? (
                      <ChevronDown className="h-3 w-3" />
                    ) : (
                      <ChevronRight className="h-3 w-3" />
                    )}
                    Low Confidence ({lowConfidence.length})
                  </button>
                  {lowExpanded && (
                    <ResultsList
                      items={lowConfidence}
                      getKey={(suggestion) => suggestion.id}
                      onActivate={(suggestion) => scrollToSegment(suggestion.segmentIds[0] ?? "")}
                      getItemTitle={(suggestion) =>
                        segmentById.get(suggestion.segmentIds[0] ?? "")?.text
                      }
                      renderItem={(suggestion) => {
                        const first = segmentById.get(suggestion.segmentIds[0] ?? "");
                        const second = segmentById.get(suggestion.segmentIds[1] ?? "");
                        return (
                          <>
                            <span className="flex-1 truncate text-muted-foreground min-w-0">
                              {first && second
                                ? `${truncateText(first.text, 22)} + ${truncateText(
                                    second.text,
                                    22,
                                  )}`
                                : suggestion.segmentIds.join(" + ")}
                            </span>
                            <Badge variant="secondary" className="text-[10px] shrink-0">
                              Gap {formatDurationMs(Math.round(suggestion.timeGap * 1000))}
                            </Badge>
                          </>
                        );
                      }}
                    />
                  )}
                </div>
              )}

              <Button
                variant="outline"
                size="sm"
                className="w-full text-destructive hover:text-destructive"
                onClick={rejectAllSuggestions}
              >
                Reject All
              </Button>
            </div>
          )}
        </AIResultsSection>
      )}
    </div>
  );
}
