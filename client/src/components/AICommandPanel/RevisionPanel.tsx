import { Loader2, Sparkles, StopCircle, Trash2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  initializeSettings,
  type PersistedSettings,
  SETTINGS_UPDATED_EVENT,
} from "@/lib/settings/settingsStorage";
import { useTranscriptStore } from "@/lib/store";
import { AIBatchControlSection } from "./AIBatchControlSection";
import { AIConfigurationSection } from "./AIConfigurationSection";
import { AIResultsSection } from "./AIResultsSection";
import { ScopeSection } from "./ScopeSection";

interface RevisionPanelProps {
  filteredSegmentIds: string[];
  onOpenSettings: () => void;
}

export function RevisionPanel({ filteredSegmentIds, onOpenSettings }: RevisionPanelProps) {
  const [settings, setSettings] = useState<PersistedSettings | null>(null);
  const [selectedProviderId, setSelectedProviderId] = useState("");
  const [selectedModel, setSelectedModel] = useState("");
  const [selectedPromptId, setSelectedPromptId] = useState("");
  const [excludeConfirmed, setExcludeConfirmed] = useState(true);
  const [batchSize, setBatchSize] = useState("10");

  const refreshSettings = useCallback(() => {
    const loadedSettings = initializeSettings();
    setSettings(loadedSettings);
    let providerId = selectedProviderId;
    const providerExists = loadedSettings.aiProviders.some((p) => p.id === providerId);

    if (!providerExists) {
      providerId = loadedSettings.defaultAIProviderId ?? loadedSettings.aiProviders[0]?.id ?? "";
    }

    if (!providerId && loadedSettings.defaultAIProviderId) {
      providerId = loadedSettings.defaultAIProviderId;
    }

    if (providerId !== selectedProviderId) {
      setSelectedProviderId(providerId);
    }
  }, [selectedProviderId]);

  useEffect(() => {
    refreshSettings();

    const handleSettingsUpdate = () => {
      refreshSettings();
    };

    window.addEventListener(SETTINGS_UPDATED_EVENT, handleSettingsUpdate);
    return () => {
      window.removeEventListener(SETTINGS_UPDATED_EVENT, handleSettingsUpdate);
    };
  }, [refreshSettings]);

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

  const segments = useTranscriptStore((s) => s.segments);
  const prompts = useTranscriptStore((s) => s.aiRevisionConfig.prompts);
  const defaultPromptId = useTranscriptStore((s) => s.aiRevisionConfig.defaultPromptId);
  const isProcessing = useTranscriptStore((s) => s.aiRevisionIsProcessing);
  const processedCount = useTranscriptStore((s) => s.aiRevisionProcessedCount);
  const totalToProcess = useTranscriptStore((s) => s.aiRevisionTotalToProcess);
  const error = useTranscriptStore((s) => s.aiRevisionError);
  const suggestions = useTranscriptStore((s) => s.aiRevisionSuggestions);
  const startBatchRevision = useTranscriptStore((s) => s.startBatchRevision);
  const cancelRevision = useTranscriptStore((s) => s.cancelRevision);
  const acceptAllRevisions = useTranscriptStore((s) => s.acceptAllRevisions);
  const rejectAllRevisions = useTranscriptStore((s) => s.rejectAllRevisions);
  const clearRevisions = useTranscriptStore((s) => s.clearRevisions);

  const segmentById = useMemo(() => new Map(segments.map((s) => [s.id, s])), [segments]);
  const effectivePromptId = selectedPromptId || defaultPromptId || prompts[0]?.id;

  const scopedSegmentIds = useMemo(
    () =>
      filteredSegmentIds.filter((id) => {
        const segment = segmentById.get(id);
        if (!segment) return false;
        return !excludeConfirmed || !segment.confirmed;
      }),
    [excludeConfirmed, filteredSegmentIds, segmentById],
  );

  // Check if we're working with filtered subset (less than total segments)
  const isFiltered =
    filteredSegmentIds.length < segments.length ||
    scopedSegmentIds.length < filteredSegmentIds.length;

  const selectedProvider = settings?.aiProviders.find((p) => p.id === selectedProviderId);
  const effectiveModel = selectedModel || selectedProvider?.model || "";
  const pendingCount = suggestions.filter((s) => s.status === "pending").length;
  const acceptedCount = suggestions.filter((s) => s.status === "accepted").length;
  const rejectedCount = suggestions.filter((s) => s.status === "rejected").length;

  const handleStart = () => {
    if (!effectivePromptId || scopedSegmentIds.length === 0) return;
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
        promptLabel="Template"
        promptValue={effectivePromptId}
        promptOptions={prompts}
        batchSize={batchSize}
        onProviderChange={(id) => {
          setSelectedProviderId(id);
          setSelectedModel("");
        }}
        onModelChange={setSelectedModel}
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
          label: "Stop Revision",
          icon: <StopCircle className="mr-2 h-4 w-4" />,
          onClick: cancelRevision,
        }}
      />

      {(pendingCount > 0 || acceptedCount > 0 || rejectedCount > 0) && (
        <AIResultsSection title="Results Summary">
          <div className="text-sm text-muted-foreground">
            Pending: {pendingCount} • Accepted: {acceptedCount} • Rejected: {rejectedCount}
          </div>
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
