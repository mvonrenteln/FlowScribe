/**
 * AI Revision Popover
 *
 * Quick-access menu for AI text revision on a segment.
 * Shows configurable quick-access Prompts and a "More..." option.
 */

import {
  AlertCircle,
  Check,
  ChevronRight,
  Loader2,
  Minus,
  MoreHorizontal,
  Sparkles,
} from "lucide-react";
import type React from "react";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { initializeSettings } from "@/lib/settings/settingsStorage";
import { useTranscriptStore } from "@/lib/store";
import { cn } from "@/lib/utils";

interface AIRevisionPopoverProps {
  segmentId: string;
  disabled?: boolean;
}

// How long to show status indicators (in ms)
const STATUS_DISPLAY_TIME = 3000;

// Module-level simple in-memory cache for provider models (lives until app reload)
const modelCache: Map<string, string[]> = new Map();

const IS_TEST = process.env.NODE_ENV === "test";

export function AIRevisionPopover(props: Readonly<AIRevisionPopoverProps>) {
  const { segmentId, disabled } = props;
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);

  const [displayStatus, setDisplayStatus] = useState<"idle" | "success" | "no-changes" | "error">(
    "idle",
  );

  // Store state
  const prompts = useTranscriptStore((s) => s.aiRevisionConfig.prompts);
  const quickAccessIds = useTranscriptStore((s) => s.aiRevisionConfig.quickAccessPromptIds);
  const suggestions = useTranscriptStore((s) => s.aiRevisionSuggestions);
  const lastResult = useTranscriptStore((s) => s.aiRevisionLastResult);
  const isGlobalProcessing = useTranscriptStore((s) => s.aiRevisionIsProcessing);
  const currentProcessingSegmentId = useTranscriptStore((s) => s.aiRevisionCurrentSegmentId);
  const startSingleRevision = useTranscriptStore((s) => s.startSingleRevision);
  const globalLastSelection = useTranscriptStore((s) => s.aiRevisionLastSelection);
  const setGlobalLastSelection = useTranscriptStore((s) => s.setAiRevisionLastSelection);

  // Local provider/model override state (per-popover). Initialize synchronously.
  const [settings] = useState(() => initializeSettings());

  const defaultProviderId =
    settings.defaultAIProviderId ?? settings.aiProviders.find((p) => p.isDefault)?.id;
  const defaultProvider =
    settings.aiProviders.find((p) => p.id === defaultProviderId) ?? settings.aiProviders[0];
  const defaultModel = defaultProvider
    ? (defaultProvider.model ?? defaultProvider.availableModels?.[0])
    : undefined;

  const [selectedProvider, setSelectedProvider] = useState<string | undefined>(
    () => globalLastSelection?.providerId ?? defaultProvider?.id,
  );
  const [selectedModel, setSelectedModel] = useState<string | undefined>(
    () => globalLastSelection?.model ?? defaultModel,
  );

  const [availableModels, setAvailableModels] = useState<Map<string, string[]>>(new Map());
  const loadingModels = useMemo(() => new Set<string>(), []);

  const contentRef = useRef<HTMLDivElement>(null);
  const isMountedRef = useRef(true);
  const triggerRef = useRef<HTMLButtonElement | null>(null);

  // Check if THIS segment is currently being processed
  const isProcessingThis = isGlobalProcessing && currentProcessingSegmentId === segmentId;

  // Check if this specific segment has a pending suggestion
  const hasPendingSuggestion = suggestions.some(
    (s) => s.segmentId === segmentId && s.status === "pending",
  );

  // Track when processing finishes and show appropriate status
  useEffect(() => {
    if (lastResult?.segmentId === segmentId && !isProcessingThis) {
      if (!isMountedRef.current) return;

      setDisplayStatus(lastResult.status);

      // In tests, skip delayed state updates to reduce act() warnings.
      if (IS_TEST) return;

      const timer = setTimeout(() => {
        if (isMountedRef.current) setDisplayStatus("idle");
      }, STATUS_DISPLAY_TIME);

      return () => clearTimeout(timer);
    }
  }, [lastResult, segmentId, isProcessingThis]);

  useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // Get quick-access prompts
  const quickAccessPrompts = prompts.filter((p) => quickAccessIds.includes(p.id));
  const otherPrompts = prompts.filter((p) => !quickAccessIds.includes(p.id));

  const handleSelectPrompt = (promptId: string) => {
    setDisplayStatus("idle");
    startSingleRevision(segmentId, promptId, selectedProvider, selectedModel);
    // Keep focus on trigger after selection
    triggerRef.current?.focus();
    setOpen(false);
  };

  const fetchModelsForProvider = useCallback(
    async (providerId: string) => {
      if (!isMountedRef.current) return;

      if (modelCache.has(providerId)) {
        const cached = modelCache.get(providerId) || [];
        setAvailableModels((prev) => new Map([...prev, [providerId, cached]]));
        return;
      }

      const providerConfig = settings.aiProviders.find((p) => p.id === providerId);
      if (!providerConfig) return;

      const available =
        providerConfig.availableModels ?? (providerConfig.model ? [providerConfig.model] : []);

      modelCache.set(providerId, available);
      setAvailableModels((prev) => new Map([...prev, [providerId, available]]));
    },
    [settings.aiProviders],
  );

  // Build simple provider list from settings for inline selection
  const providerModels = settings.aiProviders.map((p) => ({
    id: p.id,
    name: p.name,
    model: p.model,
    isDefault: p.id === settings.defaultAIProviderId || p.isDefault,
  }));

  // When popover opens, if a provider is selected fetch its models
  useEffect(() => {
    if (open && selectedProvider) {
      fetchModelsForProvider(selectedProvider);
    }
  }, [open, selectedProvider, fetchModelsForProvider]);

  // Ensure selectedModel is valid for the currently selected provider (when models are known)
  useEffect(() => {
    if (!selectedProvider) return;
    const models = availableModels.get(selectedProvider);
    if (!models || models.length === 0) return;

    if (!selectedModel || !models.includes(selectedModel)) {
      setSelectedModel(models[0]);
    }
  }, [selectedProvider, availableModels, selectedModel]);

  // Focus first item when popover opens (sync)
  useLayoutEffect(() => {
    if (!open) return;
    const container = contentRef.current;
    if (!container) return;
    const firstButton = container.querySelector<HTMLButtonElement>(
      "button[data-menuitem]:not([disabled])",
    );
    firstButton?.focus();
  }, [open]);

  // Persist selection into global store only while open (avoid surprise updates during tests)
  useEffect(() => {
    if (!open) return;
    if (selectedProvider === undefined && selectedModel === undefined) return;
    setGlobalLastSelection({ providerId: selectedProvider, model: selectedModel });
  }, [open, selectedProvider, selectedModel, setGlobalLastSelection]);

  // Determine icon and styling based on current status
  const getStatusDisplay = () => {
    if (isProcessingThis) {
      return {
        icon: <Loader2 className="h-4 w-4 animate-spin" />,
        className: "animate-pulse text-primary",
        title: t("aiRevision.inProgress"),
      };
    }

    if (hasPendingSuggestion) {
      return {
        icon: <Sparkles className="h-4 w-4" />,
        className: "text-amber-500 hover:text-amber-600 ring-2 ring-amber-500/50",
        title: t("aiRevision.suggestionAvailable"),
      };
    }

    switch (displayStatus) {
      case "success":
        return {
          icon: <Check className="h-4 w-4" />,
          className: "text-green-500 hover:text-green-600",
          title: t("aiRevision.suggestionCreated"),
        };
      case "no-changes":
        return {
          icon: <Minus className="h-4 w-4" />,
          className: "text-muted-foreground",
          title: t("aiRevision.noChangesNeeded"),
        };
      case "error":
        return {
          icon: <AlertCircle className="h-4 w-4" />,
          className: "text-destructive hover:text-destructive",
          title: lastResult?.message ?? t("aiRevision.processingError"),
        };
      default:
        return {
          icon: <Sparkles className="h-4 w-4" />,
          className: "",
          title: t("aiRevision.actionLabel"),
        };
    }
  };

  const statusDisplay = getStatusDisplay();

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          ref={triggerRef}
          variant="ghost"
          size="icon"
          className={cn("h-7 w-7 transition-all duration-200", statusDisplay.className)}
          disabled={disabled || isProcessingThis}
          aria-label={statusDisplay.title}
          title={statusDisplay.title}
          onClick={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.stopPropagation()}
        >
          {statusDisplay.icon}
        </Button>
      </PopoverTrigger>

      <PopoverContent
        ref={contentRef}
        className="w-56 p-1"
        align="end"
        data-menu-overlay="true"
        onCloseAutoFocus={(e) => {
          // Keep focus stable: restore to trigger synchronously.
          e.preventDefault();
          triggerRef.current?.focus();
        }}
        onKeyDown={(event) => {
          // Roving focus for "menu buttons" only (not inside selects, inputs etc.)
          if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
          const target = event.target as HTMLElement | null;
          if (!target) return;

          const tagName = target.tagName;
          if (tagName === "INPUT" || tagName === "TEXTAREA") return;

          // If a Radix Select is open, it will handle arrows itself.
          // We only handle arrows on our menuitems (buttons).
          const container = contentRef.current;
          if (!container) return;

          const items = Array.from(
            container.querySelectorAll<HTMLButtonElement>("button[data-menuitem]:not([disabled])"),
          );
          if (items.length === 0) return;

          const activeElement = document.activeElement as HTMLButtonElement | null;
          const currentIndex = activeElement ? items.indexOf(activeElement) : -1;
          const delta = event.key === "ArrowDown" ? 1 : -1;
          const nextIndex =
            currentIndex === -1 ? 0 : (currentIndex + delta + items.length) % items.length;

          event.preventDefault();
          event.stopPropagation();
          items[nextIndex]?.focus();
        }}
      >
        <div className="flex flex-col">
          {/* Status message if not idle */}
          {displayStatus === "no-changes" && (
            <div className="px-3 py-2 text-xs text-muted-foreground bg-muted/50 rounded-sm mb-1 flex items-center gap-2">
              <Minus className="h-3 w-3" />
              {t("aiRevision.noChangesNeeded")}
            </div>
          )}
          {displayStatus === "error" && lastResult?.message && (
            <div className="px-3 py-2 text-xs text-destructive bg-destructive/10 rounded-sm mb-1 flex items-center gap-2">
              <AlertCircle className="h-3 w-3" />
              {lastResult.message}
            </div>
          )}

          {/* Quick-Access Prompts */}
          {quickAccessPrompts.map((promptItem) => (
            <button
              key={promptItem.id}
              type="button"
              data-menuitem="true"
              className={cn(
                "flex items-center gap-2 px-3 py-2 text-sm rounded-sm",
                "hover:bg-accent hover:text-accent-foreground",
                "focus:bg-accent focus:text-accent-foreground focus:outline-none focus-visible:ring-1 focus-visible:ring-ring",
                "text-left w-full",
              )}
              onClick={() => handleSelectPrompt(promptItem.id)}
            >
              <Sparkles className="h-4 w-4 text-muted-foreground" />
              <span className="flex-1 truncate">{promptItem.name}</span>
            </button>
          ))}

          {/* Separator and "More" section if there are other Prompts */}
          {otherPrompts.length > 0 && (
            <>
              {quickAccessPrompts.length > 0 && <div className="h-px bg-border my-1" />}
              <MorePromptsSubmenu prompts={otherPrompts} onSelect={handleSelectPrompt} />
            </>
          )}

          {/* Empty state */}
          {prompts.length === 0 && (
            <div className="px-3 py-4 text-sm text-muted-foreground text-center">
              {t("aiRevision.noTemplates")}
              <br />
              {t("aiRevision.createInSettings")}
            </div>
          )}

          {/* Settings submenu placed at the end */}
          <div className="h-px bg-border my-1" />
          <SettingsSubmenu
            providerModels={providerModels}
            availableModels={availableModels}
            loadingModels={loadingModels}
            selectedProvider={selectedProvider}
            selectedModel={selectedModel}
            setSelectedProvider={(id) => {
              setSelectedProvider(id);
              if (id) fetchModelsForProvider(id);
            }}
            setSelectedModel={setSelectedModel}
            settings={settings}
          />
        </div>
      </PopoverContent>
    </Popover>
  );
}

