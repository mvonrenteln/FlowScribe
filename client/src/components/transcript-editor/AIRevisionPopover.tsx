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
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
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

export function AIRevisionPopover(props: Readonly<AIRevisionPopoverProps>) {
  const { segmentId, disabled } = props;
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const providerSelectRef = useRef<HTMLSelectElement | null>(null);
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

  // Local provider/model override state (per-popover). Initialize from
  // persisted global selection or settings synchronously to avoid a
  // post-mount state update (which triggers act() warnings in tests).
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

  // Note: initial selectedProvider/selectedModel are set synchronously above.

  // Check if THIS segment is currently being processed
  const isProcessingThis = isGlobalProcessing && currentProcessingSegmentId === segmentId;

  // Check if this specific segment has a pending suggestion
  const hasPendingSuggestion = suggestions.some(
    (s) => s.segmentId === segmentId && s.status === "pending",
  );

  // Track when processing finishes and show appropriate status
  useEffect(() => {
    if (lastResult?.segmentId === segmentId && !isProcessingThis) {
      if (isMountedRef.current) {
        setDisplayStatus(lastResult.status);

        // Auto-hide status after timeout (guarded by mounted flag)
        const timer = setTimeout(() => {
          if (isMountedRef.current) setDisplayStatus("idle");
        }, STATUS_DISPLAY_TIME);

        return () => clearTimeout(timer);
      }
    }
  }, [lastResult, segmentId, isProcessingThis]);

  useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // Get quick-access prompts
  const quickAccessPrompts = prompts.filter((t) => quickAccessIds.includes(t.id));
  const otherPrompts = prompts.filter((t) => !quickAccessIds.includes(t.id));

  const handleSelectPrompt = (promptId: string) => {
    setDisplayStatus("idle");
    startSingleRevision(segmentId, promptId, selectedProvider, selectedModel);
    // Ensure trigger keeps focus after selection (avoid focus jumping to top bar)
    triggerRef.current?.focus();
    setOpen(false);
  };

  const fetchModelsForProvider = useCallback(
    async (providerId: string) => {
      // Use module cache if present
      if (!isMountedRef.current) return;
      if (modelCache.has(providerId)) {
        const cached = modelCache.get(providerId) || [];
        if (isMountedRef.current)
          setAvailableModels((prev) => new Map([...prev, [providerId, cached]]));
        return;
      }

      const providerConfig = settings.aiProviders.find((p) => p.id === providerId);
      if (!providerConfig) return;

      // Read available models from settings (preferred) or fall back to provider.model
      const available =
        providerConfig.availableModels ?? (providerConfig.model ? [providerConfig.model] : []);
      modelCache.set(providerId, available);
      if (isMountedRef.current)
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

  useLayoutEffect(() => {
    if (!open) return;
    const container = contentRef.current;
    if (!container) return;
    const firstButton = container.querySelector<HTMLButtonElement>("button:not([disabled])");
    firstButton?.focus();
    return () => {
      /* no-op cleanup; focus handled synchronously */
    };
  }, [open]);

  // Persist selection into global store so other popovers pick it up
  useEffect(() => {
    // Only persist selection when the popover is open to avoid causing
    // async updates during test renders (which trigger act() warnings).
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
          className: "text-muted-foreground hover:text-foreground",
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
        onCloseAutoFocus={(e: any) => {
          // Prevent Radix from moving focus automatically when the popover
          // closes — we explicitly restore focus to the trigger. This
          // avoids focus jumping to the top bar after selecting a prompt
          // or pressing Escape.
          e.preventDefault();
          requestAnimationFrame(() => {
            triggerRef.current?.focus();
          });
        }}
        onKeyDown={(event) => {
          if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
          const target = event.target as HTMLElement | null;
          if (!target) return;
          const tagName = target.tagName;
          if (tagName === "INPUT" || tagName === "TEXTAREA" || tagName === "SELECT") return;
          const container = contentRef.current;
          if (!container) return;
          const items = Array.from(
            container.querySelectorAll<HTMLButtonElement>("button:not([disabled])"),
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
          {/* Provider / Model overrides moved into Settings submenu (see SettingsSubmenu below) */}
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
            setSelectedProvider={setSelectedProvider}
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
  const providerSelectRef = useRef<HTMLSelectElement | null>(null);

  const modelSelectRef = useRef<HTMLSelectElement | null>(null);

  useLayoutEffect(() => {
    if (open) {
      // Focus the provider select synchronously when submenu opens.
      // Using layout effect keeps focus changes within React's render
      // lifecycle so testing utilities won't emit act(...) warnings.
      providerSelectRef.current?.focus();
    }
  }, [open]);

  // When user selects a provider, move focus to model select if available
  useLayoutEffect(() => {
    const models = availableModels.get(selectedProvider ?? "") ?? [];
    if (models.length > 0) {
      // Focus model select synchronously after provider changes and
      // models are available. Layout effect keeps this inside React's
      // commit phase which avoids async updates outside act(...).
      modelSelectRef.current?.focus();
    }
  }, [selectedProvider, availableModels]);

  if (!open) {
    return (
      <button
        type="button"
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
        className={cn(
          "flex items-center gap-2 px-3 py-2 text-sm rounded-sm",
          "hover:bg-accent hover:text-accent-foreground",
          "focus:bg-accent focus:text-accent-foreground focus:outline-none focus-visible:ring-1 focus-visible:ring-ring",
          "text-left w-full text-muted-foreground",
        )}
        onClick={() => setOpen(false)}
      >
        <span className="flex-1">{t("aiRevision.settings") ?? "Settings"}</span>
        <span>{t("aiRevision.back")}</span>
      </button>

      <div className="h-px bg-border my-1" />

      <div className="px-3 py-2">
        <div className="text-[11px] text-muted-foreground mb-1">Provider</div>
        <div className="max-w-[12rem] mb-2">
          <select
            ref={providerSelectRef}
            className="w-full text-sm bg-transparent truncate rounded px-2 py-1 border border-transparent hover:border-border"
            value={selectedProvider ?? ""}
            onChange={(e) => {
              const val = e.target.value || undefined;
              setSelectedProvider(val);
            }}
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => {
              // If user presses Enter while focus is on the provider list,
              // allow the native select to open. Do not swallow here so
              // browser behavior remains.
            }}
            title={settings.aiProviders.find((x) => x.id === selectedProvider)?.name ?? ""}
          >
            {providerModels.map((p) => (
              <option key={p.id} value={p.id} title={p.name}>
                {p.name}
                {p.isDefault ? " ★" : ""}
              </option>
            ))}
          </select>
        </div>

        <div className="text-[11px] text-muted-foreground mb-1">Model</div>
        {loadingModels.has(selectedProvider ?? "") ? (
          <div className="text-xs text-muted-foreground">Loading models...</div>
        ) : (
          <div className="max-w-[12rem]">
            <select
              ref={modelSelectRef}
              className="w-full text-sm bg-transparent truncate rounded px-2 py-1 border border-transparent hover:border-border"
              value={selectedModel ?? ""}
              onChange={(e) => {
                const val = e.target.value || undefined;
                setSelectedModel(val);
              }}
              onClick={(e) => e.stopPropagation()}
              title={selectedModel ?? ""}
            >
              {(availableModels.get(selectedProvider ?? "") ?? []).map((m) => (
                <option key={`${selectedProvider}-${m}`} value={m} title={m}>
                  {m}
                  {m === (settings.aiProviders.find((p) => p.id === selectedProvider)?.model ?? "")
                    ? " ★"
                    : ""}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>
    </div>
  );
}
