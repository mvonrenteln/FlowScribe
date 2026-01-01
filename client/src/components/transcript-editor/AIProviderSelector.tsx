/**
 * AI Provider Selector
 *
 * Compact dropdown for selecting AI provider and model.
 * Used in toolbar/sidebar for quick provider switching.
 */

import { Bot, ChevronDown, Server } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { type AIProviderConfig, createAIProvider } from "@/lib/services/aiProviderService";
import {
  initializeSettings,
  updateProviderModel,
  updateSettingsDefaultProvider,
} from "@/lib/settings/settingsStorage";
import { cn } from "@/lib/utils";

interface AIProviderSelectorProps {
  className?: string;
  compact?: boolean;
}

export function AIProviderSelector({ className, compact }: AIProviderSelectorProps) {
  const [settings, setSettings] = useState(() => initializeSettings());
  const [availableModels, setAvailableModels] = useState<Map<string, string[]>>(new Map());
  const [loadingModels, setLoadingModels] = useState<Set<string>>(new Set());

  const providerModelCache = availableModels;

  const getProviderModels = (providerId: string) => providerModelCache.get(providerId) ?? [];

  // Get current provider
  const currentProvider =
    settings.aiProviders.find((p) => p.id === settings.defaultAIProviderId) ??
    settings.aiProviders[0];

  // Fetch models for a provider
  const fetchModelsForProvider = async (provider: AIProviderConfig) => {
    if (loadingModels.has(provider.id)) return;
    if (availableModels.has(provider.id)) return;

    try {
      setLoadingModels((prev) => new Set([...prev, provider.id]));
      const aiProvider = createAIProvider(provider);
      const models = await aiProvider.listModels();
      setAvailableModels((prev) => new Map([...prev, [provider.id, models]]));
    } catch (error) {
      console.warn("[AIProviderSelector] Failed to fetch models:", error);
      // Use the currently configured model as fallback
      setAvailableModels(
        (prev) => new Map([...prev, [provider.id, provider.model ? [provider.model] : []]]),
      );
    } finally {
      setLoadingModels((prev) => {
        const next = new Set(prev);
        next.delete(provider.id);
        return next;
      });
    }
  };

  // Fetch models when dropdown opens
  const handleOpenChange = (open: boolean) => {
    if (open && currentProvider) {
      fetchModelsForProvider(currentProvider);
    }
  };

  const handleSelectProvider = (providerId: string) => {
    updateSettingsDefaultProvider(providerId);
    setSettings(initializeSettings());
  };

  const handleSelectModel = (providerId: string, model: string) => {
    updateProviderModel(providerId, model);
    setSettings(initializeSettings());
  };

  if (!currentProvider) {
    return (
      <Button variant="ghost" size="sm" className={cn("text-muted-foreground", className)} disabled>
        <Server className="h-4 w-4 mr-1" />
        No Provider
      </Button>
    );
  }

  return (
    <DropdownMenu onOpenChange={handleOpenChange}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className={cn("text-muted-foreground hover:text-foreground gap-1", className)}
        >
          <Bot className="h-4 w-4" />
          {!compact && (
            <span className="max-w-[120px] truncate">
              {currentProvider.model || currentProvider.name}
            </span>
          )}
          <ChevronDown className="h-3 w-3" />
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>AI Provider</DropdownMenuLabel>
        <DropdownMenuSeparator />

        {/* Provider List */}
        {settings.aiProviders.map((provider) => {
          const providerModels = getProviderModels(provider.id);
          const isCurrentProvider = provider.id === currentProvider.id;
          const isLoading = loadingModels.has(provider.id);

          return (
            <DropdownMenuSub key={provider.id}>
              <DropdownMenuSubTrigger
                className={cn(isCurrentProvider && "bg-accent")}
                onPointerEnter={() => fetchModelsForProvider(provider)}
              >
                <Server className="h-4 w-4 mr-2" />
                <span className="flex-1 truncate">{provider.name}</span>
                {provider.id === settings.defaultAIProviderId && (
                  <span
                    className="text-xs ml-2"
                    role="img"
                    aria-hidden="true"
                    title="Default provider"
                  >
                    ★
                  </span>
                )}
              </DropdownMenuSubTrigger>

              <DropdownMenuSubContent className="w-56">
                <DropdownMenuLabel className="text-xs">Select Model</DropdownMenuLabel>
                <DropdownMenuSeparator />

                {isLoading ? (
                  <DropdownMenuItem disabled>Loading models...</DropdownMenuItem>
                ) : providerModels.length === 0 ? (
                  <DropdownMenuItem disabled>No models available</DropdownMenuItem>
                ) : (
                  providerModels.map((model) => (
                    <DropdownMenuItem
                      key={`${provider.id}-${model}`}
                      onClick={() => {
                        handleSelectProvider(provider.id);
                        handleSelectModel(provider.id, model);
                      }}
                      className={cn(isCurrentProvider && provider.model === model && "bg-accent")}
                    >
                      <Bot className="h-4 w-4 mr-2" />
                      <span className="flex-1 truncate">{model}</span>
                      {provider.model === model && (
                        <span
                          className="text-xs ml-2"
                          role="img"
                          aria-hidden="true"
                          title="Default model"
                        >
                          ★
                        </span>
                      )}
                    </DropdownMenuItem>
                  ))
                )}
              </DropdownMenuSubContent>
            </DropdownMenuSub>
          );
        })}

        {settings.aiProviders.length === 0 && (
          <DropdownMenuItem disabled className="text-muted-foreground">
            No providers configured
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
