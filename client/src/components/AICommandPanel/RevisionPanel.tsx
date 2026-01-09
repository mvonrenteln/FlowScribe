import { Loader2, Sparkles, StopCircle, Trash2 } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useTranscriptStore } from "@/lib/store";
import { AIBatchControlSection } from "./AIBatchControlSection";
import { AIConfigurationSection } from "./AIConfigurationSection";
import { AIResultsSection } from "./AIResultsSection";
import { useAiSettingsSelection } from "./hooks/useAiSettingsSelection";
import { useScopedSegments } from "./hooks/useScopedSegments";
import { ResultsList } from "./ResultsList";
import { ScopeSection } from "./ScopeSection";
import { createSegmentNavigator } from "./utils/segmentNavigator";
import { truncateText } from "./utils/truncateText";

interface RevisionPanelProps {
  filteredSegmentIds: string[];
  onOpenSettings: () => void;
}

export function RevisionPanel({ filteredSegmentIds, onOpenSettings }: RevisionPanelProps) {
  const [isLogOpen, setIsLogOpen] = useState(false);
  const [selectedPromptId, setSelectedPromptId] = useState("");
  const [excludeConfirmed, setExcludeConfirmed] = useState(true);
  const [batchSize, setBatchSize] = useState("10");
  const logDrawerRef = useRef<HTMLDivElement>(null);

  const segments = useTranscriptStore((s) => s.segments);
  const {
    prompts,
    defaultPromptId,
    selectedProviderId: storedProviderId,
    selectedModel: storedModel,
  } = useTranscriptStore((s) => s.aiRevisionConfig);
  const isProcessing = useTranscriptStore((s) => s.aiRevisionIsProcessing);
  const processedCount = useTranscriptStore((s) => s.aiRevisionProcessedCount);
  const totalToProcess = useTranscriptStore((s) => s.aiRevisionTotalToProcess);
  const error = useTranscriptStore((s) => s.aiRevisionError);
  const batchLog = useTranscriptStore((s) => s.aiRevisionBatchLog);
  const suggestions = useTranscriptStore((s) => s.aiRevisionSuggestions);
  const startBatchRevision = useTranscriptStore((s) => s.startBatchRevision);
  const cancelRevision = useTranscriptStore((s) => s.cancelRevision);
  const acceptAllRevisions = useTranscriptStore((s) => s.acceptAllRevisions);
  const rejectAllRevisions = useTranscriptStore((s) => s.rejectAllRevisions);
  const clearRevisions = useTranscriptStore((s) => s.clearRevisions);
  const updateRevisionConfig = useTranscriptStore((s) => s.updateRevisionConfig);
  const setSelectedSegmentId = useTranscriptStore((s) => s.setSelectedSegmentId);
  const setCurrentTime = useTranscriptStore((s) => s.setCurrentTime);
  const requestSeek = useTranscriptStore((s) => s.requestSeek);

  const { settings, selectedProviderId, selectedModel, selectProvider, setSelectedModel } =
    useAiSettingsSelection({
      initialProviderId: storedProviderId ?? "",
      initialModel: storedModel ?? "",
    });

  const { segmentById, scopedSegmentIds, isFiltered } = useScopedSegments({
    segments,
    filteredSegmentIds,
    excludeConfirmed,
  });

  const effectivePromptId = selectedPromptId || defaultPromptId || prompts[0]?.id;

  const selectedProvider = settings?.aiProviders.find((p) => p.id === selectedProviderId);
  const effectiveModel = selectedModel || selectedProvider?.model || "";
  const pendingSuggestions = suggestions.filter((s) => s.status === "pending");
  const pendingCount = suggestions.filter((s) => s.status === "pending").length;
  const acceptedCount = suggestions.filter((s) => s.status === "accepted").length;
  const rejectedCount = suggestions.filter((s) => s.status === "rejected").length;
  const revisedCount = batchLog.filter((entry) => entry.status === "revised").length;
  const unchangedCount = batchLog.filter((entry) => entry.status === "unchanged").length;
  const failedCount = batchLog.filter((entry) => entry.status === "failed").length;

  const scrollToSegment = useMemo(
    () =>
      createSegmentNavigator(segmentById, {
        setSelectedSegmentId,
        setCurrentTime,
        requestSeek,
      }),
    [segmentById, setSelectedSegmentId, setCurrentTime, requestSeek],
  );

  const handleStart = () => {
    if (!effectivePromptId || scopedSegmentIds.length === 0) return;
    updateRevisionConfig({
      selectedProviderId: selectedProviderId || undefined,
      selectedModel: selectedModel || undefined,
    });
    startBatchRevision(scopedSegmentIds, effectivePromptId);
  };

  return (
    <div className="space-y-6">
      <ScopeSection
        scopedSegmentCount={scopedSegmentIds.length}
        isFiltered={isFiltered}
        excludeConfirmed={excludeConfirmed}
        onExcludeConfirmedChange={setExcludeConfirmed}
        id="revision"
      />

      <AIConfigurationSection
        id="revision"
        settings={settings}
        selectedProviderId={selectedProviderId}
        selectedModel={effectiveModel}
        isProcessing={isProcessing}
        promptValue={effectivePromptId}
        promptOptions={prompts}
        batchSize={batchSize}
        onProviderChange={(value) => {
          selectProvider(value);
          updateRevisionConfig({
            selectedProviderId: value || undefined,
            selectedModel: undefined,
          });
        }}
        onModelChange={(value) => {
          setSelectedModel(value);
          updateRevisionConfig({ selectedModel: value || undefined });
        }}
        onPromptChange={setSelectedPromptId}
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
          icon: <Sparkles className="mr-2 h-4 w-4" />,
          onClick: handleStart,
          disabled: scopedSegmentIds.length === 0 || !effectivePromptId,
        }}
        stopAction={{
          label: "Stop",
          icon: <StopCircle className="mr-2 h-4 w-4" />,
          onClick: cancelRevision,
        }}
      >
        {(batchLog.length > 0 || isProcessing) && (
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>
              Batch log entries: {batchLog.length}
              {batchLog.length > 0
                ? ` • last update ${new Date(
                    batchLog[batchLog.length - 1].loggedAt,
                  ).toLocaleTimeString()}`
                : ""}
            </span>
            <Drawer open={isLogOpen} onOpenChange={setIsLogOpen}>
              <DrawerTrigger asChild>
                <Button variant="ghost" size="sm">
                  Batch Log
                </Button>
              </DrawerTrigger>
              <DrawerContent
                ref={logDrawerRef}
                className="max-h-[70vh]"
                tabIndex={-1}
                onOpenAutoFocus={(event) => {
                  event.preventDefault();
                  logDrawerRef.current?.focus();
                }}
              >
                <DrawerHeader>
                  <DrawerTitle>Batch Log</DrawerTitle>
                  <DrawerDescription className="sr-only">
                    Batch revision status updates and errors.
                  </DrawerDescription>
                </DrawerHeader>
                <div className="px-6 pb-6 overflow-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Segment</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Duration</TableHead>
                        <TableHead>Time</TableHead>
                        <TableHead>Error</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {batchLog.map((entry) => (
                        <TableRow key={`${entry.segmentId}-${entry.loggedAt}`}>
                          <TableCell>{entry.segmentId}</TableCell>
                          <TableCell className="capitalize">{entry.status}</TableCell>
                          <TableCell>
                            {entry.durationMs ? `${(entry.durationMs / 1000).toFixed(2)}s` : "-"}
                          </TableCell>
                          <TableCell>{new Date(entry.loggedAt).toLocaleTimeString()}</TableCell>
                          <TableCell>{entry.error ?? "—"}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </DrawerContent>
            </Drawer>
          </div>
        )}
      </AIBatchControlSection>

      {(pendingCount > 0 || acceptedCount > 0 || rejectedCount > 0) && (
        <AIResultsSection
          title="Results Summary"
          meta={
            batchLog.length > 0 ? (
              <div className="text-xs text-muted-foreground">
                Revised: {revisedCount} • Unchanged: {unchangedCount} • Failed: {failedCount}
              </div>
            ) : null
          }
        >
          <div className="text-sm text-muted-foreground">
            Pending: {pendingCount} • Accepted: {acceptedCount} • Rejected: {rejectedCount}
          </div>
          <ResultsList
            items={pendingSuggestions}
            getKey={(suggestion) => suggestion.segmentId}
            onActivate={(suggestion) => scrollToSegment(suggestion.segmentId)}
            getItemTitle={(suggestion) => segmentById.get(suggestion.segmentId)?.text}
            renderItem={(suggestion) => {
              const segment = segmentById.get(suggestion.segmentId);
              return (
                <>
                  <span className="flex-1 truncate text-muted-foreground min-w-0">
                    {segment ? truncateText(segment.text, 40) : suggestion.segmentId}
                  </span>
                  <span className="text-muted-foreground shrink-0">→</span>
                  <span className="flex-1 truncate text-muted-foreground min-w-0">
                    {truncateText(suggestion.revisedText, 40)}
                  </span>
                </>
              );
            }}
          />
          {pendingCount > 0 ? (
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                className="flex-1 text-destructive hover:text-destructive"
                onClick={rejectAllRevisions}
              >
                Reject All
              </Button>
              <Button size="sm" className="flex-1" onClick={acceptAllRevisions}>
                Accept All
              </Button>
            </div>
          ) : (
            <Button variant="outline" size="sm" className="w-full" onClick={clearRevisions}>
              <Trash2 className="mr-2 h-4 w-4" />
              Clear Results
            </Button>
          )}
        </AIResultsSection>
      )}

      {isProcessing && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          Running batch revision...
        </div>
      )}
    </div>
  );
}