interface MorePromptsSubmenuProps {
  prompts: Array<{ id: string; name: string }>;
  onSelect: (id: string) => void;
}

function MorePromptsSubmenu(props: Readonly<MorePromptsSubmenuProps>) {
  const { prompts, onSelect } = props;
  const { t } = useTranslation();
  const [showMore, setShowMore] = useState(false);

  if (!showMore) {
    return (
      <button
        type="button"
        data-menuitem="true"
        className={cn(
          "flex items-center gap-2 px-3 py-2 text-sm rounded-sm",
          "hover:bg-accent hover:text-accent-foreground",
          "focus:bg-accent focus:text-accent-foreground focus:outline-none focus-visible:ring-1 focus-visible:ring-ring",
          "text-left w-full text-muted-foreground",
        )}
        onClick={() => setShowMore(true)}
      >
        <MoreHorizontal className="h-4 w-4" />
        <span className="flex-1">{t("aiRevision.morePrompts")}</span>
        <ChevronRight className="h-4 w-4" />
      </button>
    );
  }

  return (
    <div className="flex flex-col">
      <button
        type="button"
        data-menuitem="true"
        className={cn(
          "flex items-center gap-2 px-3 py-2 text-sm rounded-sm",
          "hover:bg-accent hover:text-accent-foreground",
          "focus:bg-accent focus:text-accent-foreground focus:outline-none focus-visible:ring-1 focus-visible:ring-ring",
          "text-left w-full text-muted-foreground",
        )}
        onClick={() => setShowMore(false)}
      >
        <span className="flex-1">{t("aiRevision.morePrompts")}</span>
        <span>{t("aiRevision.back")}</span>
      </button>
      <div className="h-px bg-border my-1" />
      {prompts.map((promptItem) => (
        <button
          key={promptItem.id}
          type="button"
          data-menuitem="true"
          className={cn(
            "flex items-center gap-2 px-3 py-2 text-sm rounded-sm",
            "hover:bg-accent hover:text-accent-foreground",
            "focus:bg-accent focus:text-accent-foreground focus:outline-none focus-visible:ring-1 focus-visible:ring-ring",
            "text-left w-full",
          )}
          onClick={() => onSelect(promptItem.id)}
        >
          <Sparkles className="h-4 w-4 text-muted-foreground" />
          <span className="flex-1 truncate">{promptItem.name}</span>
        </button>
      ))}
    </div>
  );
}

