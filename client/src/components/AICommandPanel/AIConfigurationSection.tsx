import { AlertCircle, Settings2 } from "lucide-react";
import { useTranslation } from "react-i18next";
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
  batchSizeLabel,
  batchSizeMin = 1,
  batchSizeMax = 50,
  batchSizeHelp,
  showBatchSize = true,
  onProviderChange,
  onModelChange,
  onPromptChange,
  onBatchSizeChange = () => {},
  onOpenSettings,
}: AIConfigurationSectionProps) {
  const { t } = useTranslation();
  const selectedProvider = settings?.aiProviders.find((p) => p.id === selectedProviderId);
  const availableModels = selectedProvider?.availableModels ?? [];
  const resolvedBatchSizeLabel = batchSizeLabel ?? t("aiBatch.config.batchSizeLabel");
  const resolvedBatchSizeHelp = batchSizeHelp ?? t("aiBatch.config.batchSizeHelp");

  return (
    <section className="space-y-3">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {t("aiBatch.config.title")}
      </h3>
      {settings && settings.aiProviders.length > 0 ? (
        <div className="space-y-2">
          <Label htmlFor={`${id}-provider`} className="text-xs text-muted-foreground">
            {t("aiBatch.config.providerLabel")}
          </Label>
          <Select
            value={selectedProviderId}
            onValueChange={onProviderChange}
            disabled={isProcessing}
          >
            <SelectTrigger id={`${id}-provider`} className="h-8 text-sm">
              <SelectValue placeholder={t("aiBatch.config.providerPlaceholder")} />
            </SelectTrigger>
            <SelectContent>
              {settings.aiProviders.map((provider) => (
                <SelectItem key={provider.id} value={provider.id}>
                  {provider.name}
                  {provider.isDefault && (
                    <span className="ml-2 text-xs text-muted-foreground">
                      ({t("aiBatch.config.defaultBadge")})
                    </span>
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
            {t("aiBatch.config.modelLabel")}
          </Label>
          {availableModels.length > 0 ? (
            <Select
              value={selectedModel || selectedProvider.model || ""}
              onValueChange={onModelChange}
              disabled={isProcessing}
            >
              <SelectTrigger id={`${id}-model`} className="h-8 text-sm">
                <SelectValue placeholder={t("aiBatch.config.modelPlaceholder")} />
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
              {selectedProvider.model || t("aiBatch.config.noModelConfigured")}
            </div>
          )}
        </div>
      )}

      <div className="space-y-2">
        <Label htmlFor={`${id}-prompt`} className="text-xs text-muted-foreground">
          {t("aiBatch.config.promptLabel")}
        </Label>
        <Select value={promptValue} onValueChange={onPromptChange} disabled={isProcessing}>
          <SelectTrigger id={`${id}-prompt`} className="h-8 text-sm">
            <SelectValue placeholder={t("aiBatch.config.promptPlaceholder")} />
          </SelectTrigger>
          <SelectContent>
            {promptOptions.map((prompt) => (
              <SelectItem key={prompt.id} value={prompt.id}>
                {prompt.name}
                {prompt.isDefault && (
                  <span className="ml-2 text-xs text-muted-foreground">
                    ({t("aiBatch.config.defaultBadge")})
                  </span>
                )}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {showBatchSize ? (
        <div className="flex flex-col gap-1">
          <Label htmlFor={`${id}-batch-size`} className="text-xs text-muted-foreground cursor-help">
            {resolvedBatchSizeLabel}
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
                    <p>{resolvedBatchSizeHelp}</p>
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
                    <p>{t("aiBatch.config.settingsTooltip")}</p>
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
                  <p>{t("aiBatch.config.settingsTooltip")}</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        )
      )}

      {settings && settings.aiProviders.length === 0 && (
        <div className="flex items-center gap-2 p-2 rounded-md bg-amber-100 text-amber-900 text-sm dark:bg-amber-900/20 dark:text-amber-200">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{t("aiBatch.config.noProviderConfigured")}</span>
        </div>
      )}
    </section>
  );
}
