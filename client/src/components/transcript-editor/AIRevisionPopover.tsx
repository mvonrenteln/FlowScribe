/**
 * AI Revision Popover
 *
 * Quick-access menu for AI text revision on a segment.
 * Shows configurable quick-access templates and a "More..." option.
 */

import { AlertCircle, Check, ChevronRight, Loader2, MoreHorizontal, Sparkles } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useTranscriptStore } from "@/lib/store";
import { cn } from "@/lib/utils";

interface AIRevisionPopoverProps {
  segmentId: string;
  disabled?: boolean;
}

export function AIRevisionPopover({ segmentId, disabled }: AIRevisionPopoverProps) {
  const [open, setOpen] = useState(false);
  const [localProcessing, setLocalProcessing] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [showError, setShowError] = useState(false);

  // Store state
  const templates = useTranscriptStore((s) => s.aiRevisionConfig.templates);
  const quickAccessIds = useTranscriptStore((s) => s.aiRevisionConfig.quickAccessTemplateIds);
  const suggestions = useTranscriptStore((s) => s.aiRevisionSuggestions);
  const globalError = useTranscriptStore((s) => s.aiRevisionError);
  const isGlobalProcessing = useTranscriptStore((s) => s.aiRevisionIsProcessing);
  const startSingleRevision = useTranscriptStore((s) => s.startSingleRevision);

  // Check if this specific segment has a pending suggestion
  const hasPendingSuggestion = suggestions.some(
    (s) => s.segmentId === segmentId && s.status === "pending"
  );

  // Track when processing finishes
  useEffect(() => {
    if (localProcessing && !isGlobalProcessing) {
      setLocalProcessing(false);

      // Check if we got a suggestion or an error
      const hasNewSuggestion = suggestions.some(
        (s) => s.segmentId === segmentId && s.status === "pending"
      );

      if (hasNewSuggestion) {
        setShowSuccess(true);
        setTimeout(() => setShowSuccess(false), 1500);
      } else if (globalError) {
        setShowError(true);
        setTimeout(() => setShowError(false), 3000);
      }
    }
  }, [isGlobalProcessing, localProcessing, suggestions, segmentId, globalError]);

  // Get quick-access templates
  const quickAccessTemplates = templates.filter((t) => quickAccessIds.includes(t.id));
  const otherTemplates = templates.filter((t) => !quickAccessIds.includes(t.id));

  const handleSelectTemplate = (templateId: string) => {
    setLocalProcessing(true);
    setShowError(false);
    startSingleRevision(segmentId, templateId);
    setOpen(false);
  };

  const isProcessingThis = localProcessing;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className={cn(
            "h-7 w-7 text-muted-foreground hover:text-foreground transition-colors",
            isProcessingThis && "animate-pulse",
            hasPendingSuggestion && "text-amber-500 hover:text-amber-600",
            showError && "text-destructive hover:text-destructive",
          )}
          disabled={disabled || isProcessingThis}
          aria-label="AI Revision (Alt+R für Standard)"
          title={
            showError
              ? `Fehler: ${globalError ?? "Unbekannter Fehler"}`
              : hasPendingSuggestion
                ? "AI Revision vorgeschlagen - klicken zum Anzeigen"
                : "AI Revision (Alt+R für Standard)"
          }
        >
          {isProcessingThis ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : showSuccess ? (
            <Check className="h-4 w-4 text-green-500" />
          ) : showError ? (
            <AlertCircle className="h-4 w-4 text-destructive" />
          ) : (
            <Sparkles className="h-4 w-4" />
          )}
        </Button>
      </PopoverTrigger>

      <PopoverContent className="w-56 p-1" align="end">
        <div className="flex flex-col">
          {/* Error message if present */}
          {showError && globalError && (
            <div className="px-3 py-2 text-xs text-destructive bg-destructive/10 rounded-sm mb-1">
              {globalError}
            </div>
          )}

          {/* Quick-Access Templates */}
          {quickAccessTemplates.map((template) => (
            <button
              key={template.id}
              type="button"
              className={cn(
                "flex items-center gap-2 px-3 py-2 text-sm rounded-sm",
                "hover:bg-accent hover:text-accent-foreground",
                "focus:bg-accent focus:text-accent-foreground focus:outline-none",
                "text-left w-full",
              )}
              onClick={() => handleSelectTemplate(template.id)}
            >
              <Sparkles className="h-4 w-4 text-muted-foreground" />
              <span className="flex-1 truncate">{template.name}</span>
            </button>
          ))}

          {/* Separator and "More" section if there are other templates */}
          {otherTemplates.length > 0 && (
            <>
              {quickAccessTemplates.length > 0 && (
                <div className="h-px bg-border my-1" />
              )}
              <MoreTemplatesSubmenu
                templates={otherTemplates}
                onSelect={handleSelectTemplate}
              />
            </>
          )}

          {/* Empty state */}
          {templates.length === 0 && (
            <div className="px-3 py-4 text-sm text-muted-foreground text-center">
              Keine Templates konfiguriert.
              <br />
              Erstellen Sie Templates in den Einstellungen.
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

interface MoreTemplatesSubmenuProps {
  templates: Array<{ id: string; name: string }>;
  onSelect: (id: string) => void;
}

function MoreTemplatesSubmenu({ templates, onSelect }: MoreTemplatesSubmenuProps) {
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
        <span className="flex-1">Weitere Templates...</span>
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
        <span>Zurück</span>
      </button>
      <div className="h-px bg-border my-1" />
      {templates.map((template) => (
        <button
          key={template.id}
          type="button"
          className={cn(
            "flex items-center gap-2 px-3 py-2 text-sm rounded-sm",
            "hover:bg-accent hover:text-accent-foreground",
            "focus:bg-accent focus:text-accent-foreground focus:outline-none",
            "text-left w-full",
          )}
          onClick={() => onSelect(template.id)}
        >
          <Sparkles className="h-4 w-4 text-muted-foreground" />
          <span className="flex-1 truncate">{template.name}</span>
        </button>
      ))}
    </div>
  );
}

