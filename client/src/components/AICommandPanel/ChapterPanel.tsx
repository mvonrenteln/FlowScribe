import { Check, Sparkles, StopCircle, Trash2 } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { truncateText } from "./utils/truncateText";

interface ChapterPanelProps {
  filteredSegmentIds: string[];
  onOpenSettings: () => void;
}

export function ChapterPanel({ filteredSegmentIds, onOpenSettings }: ChapterPanelProps) {
  const segments = useTranscriptStore((s) => s.segments);
  const suggestions = useTranscriptStore((s) => s.aiChapterDetectionSuggestions);
  const isProcessing = useTranscriptStore((s) => s.aiChapterDetectionIsProcessing);
  const processedBatches = useTranscriptStore((s) => s.aiChapterDetectionProcessedBatches);
  const totalBatches = useTranscriptStore((s) => s.aiChapterDetectionTotalBatches);
  const config = useTranscriptStore((s) => s.aiChapterDetectionConfig);
  const error = useTranscriptStore((s) => s.aiChapterDetectionError);
  const batchLog = useTranscriptStore((s) => s.aiChapterDetectionBatchLog);

  const start = useTranscriptStore((s) => s.startChapterDetection);
  const cancel = useTranscriptStore((s) => s.cancelChapterDetection);
  const acceptAll = useTranscriptStore((s) => s.acceptAllChapterSuggestions);
  const clear = useTranscriptStore((s) => s.clearChapterSuggestions);
  const updateConfig = useTranscriptStore((s) => s.updateChapterDetectionConfig);
  const setActivePrompt = useTranscriptStore((s) => s.setActiveChapterDetectionPrompt);
  const setSelectedSegmentId = useTranscriptStore((s) => s.setSelectedSegmentId);
  const seekToTime = useTranscriptStore((s) => s.seekToTime);

  const { settings, selectedProviderId, selectedModel, selectProvider, setSelectedModel } =
    useAiSettingsSelection({
      initialProviderId: config.selectedProviderId ?? "",
      initialModel: config.selectedModel ?? "",
    });

  const [excludeConfirmed, setExcludeConfirmed] = useState(true);
  const [batchSize, setBatchSize] = useState(config.batchSize.toString());
  const [minLen, setMinLen] = useState(config.minChapterLength.toString());
  const [maxLen, setMaxLen] = useState(config.maxChapterLength.toString());
  const [isLogOpen, setIsLogOpen] = useState(false);

  const pending = suggestions.filter((s) => s.status === "pending");

  const { segmentById, scopedSegmentIds, isFiltered } = useScopedSegments({
    segments,
    filteredSegmentIds,
    excludeConfirmed,
  });

  const handleStart = () => {
    const parsedBatch = Number.parseInt(batchSize, 10);
    const parsedMin = Number.parseInt(minLen, 10);
    const parsedMax = Number.parseInt(maxLen, 10);
    if (Number.isNaN(parsedBatch) || parsedBatch < 10 || parsedBatch > 200) return;
    if (Number.isNaN(parsedMin) || parsedMin < 1) return;
    if (Number.isNaN(parsedMax) || parsedMax < parsedMin) return;
    if (parsedMax > parsedBatch) return;
    if (scopedSegmentIds.length === 0) return;

    updateConfig({
      selectedProviderId: selectedProviderId || undefined,
      selectedModel: selectedModel || undefined,
      batchSize: parsedBatch,
      minChapterLength: parsedMin,
      maxChapterLength: parsedMax,
    });

    start({
      selectedProviderId: selectedProviderId || undefined,
      selectedModel: selectedModel || undefined,
      batchSize: parsedBatch,
      minChapterLength: parsedMin,
      maxChapterLength: parsedMax,
      segmentIds: scopedSegmentIds,
    });
  };

  const jumpToSuggestion = (startSegmentId: string) => {
    const seg = segmentById.get(startSegmentId);
    if (!seg) return;
    setSelectedSegmentId(seg.id);
    seekToTime(seg.start, { source: "ai", action: "jump" });
  };

  return (
    <div className="space-y-6">
      <ScopeSection
        scopedSegmentCount={scopedSegmentIds.length}
        isFiltered={isFiltered}
        excludeConfirmed={excludeConfirmed}
        onExcludeConfirmedChange={setExcludeConfirmed}
        id="chapters"
      />

      <AIConfigurationSection
        id="chapters"
        settings={settings}
        selectedProviderId={selectedProviderId}
        selectedModel={selectedModel}
        isProcessing={isProcessing}
        promptValue={config.activePromptId}
        promptOptions={config.prompts}
        batchSize={batchSize}
        batchSizeMin={10}
        batchSizeMax={200}
        batchSizeHelp="Number of segments to process in each batch (10-200)"
        onProviderChange={(value) => {
          selectProvider(value);
          updateConfig({ selectedProviderId: value || undefined, selectedModel: undefined });
        }}
        onModelChange={(value) => {
          setSelectedModel(value);
          updateConfig({ selectedModel: value || undefined });
        }}
        onPromptChange={setActivePrompt}
        onBatchSizeChange={setBatchSize}
        onOpenSettings={onOpenSettings}
      />

      <section className="space-y-3">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Chapter Settings
        </h3>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label htmlFor="chapters-min" className="text-xs text-muted-foreground">
              Min Length (segments)
            </Label>
            <Input
              id="chapters-min"
              className="h-8 text-sm"
              type="number"
              min={1}
              value={minLen}
              onChange={(e) => {
                const v = e.target.value;
                if (v === "" || /^\d*$/.test(v)) setMinLen(v);
              }}
              onBlur={() => {
                const parsedBatch = Number.parseInt(batchSize, 10);
                const batchVal = Number.isNaN(parsedBatch) ? config.batchSize : parsedBatch;
                let parsedMin = Number.parseInt(minLen, 10);
                if (Number.isNaN(parsedMin) || parsedMin < 1) parsedMin = 1;
                // Ensure min is not greater than batch size
                if (parsedMin > batchVal) parsedMin = batchVal;
                // Ensure min is not greater than current max
                const parsedMax = Number.parseInt(maxLen, 10);
                if (!Number.isNaN(parsedMax) && parsedMin > parsedMax) parsedMin = parsedMax;
                setMinLen(String(parsedMin));
              }}
              disabled={isProcessing}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="chapters-max" className="text-xs text-muted-foreground">
              Max Length (segments)
            </Label>
            <Input
              id="chapters-max"
              className="h-8 text-sm"
              type="number"
              min={1}
              value={maxLen}
              onChange={(e) => {
                const v = e.target.value;
                if (v === "" || /^\d*$/.test(v)) setMaxLen(v);
              }}
              onBlur={() => {
                const parsedBatch = Number.parseInt(batchSize, 10);
                const batchVal = Number.isNaN(parsedBatch) ? config.batchSize : parsedBatch;
                let parsedMax = Number.parseInt(maxLen, 10);
                const parsedMin = Number.parseInt(minLen, 10);
                if (Number.isNaN(parsedMax) || parsedMax < 1) parsedMax = parsedMin || 1;
                // Max must not exceed batch size
                if (parsedMax > batchVal) parsedMax = batchVal;
                // Max must be at least min
                if (!Number.isNaN(parsedMin) && parsedMax < parsedMin) parsedMax = parsedMin;
                setMaxLen(String(parsedMax));
              }}
              disabled={isProcessing}
            />
          </div>
        </div>
      </section>

      <AIBatchControlSection
        isProcessing={isProcessing}
        processedCount={processedBatches}
        totalToProcess={totalBatches}
        progressUnitLabel="batches"
        error={error}
        startAction={{
          label: "Start Batch",
          icon: <Sparkles className="h-4 w-4 mr-2" />,
          onClick: handleStart,
          disabled: scopedSegmentIds.length === 0,
        }}
        stopAction={{
          label: "Stop",
          icon: <StopCircle className="h-4 w-4 mr-2" />,
          onClick: cancel,
          variant: "destructive",
        }}
        secondaryAction={
          pending.length > 0
            ? {
                label: "Clear",
                icon: <Trash2 className="h-4 w-4 mr-2" />,
                onClick: clear,
                variant: "outline",
              }
            : undefined
        }
      >
        {(batchLog.length > 0 || isProcessing) && (
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>
              Total elapsed:{" "}
              {batchLog.length > 0
                ? formatDurationMs(batchLog[batchLog.length - 1].elapsedMs)
                : "-"}
            </span>
            <BatchLogDrawer
              rows={batchLog.map((entry, idx) => ({
                id: `${entry.batchIndex}-${entry.loggedAt}-${idx}`,
                batchLabel: `${entry.batchIndex + 1}`,
                expected: entry.batchSize,
                returned: entry.rawItemCount,
                durationMs: entry.batchDurationMs,
                used: entry.rawItemCount,
                ignored: 0,
                suggestions: entry.suggestionCount,
                processed: `${entry.processedTotal}/${entry.totalExpected}`,
                issues: entry.fatal
                  ? "FATAL"
                  : entry.issues.length > 0
                    ? entry.issues[0]?.message
                    : "—",
                loggedAt: entry.loggedAt,
                requestPayload: entry.requestPayload,
                responsePayload: entry.responsePayload,
              }))}
              open={isLogOpen}
              onOpenChange={setIsLogOpen}
              total={totalBatches}
              title="Batch Log"
              description="Batch processing summary and issues."
              triggerLabel="Batch Log"
            />
          </div>
        )}
      </AIBatchControlSection>

      {(pending.length > 0 || batchLog.length > 0 || isProcessing) && (
        <AIResultsSection title={`Suggestions (${pending.length} pending)`}>
          <ResultsList
            items={pending}
            getKey={(item) => item.id}
            onActivate={(item) => jumpToSuggestion(item.startSegmentId)}
            getItemTitle={(item) => item.summary}
            renderItem={(item) => (
              <>
                <span className="flex-1 truncate text-muted-foreground min-w-0">
                  {truncateText(item.title, 40)}
                </span>
                <span className="text-muted-foreground shrink-0">•</span>
                <span className="flex-1 truncate text-muted-foreground min-w-0">
                  {truncateText(item.summary ?? "", 40)}
                </span>
              </>
            )}
          />
          {pending.length > 0 ? (
            <div className="flex gap-2">
              <Button variant="outline" size="sm" className="flex-1" onClick={clear}>
                <Trash2 className="mr-2 h-4 w-4" />
                Clear
              </Button>
              <Button size="sm" className="flex-1" onClick={acceptAll}>
                <Check className="mr-2 h-4 w-4" />
                Accept All
              </Button>
            </div>
          ) : null}
        </AIResultsSection>
      )}
    </div>
  );
}