interface SettingsSubmenuProps {
  providerModels: Array<{ id: string; name: string; model?: string; isDefault?: boolean }>;
  availableModels: Map<string, string[]>;
  loadingModels: Set<string>;
  selectedProvider?: string;
  selectedModel?: string;
  setSelectedProvider: (id?: string) => void;
  setSelectedModel: (m?: string) => void;
  settings: ReturnType<typeof initializeSettings>;
}

function SettingsSubmenu(props: Readonly<SettingsSubmenuProps>) {
  const {
    providerModels,
    availableModels,
    loadingModels,
    selectedProvider,
    selectedModel,
    setSelectedProvider,
    setSelectedModel,
    settings,
  } = props;

  const { t } = useTranslation();
  const [open, setOpen] = useState(false);

  // Roving focus between the two "rows"
  const [activeRow, setActiveRow] = useState<"provider" | "model">("provider");

  // Controlled dropdown open state (prevents “stuck in select”)
  const [providerDropdownOpen, setProviderDropdownOpen] = useState(false);
  const [modelDropdownOpen, setModelDropdownOpen] = useState(false);

  const providerTriggerRef = useRef<HTMLButtonElement | null>(null);
  const modelTriggerRef = useRef<HTMLButtonElement | null>(null);

  const modelsForSelectedProvider = availableModels.get(selectedProvider ?? "") ?? [];
  const modelDisabled = modelsForSelectedProvider.length === 0;

  const closeAllDropdowns = () => {
    setProviderDropdownOpen(false);
    setModelDropdownOpen(false);
  };

  useLayoutEffect(() => {
    if (!open) return;
    setActiveRow("provider");
    providerTriggerRef.current?.focus();
  }, [open]);

  useLayoutEffect(() => {
    if (!open) return;
    // Don't auto-focus when dropdowns are open to avoid interfering with Radix behavior
    if (providerDropdownOpen || modelDropdownOpen) return;

    // Focus the active row when navigating between rows
    if (activeRow === "provider") providerTriggerRef.current?.focus();
    if (activeRow === "model") modelTriggerRef.current?.focus();
  }, [open, activeRow, providerDropdownOpen, modelDropdownOpen]);

  const handleRowNavKeyDown = (e: React.KeyboardEvent) => {
    // If a select dropdown is open, let Radix handle list navigation.
    if (providerDropdownOpen || modelDropdownOpen) return;

    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      e.stopPropagation();
      setActiveRow((prev) => (prev === "provider" ? "model" : "provider"));
      return;
    }

    if (e.key === "Enter") {
      e.preventDefault();
      e.stopPropagation();
      if (activeRow === "provider") {
        // Close model dropdown if open, then open provider dropdown
        setModelDropdownOpen(false);
        setProviderDropdownOpen(true);
      } else {
        if (!modelDisabled) {
          // Close provider dropdown if open, then open model dropdown
          setProviderDropdownOpen(false);
          setModelDropdownOpen(true);
        }
      }
      return;
    }

    if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      closeAllDropdowns();
      setOpen(false);
      return;
    }
  };

  if (!open) {
    return (
      <button
        type="button"
        data-menuitem="true"
        className={cn(
          "flex items-center gap-2 px-3 py-2 text-sm rounded-sm",
          "hover:bg-accent hover:text-accent-foreground",
          "focus:bg-accent focus:text-accent-foreground focus:outline-none focus-visible:ring-1 focus-visible:ring-ring",
          "text-left w-full text-muted-foreground",
        )}
        onClick={() => setOpen(true)}
      >
        <span className="flex-1">{t("aiRevision.settings") ?? "Settings"}</span>
        <ChevronRight className="h-4 w-4" />
      </button>
    );
  }

  return (
    <div className="flex flex-col">
      <button
        type="button"
        data-menuitem="true"
        className={cn(
          "flex items-center gap-2 px-3 py-2 text-sm rounded-sm",
          "hover:bg-accent hover:text-accent-foreground",
          "focus:bg-accent focus:text-accent-foreground focus:outline-none focus-visible:ring-1 focus-visible:ring-ring",
          "text-left w-full text-muted-foreground",
        )}
        onClick={() => {
          closeAllDropdowns();
          setOpen(false);
        }}
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            e.preventDefault();
            e.stopPropagation();
            closeAllDropdowns();
            setOpen(false);
          }
        }}
      >
        <span className="flex-1">{t("aiRevision.settings") ?? "Settings"}</span>
        <span>{t("aiRevision.back")}</span>
      </button>

      <div className="h-px bg-border my-1" />

      <div className="px-3 py-2">
        <div className="text-[11px] text-muted-foreground mb-1">Provider</div>

        <Select
          value={selectedProvider ?? ""}
          onValueChange={(val) => {
            const next = val || undefined;
            setSelectedProvider(next);
            setProviderDropdownOpen(false);
            setActiveRow("provider");
            providerTriggerRef.current?.focus();
          }}
          open={providerDropdownOpen}
          onOpenChange={(next) => {
            setProviderDropdownOpen(next);
            if (next) {
              // Close model dropdown when opening provider dropdown
              setModelDropdownOpen(false);
            } else {
              // When closing provider dropdown, focus remains on provider trigger
              setActiveRow("provider");
              // Defer focus to next tick to ensure DOM is ready
              setTimeout(() => providerTriggerRef.current?.focus(), 0);
            }
          }}
        >
          <SelectTrigger
            ref={providerTriggerRef}
            className={cn(
              "w-full justify-between",
              "text-sm bg-transparent truncate rounded px-2 py-1",
              "border border-transparent hover:border-border",
              "focus:ring-1 focus:ring-ring",
              activeRow === "provider" ? "bg-muted/30" : "",
            )}
            onClick={() => {
              setActiveRow("provider");
              // Close model dropdown if open, then open provider dropdown
              setModelDropdownOpen(false);
              setProviderDropdownOpen(true);
            }}
            onKeyDown={(e) => {
              setActiveRow("provider");
              // Handle Enter key specifically to ensure dropdown opens correctly
              if (e.key === "Enter") {
                e.preventDefault();
                e.stopPropagation();
                setModelDropdownOpen(false);
                setProviderDropdownOpen(true);
                return;
              }
              handleRowNavKeyDown(e);
            }}
          >
            <SelectValue
              placeholder={settings.aiProviders.find((x) => x.id === selectedProvider)?.name ?? ""}
            />
          </SelectTrigger>

          <SelectContent
            onEscapeKeyDown={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setProviderDropdownOpen(false);
              setActiveRow("provider");
              // Let Radix handle focus restoration where possible; if needed, restore focus asynchronously
              setTimeout(() => providerTriggerRef.current?.focus(), 0);
            }}
          >
            {providerModels.map((p) => (
              <SelectItem key={p.id} value={p.id}>
                {p.name}
                {p.isDefault ? " ★" : ""}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="text-[11px] text-muted-foreground mb-1 mt-3">Model</div>

        {loadingModels.has(selectedProvider ?? "") ? (
          <div className="text-xs text-muted-foreground">Loading models...</div>
        ) : (
          <Select
            value={selectedModel ?? ""}
            onValueChange={(val) => {
              const next = val || undefined;
              setSelectedModel(next);
              setModelDropdownOpen(false);
              setActiveRow("model");
              modelTriggerRef.current?.focus();
            }}
            open={modelDropdownOpen}
            onOpenChange={(next) => {
              setModelDropdownOpen(next);
              if (next) {
                // Close provider dropdown when opening model dropdown
                setProviderDropdownOpen(false);
              } else {
                // When closing model dropdown, focus remains on model trigger
                setActiveRow("model");
                // Defer focus to next tick to ensure DOM is ready
                setTimeout(() => modelTriggerRef.current?.focus(), 0);
              }
            }}
            disabled={modelDisabled}
          >
            <SelectTrigger
              ref={modelTriggerRef}
              className={cn(
                "w-full justify-between",
                "text-sm bg-transparent truncate rounded px-2 py-1",
                "border border-transparent hover:border-border",
                "focus:ring-1 focus:ring-ring",
                activeRow === "model" ? "bg-muted/30" : "",
                modelDisabled ? "opacity-50 cursor-not-allowed" : "",
              )}
              onClick={() => {
                setActiveRow("model");
                if (!modelDisabled) {
                  // Close provider dropdown if open, then open model dropdown
                  setProviderDropdownOpen(false);
                  setModelDropdownOpen(true);
                }
              }}
              onKeyDown={(e) => {
                setActiveRow("model");
                // Handle Enter key specifically to ensure dropdown opens correctly
                if (e.key === "Enter") {
                  e.preventDefault();
                  e.stopPropagation();
                  if (!modelDisabled) {
                    setProviderDropdownOpen(false);
                    setModelDropdownOpen(true);
                  }
                  return;
                }
                handleRowNavKeyDown(e);
              }}
            >
              <SelectValue placeholder={selectedModel ?? ""} />
            </SelectTrigger>

            <SelectContent
              onEscapeKeyDown={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setModelDropdownOpen(false);
                setActiveRow("model");
                // Let Radix handle focus restoration where possible; restore focus asynchronously as fallback
                setTimeout(() => modelTriggerRef.current?.focus(), 0);
              }}
            >
              {modelsForSelectedProvider.map((m) => {
                const defaultStar =
                  m === (settings.aiProviders.find((p) => p.id === selectedProvider)?.model ?? "");
                return (
                  <SelectItem key={`${selectedProvider}-${m}`} value={m}>
                    {m}
                    {defaultStar ? " ★" : ""}
                  </SelectItem>
                );
              })}
            </SelectContent>
          </Select>
        )}
      </div>
    </div>
  );
}
