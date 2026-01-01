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
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useTranscriptStore } from "@/lib/store";
import { cn } from "@/lib/utils";

interface AIRevisionPopoverProps {
  segmentId: string;
  disabled?: boolean;
}

// How long to show status indicators (in ms)
const STATUS_DISPLAY_TIME = 3000;

export function AIRevisionPopover({ segmentId, disabled }: AIRevisionPopoverProps) {
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

  // Check if THIS segment is currently being processed
  const isProcessingThis = isGlobalProcessing && currentProcessingSegmentId === segmentId;

  // Check if this specific segment has a pending suggestion
  const hasPendingSuggestion = suggestions.some(
    (s) => s.segmentId === segmentId && s.status === "pending",
  );

  // Track when processing finishes and show appropriate status
  useEffect(() => {
    if (lastResult?.segmentId === segmentId && !isProcessingThis) {
      setDisplayStatus(lastResult.status);

      // Auto-hide status after timeout
      const timer = setTimeout(() => {
        setDisplayStatus("idle");
      }, STATUS_DISPLAY_TIME);

      return () => clearTimeout(timer);
    }
  }, [lastResult, segmentId, isProcessingThis]);

  // Get quick-access prompts
  const quickAccessPrompts = prompts.filter((t) => quickAccessIds.includes(t.id));
  const otherPrompts = prompts.filter((t) => !quickAccessIds.includes(t.id));

  const handleSelectPrompt = (promptId: string) => {
    setDisplayStatus("idle");
    startSingleRevision(segmentId, promptId);
    setOpen(false);
  };

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

      <PopoverContent className="w-56 p-1" align="end">
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
              className={cn(
                "flex items-center gap-2 px-3 py-2 text-sm rounded-sm",
                "hover:bg-accent hover:text-accent-foreground",
                "focus:bg-accent focus:text-accent-foreground focus:outline-none",
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
        </div>
      </PopoverContent>
    </Popover>
  );
}

interface MorePromptsSubmenuProps {
  prompts: Array<{ id: string; name: string }>;
  onSelect: (id: string) => void;
}

function MorePromptsSubmenu({ prompts, onSelect }: MorePromptsSubmenuProps) {
  const { t } = useTranslation();
  const [showMore, setShowMore] = useState(false);

  if (!showMore) {
    return (
      <button
        type="button"
        className={cn(
          "flex items-center gap-2 px-3 py-2 text-sm rounded-sm",
          "hover:bg-accent hover:text-accent-foreground",
          "focus:bg-accent focus:text-accent-foreground focus:outline-none",
          "text-left w-full text-muted-foreground",
        )}
        onClick={() => setShowMore(true)}
      >
        <MoreHorizontal className="h-4 w-4" />
        <span className="flex-1">{t("aiRevision.moreTemplates")}</span>
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
          "focus:bg-accent focus:text-accent-foreground focus:outline-none",
          "text-left w-full text-muted-foreground",
        )}
        onClick={() => setShowMore(false)}
      >
        <ChevronRight className="h-4 w-4 rotate-180" />
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
            "focus:bg-accent focus:text-accent-foreground focus:outline-none",
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
