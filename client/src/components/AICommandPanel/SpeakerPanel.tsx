import { AlertCircle, Check, Pause, Play, Settings2, Sparkles, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
import { cn } from "@/lib/utils";

interface SpeakerPanelProps {
  onOpenSettings: () => void;
}

export function SpeakerPanel({ onOpenSettings }: SpeakerPanelProps) {
  const speakers = useTranscriptStore((s) => s.speakers);
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
  const acceptSuggestion = useTranscriptStore((s) => s.acceptSuggestion);
  const rejectSuggestion = useTranscriptStore((s) => s.rejectSuggestion);
  const clearSuggestions = useTranscriptStore((s) => s.clearSuggestions);
  const updateConfig = useTranscriptStore((s) => s.updateConfig);
  const setActivePrompt = useTranscriptStore((s) => s.setActivePrompt);

  const [isLogOpen, setIsLogOpen] = useState(false);
  const [selectedSpeakers, setSelectedSpeakers] = useState<string[]>([]);
  const [excludeConfirmed, setExcludeConfirmed] = useState(true);
  const [batchSize, setBatchSize] = useState(config.batchSize.toString());
  const [settings, setSettings] = useState<PersistedSettings | null>(null);
  const [selectedProviderId, setSelectedProviderId] = useState<string>(
    config.selectedProviderId ?? "",
  );
  const [selectedModel, setSelectedModel] = useState<string>(config.selectedModel ?? "");

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
    updateConfig({
      batchSize: Number.parseInt(batchSize, 10) || 10,
      selectedProviderId: selectedProviderId || undefined,
      selectedModel: selectedModel || undefined,
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

  return (
    <div className="space-y-5">
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Scope
          </h3>
          <Button variant="ghost" size="sm" onClick={handleSelectAllSpeakers}>
            {selectedSpeakers.length === speakers.length ? "Deselect All" : "Select All"}
          </Button>
        </div>
        <div className="flex flex-wrap gap-2">
          {speakers.map((speaker) => {
            const isSelected = selectedSpeakers.includes(speaker.name);
            return (
              <button
                key={speaker.id}
                type="button"
                className={cn(
                  "flex items-center gap-2 px-2 py-1 text-xs rounded-md border",
                  isSelected
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-muted text-muted-foreground",
                )}
                onClick={() => handleSpeakerToggle(speaker.name)}
              >
                <span className="h-2 w-2 rounded-full" style={{ backgroundColor: speaker.color }} />
                {speaker.name}
              </button>
            );
          })}
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

        <div className="flex items-center gap-2">
          <Label className="text-xs text-muted-foreground">Batch Size</Label>
          <Input
            id="batch-size"
            type="number"
            min={1}
            max={50}
            value={batchSize}
            onChange={(e) => setBatchSize(e.target.value)}
            className="w-20 h-8"
          />
          <span className="text-xs text-muted-foreground">segments</span>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="sm" className="ml-auto" onClick={onOpenSettings}>
                  <Settings2 className="h-4 w-4 mr-1" />
                  Settings
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Configure AI providers and prompts in Settings</p>
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
        <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Speaker Settings
        </h3>
        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground">Prompt Template</Label>
          <Select value={config.activePromptId} onValueChange={(value) => setActivePrompt(value)}>
            <SelectTrigger className="h-8 text-sm">
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
              <Pause className="h-4 w-4 mr-2" />
              Stop Analysis
            </Button>
          ) : (
            <Button
              onClick={handleStartAnalysis}
              disabled={segments.length === 0}
              className="flex-1"
            >
              <Play className="h-4 w-4 mr-2" />
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

          <div className="space-y-2">
            {pendingSuggestions.map((suggestion) => (
              <div
                key={suggestion.segmentId}
                className="flex items-start gap-2 rounded-md border border-muted bg-muted/30 px-3 py-2"
              >
                <div className="flex-1">
                  <div className="flex items-center gap-2 text-sm font-medium">
                    <Sparkles className="h-3.5 w-3.5 text-yellow-500" />
                    {suggestion.currentSpeaker} → {suggestion.suggestedSpeaker}
                    <span className="text-xs text-muted-foreground">
                      {suggestion.confidence !== undefined
                        ? `${(suggestion.confidence * 100).toFixed(0)}%`
                        : "—"}
                    </span>
                  </div>
                  {suggestion.reason && (
                    <div className="mt-1 text-xs text-muted-foreground">{suggestion.reason}</div>
                  )}
                </div>
                <div className="flex flex-col gap-1">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => acceptSuggestion(suggestion.segmentId)}
                  >
                    <Check className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => rejectSuggestion(suggestion.segmentId)}
                  >
                    ✗
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
