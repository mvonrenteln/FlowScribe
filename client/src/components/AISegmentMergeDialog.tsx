/**
 * AI Segment Merge Dialog
 *
 * Dialog for running AI-powered segment merge analysis.
 * Features: AI provider selection, analysis options,
 * progress tracking, and suggestions list with accept/reject controls.
 */

import {
  AlertCircle,
  Check,
  CheckCheck,
  ChevronDown,
  ChevronRight,
  GitMerge,
  Pause,
  Play,
  Settings2,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import { useEffect, useState } from "react";
import { MergeSuggestionDiff } from "@/components/merge/MergeSuggestionDiff";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { formatDurationMs } from "@/lib/formatting";
import { initializeSettings, type PersistedSettings } from "@/lib/settings/settingsStorage";
import { useTranscriptStore } from "@/lib/store";
import type { AISegmentMergeSuggestion } from "@/lib/store/types";

interface AISegmentMergeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Callback to open settings sheet */
  onOpenSettings?: () => void;
}

export function AISegmentMergeDialog({
  open,
  onOpenChange,
  onOpenSettings,
}: AISegmentMergeDialogProps) {
  // Store state
  const segments = useTranscriptStore((s) => s.segments);
  const suggestions = useTranscriptStore((s) => s.aiSegmentMergeSuggestions);
  const isProcessing = useTranscriptStore((s) => s.aiSegmentMergeIsProcessing);
  const processedCount = useTranscriptStore((s) => s.aiSegmentMergeProcessedCount);
  const totalToProcess = useTranscriptStore((s) => s.aiSegmentMergeTotalToProcess);
  const config = useTranscriptStore((s) => s.aiSegmentMergeConfig);
  const error = useTranscriptStore((s) => s.aiSegmentMergeError);

  // Store actions
  const startMergeAnalysis = useTranscriptStore((s) => s.startMergeAnalysis);
  const cancelMergeAnalysis = useTranscriptStore((s) => s.cancelMergeAnalysis);
  const acceptMergeSuggestion = useTranscriptStore((s) => s.acceptMergeSuggestion);
  const rejectMergeSuggestion = useTranscriptStore((s) => s.rejectMergeSuggestion);
  const acceptAllHighConfidence = useTranscriptStore((s) => s.acceptAllHighConfidence);
  const rejectAllSuggestions = useTranscriptStore((s) => s.rejectAllSuggestions);
  const clearMergeSuggestions = useTranscriptStore((s) => s.clearMergeSuggestions);
  const updateMergeConfig = useTranscriptStore((s) => s.updateMergeConfig);

  // Local state
  const [settings, setSettings] = useState<PersistedSettings | null>(null);
  const [selectedProviderId, setSelectedProviderId] = useState<string>(
    config.selectedProviderId ?? "",
  );
  const [selectedModel, setSelectedModel] = useState<string>(config.selectedModel ?? "");
  const [maxTimeGap, setMaxTimeGap] = useState(config.defaultMaxTimeGap.toString());
  const [minConfidence, setMinConfidence] = useState<"high" | "medium" | "low">(
    config.defaultMinConfidence,
  );
  const [sameSpeakerOnly, setSameSpeakerOnly] = useState(true);
  const [enableSmoothing, setEnableSmoothing] = useState(config.defaultEnableSmoothing);
  const [batchSize, setBatchSize] = useState(10);

  // Collapsible state for confidence groups
  const [highOpen, setHighOpen] = useState(true);
  const [mediumOpen, setMediumOpen] = useState(true);
  const [lowOpen, setLowOpen] = useState(false);

  // Load settings on open
  useEffect(() => {
    if (open) {
      const loadedSettings = initializeSettings();
      setSettings(loadedSettings);

      // Validate and set provider
      let providerId = selectedProviderId;
      const providerExists = loadedSettings.aiProviders.some((p) => p.id === providerId);

      if (!providerExists) {
        providerId = loadedSettings.defaultAIProviderId ?? loadedSettings.aiProviders[0]?.id ?? "";
        setSelectedProviderId(providerId);
      }

      if (!providerId && loadedSettings.defaultAIProviderId) {
        setSelectedProviderId(loadedSettings.defaultAIProviderId);
      }
    }
  }, [open, selectedProviderId]);

  // Update model when provider changes
  useEffect(() => {
    if (selectedProviderId && settings) {
      const provider = settings.aiProviders.find((p) => p.id === selectedProviderId);
      if (provider) {
        const availableModels = provider.availableModels ?? [];
        if (selectedModel && availableModels.includes(selectedModel)) {
          // Keep current selection
        } else {
          setSelectedModel(provider.model || (availableModels[0] ?? ""));
        }
      }
    }
  }, [selectedProviderId, settings, selectedModel]);

  // Get provider info
  const selectedProvider = settings?.aiProviders.find((p) => p.id === selectedProviderId);
  const availableModels = selectedProvider?.availableModels ?? [];

  // Filter suggestions by status
  const pendingSuggestions = suggestions.filter((s) => s.status === "pending");
  const highConfidence = pendingSuggestions.filter((s) => s.confidence === "high");
  const mediumConfidence = pendingSuggestions.filter((s) => s.confidence === "medium");
  const lowConfidence = pendingSuggestions.filter((s) => s.confidence === "low");

  const progressPercent =
    totalToProcess > 0 ? Math.round((processedCount / totalToProcess) * 100) : 0;

  // Handlers
  const handleStartAnalysis = () => {
    updateMergeConfig({
      selectedProviderId: selectedProviderId || undefined,
      selectedModel: selectedModel || undefined,
    });

    startMergeAnalysis({
      maxTimeGap: Number.parseFloat(maxTimeGap) || 2.0,
      minConfidence,
      sameSpeakerOnly,
      enableSmoothing,
      batchSize: batchSize || 10,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <GitMerge className="h-5 w-5" />
            AI Segment Merge Analysis
          </DialogTitle>
          <DialogDescription>
            Analyze transcript for segments that should be merged together.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 min-h-0 flex flex-col space-y-4 overflow-y-auto">
          {/* Options */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label className="text-sm">Max Time Gap (seconds)</Label>
              <Input
                type="number"
                min={0.1}
                max={10}
                step={0.1}
                value={maxTimeGap}
                onChange={(e) => setMaxTimeGap(e.target.value)}
                className="w-full"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-sm">Batch Size</Label>
              <Input
                type="number"
                min={5}
                max={50}
                step={5}
                value={batchSize}
                onChange={(e) => setBatchSize(Number.parseInt(e.target.value, 10) || 10)}
                className="w-full"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-sm">Min Confidence</Label>
              <Select
                value={minConfidence}
                onValueChange={(v) => setMinConfidence(v as typeof minConfidence)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="high">High only</SelectItem>
                  <SelectItem value="medium">Medium and above</SelectItem>
                  <SelectItem value="low">All (including low)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2">
              <Checkbox
                id="same-speaker"
                checked={sameSpeakerOnly}
                onCheckedChange={(checked) => setSameSpeakerOnly(Boolean(checked))}
              />
              <Label htmlFor="same-speaker" className="text-sm cursor-pointer">
                Same speaker only
              </Label>
            </div>
            <div className="flex items-center gap-2">
              <Checkbox
                id="enable-smoothing"
                checked={enableSmoothing}
                onCheckedChange={(checked) => setEnableSmoothing(Boolean(checked))}
              />
              <Label htmlFor="enable-smoothing" className="text-sm cursor-pointer">
                Enable text smoothing
              </Label>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger>
                    <Sparkles className="h-3 w-3 text-muted-foreground" />
                  </TooltipTrigger>
                  <TooltipContent>
                    <p className="max-w-xs">
                      AI will suggest grammatical fixes for merged text (e.g., fix incorrect
                      sentence breaks, punctuation)
                    </p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
          </div>

          {/* AI Provider & Model Selection */}
          <div className="grid gap-2 sm:grid-cols-2">
            <div className="space-y-1">
              <Label className="text-sm">AI Provider</Label>
              <Select value={selectedProviderId} onValueChange={setSelectedProviderId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select provider..." />
                </SelectTrigger>
                <SelectContent>
                  {settings?.aiProviders.map((provider) => (
                    <SelectItem key={provider.id} value={provider.id}>
                      {provider.name}
                      {provider.isDefault && " ⭐"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-sm">Model</Label>
              <Select
                value={selectedModel}
                onValueChange={setSelectedModel}
                disabled={availableModels.length === 0}
              >
                <SelectTrigger>
                  <SelectValue
                    placeholder={
                      availableModels.length === 0
                        ? "No models - configure in Settings"
                        : "Select model..."
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  {availableModels.map((model) => (
                    <SelectItem key={model} value={model}>
                      {model === selectedProvider?.model && "★ "}
                      {model}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Settings Link */}
          <div className="flex items-center justify-end">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                if (onOpenSettings) {
                  onOpenChange(false);
                  onOpenSettings();
                }
              }}
              disabled={!onOpenSettings}
            >
              <Settings2 className="h-4 w-4 mr-1" />
              Settings
            </Button>
          </div>

          {!selectedProviderId && settings?.aiProviders.length === 0 && (
            <div className="flex items-center gap-2 p-2 rounded-md bg-amber-100 text-amber-900 text-sm dark:bg-amber-900/20 dark:text-amber-200">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>No AI provider configured. Add one in Settings → AI → Server & Models.</span>
            </div>
          )}

          {/* Progress & Control */}
          <div className="space-y-2">
            {isProcessing && (
              <div className="space-y-1">
                <div className="flex items-center justify-between text-sm">
                  <span>Analyzing...</span>
                  <span>
                    {processedCount} / {totalToProcess} segment pairs
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

            <div className="flex items-center gap-2">
              {isProcessing ? (
                <Button onClick={cancelMergeAnalysis} variant="destructive">
                  <Pause className="h-4 w-4 mr-2" />
                  Stop
                </Button>
              ) : (
                <Button
                  onClick={handleStartAnalysis}
                  disabled={segments.length < 2 || !selectedProviderId}
                >
                  <Play className="h-4 w-4 mr-2" />
                  Start Batch
                </Button>
              )}
              {pendingSuggestions.length > 0 && (
                <>
                  <Button variant="outline" onClick={acceptAllHighConfidence}>
                    <Check className="h-4 w-4 mr-2" />
                    Accept All High ({highConfidence.length})
                  </Button>
                  <Button variant="ghost" onClick={clearMergeSuggestions}>
                    <Trash2 className="h-4 w-4 mr-2" />
                    Clear
                  </Button>
                </>
              )}
            </div>
          </div>

          {/* Suggestions List */}
          {pendingSuggestions.length > 0 && (
            <div className="flex-1 min-h-0 flex flex-col space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-medium">
                  Merge Suggestions ({pendingSuggestions.length} pending)
                </Label>
                <Button variant="ghost" size="sm" onClick={rejectAllSuggestions}>
                  Reject All
                </Button>
              </div>

              <div className="max-h-[300px] overflow-y-auto rounded-md border space-y-1 p-2">
                {/* High Confidence */}
                {highConfidence.length > 0 && (
                  <ConfidenceGroup
                    label="High Confidence"
                    level="high"
                    suggestions={highConfidence}
                    segments={segments}
                    isOpen={highOpen}
                    onToggle={() => setHighOpen(!highOpen)}
                    onAccept={acceptMergeSuggestion}
                    onAcceptWithoutSmoothing={(id) =>
                      acceptMergeSuggestion(id, { applySmoothing: false })
                    }
                    onReject={rejectMergeSuggestion}
                  />
                )}

                {/* Medium Confidence */}
                {mediumConfidence.length > 0 && (
                  <ConfidenceGroup
                    label="Medium Confidence"
                    level="medium"
                    suggestions={mediumConfidence}
                    segments={segments}
                    isOpen={mediumOpen}
                    onToggle={() => setMediumOpen(!mediumOpen)}
                    onAccept={acceptMergeSuggestion}
                    onAcceptWithoutSmoothing={(id) =>
                      acceptMergeSuggestion(id, { applySmoothing: false })
                    }
                    onReject={rejectMergeSuggestion}
                  />
                )}

                {/* Low Confidence */}
                {lowConfidence.length > 0 && (
                  <ConfidenceGroup
                    label="Low Confidence"
                    level="low"
                    suggestions={lowConfidence}
                    segments={segments}
                    isOpen={lowOpen}
                    onToggle={() => setLowOpen(!lowOpen)}
                    onAccept={acceptMergeSuggestion}
                    onAcceptWithoutSmoothing={(id) =>
                      acceptMergeSuggestion(id, { applySmoothing: false })
                    }
                    onReject={rejectMergeSuggestion}
                  />
                )}
              </div>
            </div>
          )}

          {/* No suggestions message */}
          {!isProcessing && suggestions.length === 0 && processedCount > 0 && (
            <div className="text-center text-muted-foreground py-4">
              No merge candidates found. Try adjusting the time gap or confidence settings.
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ==================== Confidence Group Component ====================

interface ConfidenceGroupProps {
  label: string;
  level: "high" | "medium" | "low";
  suggestions: AISegmentMergeSuggestion[];
  segments: Array<{ id: string; text: string; speaker: string }>;
  isOpen: boolean;
  onToggle: () => void;
  onAccept: (id: string) => void;
  onAcceptWithoutSmoothing: (id: string) => void;
  onReject: (id: string) => void;
}

function ConfidenceGroup({
  label,
  level,
  suggestions,
  segments,
  isOpen,
  onToggle,
  onAccept,
  onAcceptWithoutSmoothing,
  onReject,
}: ConfidenceGroupProps) {
  const badgeVariant = level === "high" ? "default" : level === "medium" ? "secondary" : "outline";
  const icon = level === "high" ? "🟢" : level === "medium" ? "🟡" : "🔴";

  return (
    <Collapsible open={isOpen} onOpenChange={onToggle}>
      <CollapsibleTrigger asChild>
        <Button variant="ghost" className="w-full justify-between p-2 h-auto">
          <div className="flex items-center gap-2">
            {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            <span>{icon}</span>
            <span className="font-medium">{label}</span>
            <Badge variant={badgeVariant}>{suggestions.length}</Badge>
          </div>
        </Button>
      </CollapsibleTrigger>
      <CollapsibleContent className="space-y-2 pt-2">
        {suggestions.map((suggestion) => (
          <MergeSuggestionCard
            key={suggestion.id}
            suggestion={suggestion}
            segments={segments}
            onAccept={() => onAccept(suggestion.id)}
            onAcceptWithoutSmoothing={() => onAcceptWithoutSmoothing(suggestion.id)}
            onReject={() => onReject(suggestion.id)}
          />
        ))}
      </CollapsibleContent>
    </Collapsible>
  );
}

// ==================== Suggestion Card Component ====================

interface MergeSuggestionCardProps {
  suggestion: AISegmentMergeSuggestion;
  segments: Array<{ id: string; text: string; speaker: string }>;
  onAccept: () => void;
  onAcceptWithoutSmoothing: () => void;
  onReject: () => void;
}

function MergeSuggestionCard({
  suggestion,
  segments,
  onAccept,
  onAcceptWithoutSmoothing,
  onReject,
}: MergeSuggestionCardProps) {
  const relevantSegments = suggestion.segmentIds
    .map((id) => segments.find((s) => s.id === id))
    .filter(Boolean);

  if (relevantSegments.length < 2) return null;

  const hasSmoothing =
    Boolean(suggestion.smoothedText) && suggestion.smoothedText !== suggestion.mergedText;
  const combinedText = relevantSegments
    .map((seg) => seg?.text ?? "")
    .join(" ")
    .trim();
  const boundaryIndex = relevantSegments[0]?.text.length ?? 0;
  const proposedText = hasSmoothing
    ? (suggestion.smoothedText ?? suggestion.mergedText)
    : suggestion.mergedText;
  const AcceptIcon = hasSmoothing ? CheckCheck : Check;

  return (
    <div className="rounded-md border p-3 space-y-2 bg-background">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1 space-y-2">
          <MergeSuggestionDiff
            originalText={combinedText}
            suggestedText={proposedText}
            originalLabel="Original"
            suggestedLabel={hasSmoothing ? "Smoothed" : "Merged"}
            boundaryIndex={boundaryIndex}
            allowSideBySide={hasSmoothing}
          />

          {/* Smoothing info */}
          {hasSmoothing && suggestion.smoothingChanges && (
            <div className="flex items-center gap-1 text-xs text-primary">
              <Sparkles className="h-3 w-3" />
              {suggestion.smoothingChanges}
            </div>
          )}

          {/* Meta info */}
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <span>Speaker: {suggestion.speaker}</span>
            <span>•</span>
            <span>Gap: {formatDurationMs(Math.round(suggestion.timeGap * 1000))}</span>
            <span>•</span>
            <span>{Math.round(suggestion.confidenceScore * 100)}% confidence</span>
            {suggestion.reason && (
              <>
                <span>•</span>
                <span className="italic">{suggestion.reason}</span>
              </>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1 shrink-0">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-destructive hover:text-destructive hover:bg-destructive/10"
                  onClick={onReject}
                >
                  <X className="mr-1 h-3.5 w-3.5" />
                  Reject
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Reject this merge suggestion</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
          {hasSmoothing && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-muted-foreground"
                    onClick={onAcceptWithoutSmoothing}
                  >
                    <Check className="h-3.5 w-3.5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Accept the merge without smoothing</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button size="sm" onClick={onAccept}>
                  <AcceptIcon className="mr-1 h-3.5 w-3.5" />
                  Accept
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>{hasSmoothing ? "Accept the smoothed merge text" : "Accept this merge"}</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </div>
    </div>
  );
}
