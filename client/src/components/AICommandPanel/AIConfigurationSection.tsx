import { AlertCircle, Settings2 } from "lucide-react";
import { Button } from "@/components/ui/button";
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
import type { PersistedSettings } from "@/lib/settings/settingsStorage";

interface PromptOption {
  id: string;
  name: string;
  isDefault?: boolean;
}

interface AIConfigurationSectionProps {
  id: string;
  settings: PersistedSettings | null;
  selectedProviderId: string;
  selectedModel: string;
  isProcessing: boolean;
  promptValue: string;
  promptOptions: PromptOption[];
  batchSize?: string;
  batchSizeLabel?: string;
  batchSizeMin?: number;
  batchSizeMax?: number;
  batchSizeHelp?: string;
  showBatchSize?: boolean;
  onProviderChange: (value: string) => void;
  onModelChange: (value: string) => void;
  onPromptChange: (value: string) => void;
  onBatchSizeChange?: (value: string) => void;
  onOpenSettings?: () => void;
}

export function AIConfigurationSection({
  id,
  settings,
  selectedProviderId,
  selectedModel,
  isProcessing,
  promptValue,
  promptOptions,
  batchSize = "1",
  batchSizeLabel = "Batch Size",
  batchSizeMin = 1,
  batchSizeMax = 50,
  batchSizeHelp = "Number of segments to process in each batch (1-50)",
  showBatchSize = true,
  onProviderChange,
  onModelChange,
  onPromptChange,
  onBatchSizeChange = () => {},
  onOpenSettings,
}: AIConfigurationSectionProps) {
  const selectedProvider = settings?.aiProviders.find((p) => p.id === selectedProviderId);
  const availableModels = selectedProvider?.availableModels ?? [];

  return (
    <section className="space-y-3">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        AI Configuration
      </h3>
      {settings && settings.aiProviders.length > 0 ? (
        <div className="space-y-2">
          <Label htmlFor={`${id}-provider`} className="text-xs text-muted-foreground">
            Provider
          </Label>
          <Select
            value={selectedProviderId}
            onValueChange={onProviderChange}
            disabled={isProcessing}
          >
            <SelectTrigger id={`${id}-provider`} className="h-8 text-sm">
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
          <Label htmlFor={`${id}-model`} className="text-xs text-muted-foreground">
            Model
          </Label>
          {availableModels.length > 0 ? (
            <Select
              value={selectedModel || selectedProvider.model || ""}
              onValueChange={onModelChange}
              disabled={isProcessing}
            >
              <SelectTrigger id={`${id}-model`} className="h-8 text-sm">
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
        <Label htmlFor={`${id}-prompt`} className="text-xs text-muted-foreground">
          Prompt
        </Label>
        <Select value={promptValue} onValueChange={onPromptChange} disabled={isProcessing}>
          <SelectTrigger id={`${id}-prompt`} className="h-8 text-sm">
            <SelectValue placeholder="Select prompt" />
          </SelectTrigger>
          <SelectContent>
            {promptOptions.map((prompt) => (
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

      {showBatchSize ? (
        <div className="flex flex-col gap-1">
          <Label htmlFor={`${id}-batch-size`} className="text-xs text-muted-foreground cursor-help">
            {batchSizeLabel}
          </Label>
          <div className="flex items-center gap-2">
            <div className="flex-1">
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Input
                      id={`${id}-batch-size`}
                      type="number"
                      min={batchSizeMin}
                      max={batchSizeMax}
                      value={batchSize}
                      onChange={(e) => {
                        const value = e.target.value;
                        // Allow empty and intermediate numeric input (so users can type multi-digit numbers).
                        // Only accept digits to avoid invalid characters from typing.
                        if (value === "" || /^\d*$/.test(value)) {
                          onBatchSizeChange(value);
                        }
                      }}
                      onBlur={(e) => {
                        const value = e.target.value;
                        // If empty, reset to min
                        if (value === "") {
                          onBatchSizeChange(String(batchSizeMin));
                          return;
                        }
                        const num = Number(value);
                        if (Number.isNaN(num)) {
                          onBatchSizeChange(String(batchSizeMin));
                          return;
                        }
                        // Clamp to bounds
                        if (num < batchSizeMin) {
                          onBatchSizeChange(String(batchSizeMin));
                        } else if (num > batchSizeMax) {
                          onBatchSizeChange(String(batchSizeMax));
                        } else {
                          onBatchSizeChange(String(num));
                        }
                      }}
                      disabled={isProcessing}
                      className="text-sm"
                    />
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>{batchSizeHelp}</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>

            {onOpenSettings ? (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="ghost" size="icon" onClick={onOpenSettings}>
                      <Settings2 className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Configure AI providers and prompts</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            ) : null}
          </div>
        </div>
      ) : (
        onOpenSettings && (
          <div className="flex justify-end">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="icon" onClick={onOpenSettings}>
                    <Settings2 className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Configure AI providers and prompts</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        )
      )}

      {settings && settings.aiProviders.length === 0 && (
        <div className="flex items-center gap-2 p-2 rounded-md bg-amber-100 text-amber-900 text-sm dark:bg-amber-900/20 dark:text-amber-200">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>No AI provider configured. Add one in Settings → AI → Server & Models.</span>
        </div>
      )}
    </section>
  );
}
