import { Loader2, Pause, Sparkles, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { initializeSettings, type PersistedSettings } from "@/lib/settings/settingsStorage";
import { useTranscriptStore } from "@/lib/store";

interface RevisionPanelProps {
  filteredSegmentIds: string[];
}

export function RevisionPanel({ filteredSegmentIds }: RevisionPanelProps) {
  const [settings, setSettings] = useState<PersistedSettings | null>(null);
  const [selectedProviderId, setSelectedProviderId] = useState("");
  const [selectedModel, setSelectedModel] = useState("");
  const [selectedPromptId, setSelectedPromptId] = useState("");
  const [excludeConfirmed, setExcludeConfirmed] = useState(true);
  const [batchSize, setBatchSize] = useState("10");

  useEffect(() => {
    const loadedSettings = initializeSettings();
    setSettings(loadedSettings);
    setSelectedProviderId(
      loadedSettings.defaultAIProviderId ?? loadedSettings.aiProviders[0]?.id ?? "",
    );
  }, []);

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

  const selectedProvider = settings?.aiProviders.find((p) => p.id === selectedProviderId);
  const availableModels = selectedProvider?.availableModels ?? [];
  const effectiveModel = selectedModel || selectedProvider?.model || "";

  const progressPercent = totalToProcess > 0 ? (processedCount / totalToProcess) * 100 : 0;
  const pendingCount = suggestions.filter((s) => s.status === "pending").length;
  const acceptedCount = suggestions.filter((s) => s.status === "accepted").length;
  const rejectedCount = suggestions.filter((s) => s.status === "rejected").length;

  const handleStart = () => {
    if (!effectivePromptId || scopedSegmentIds.length === 0) return;
    startBatchRevision(scopedSegmentIds, effectivePromptId);
  };

  return (
    <div className="space-y-6">
      <section className="space-y-2">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Scope
        </h3>
        <div className="text-sm text-foreground">
          Filtered: {scopedSegmentIds.length} segment
          {scopedSegmentIds.length === 1 ? "" : "s"}
        </div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Checkbox
            id="revision-exclude-confirmed"
            checked={excludeConfirmed}
            onCheckedChange={(value) => setExcludeConfirmed(Boolean(value))}
          />
          <Label htmlFor="revision-exclude-confirmed" className="text-sm text-muted-foreground">
            Exclude confirmed
          </Label>
        </div>
      </section>

      <section className="space-y-3">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          AI Configuration
        </h3>
        {settings && settings.aiProviders.length > 0 && (
          <div className="space-y-2">
            <Label htmlFor="revision-provider" className="text-xs text-muted-foreground">
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
              <SelectTrigger id="revision-provider" className="h-8 text-sm">
                <SelectValue placeholder="Select provider" />
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
        )}

        {selectedProvider && (
          <div className="space-y-2">
            <Label htmlFor="revision-model" className="text-xs text-muted-foreground">
              Model
            </Label>
            {availableModels.length > 0 ? (
              <Select
                value={effectiveModel}
                onValueChange={setSelectedModel}
                disabled={isProcessing}
              >
                <SelectTrigger id="revision-model" className="h-8 text-sm">
                  <SelectValue placeholder="Select model" />
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
          <Label htmlFor="revision-batch-size" className="text-xs text-muted-foreground">
            Batch Size
          </Label>
          <Select value={batchSize} onValueChange={setBatchSize} disabled={isProcessing}>
            <SelectTrigger id="revision-batch-size" className="h-8 text-sm">
              <SelectValue placeholder="Batch size" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="10">10 segments</SelectItem>
              <SelectItem value="20">20 segments</SelectItem>
              <SelectItem value="50">50 segments</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </section>

      <section className="space-y-3">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Revision Settings
        </h3>
        <div className="space-y-2">
          <Label htmlFor="revision-template" className="text-xs text-muted-foreground">
            Template
          </Label>
          <Select
            value={effectivePromptId}
            onValueChange={setSelectedPromptId}
            disabled={isProcessing}
          >
            <SelectTrigger id="revision-template" className="h-8 text-sm">
              <SelectValue placeholder="Select template" />
            </SelectTrigger>
            <SelectContent>
              {prompts.map((prompt) => (
                <SelectItem key={prompt.id} value={prompt.id}>
                  {prompt.name}
                  {prompt.isDefault && (
                    <span className="ml-2 text-xs text-muted-foreground">(Default)</span>
                  )}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </section>

      {!isProcessing ? (
        <Button
          className="w-full"
          onClick={handleStart}
          disabled={scopedSegmentIds.length === 0 || !effectivePromptId}
        >
          <Sparkles className="mr-2 h-4 w-4" />
          Start Batch
        </Button>
      ) : (
        <div className="space-y-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span>Processing</span>
              <span>
                {processedCount} / {totalToProcess}
              </span>
            </div>
            <Progress value={progressPercent} className="h-2" />
            <div className="text-xs text-muted-foreground">
              {Math.round(progressPercent)}% complete
            </div>
          </div>

          <div className="flex gap-2">
            <Button variant="outline" size="sm" className="flex-1" onClick={cancelRevision}>
              <Pause className="mr-1.5 h-4 w-4" />
              Stop
            </Button>
          </div>
        </div>
      )}

      {error && (
        <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </div>
      )}

      {(pendingCount > 0 || acceptedCount > 0 || rejectedCount > 0) && (
        <section className="space-y-3">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Results Summary
          </h3>
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
        </section>
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
