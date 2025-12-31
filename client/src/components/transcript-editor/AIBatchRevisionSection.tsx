/**
 * AI Batch Revision Section
 *
 * Collapsible section in the FilterPanel for batch AI revision.
 * Shows template selector and start button when expanded.
 */

import { ChevronDown, ChevronRight, Loader2, Sparkles, X } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useTranscriptStore } from "@/lib/store";
import { cn } from "@/lib/utils";

interface AIBatchRevisionSectionProps {
  /** IDs of segments that match current filters */
  filteredSegmentIds: string[];
}

export function AIBatchRevisionSection({ filteredSegmentIds }: AIBatchRevisionSectionProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>("");

  // Store state
  const templates = useTranscriptStore((s) => s.aiRevisionConfig.templates);
  const defaultTemplateId = useTranscriptStore((s) => s.aiRevisionConfig.defaultTemplateId);
  const isProcessing = useTranscriptStore((s) => s.aiRevisionIsProcessing);
  const processedCount = useTranscriptStore((s) => s.aiRevisionProcessedCount);
  const totalToProcess = useTranscriptStore((s) => s.aiRevisionTotalToProcess);
  const error = useTranscriptStore((s) => s.aiRevisionError);
  const startBatchRevision = useTranscriptStore((s) => s.startBatchRevision);
  const cancelRevision = useTranscriptStore((s) => s.cancelRevision);

  // Use default template if none selected
  const effectiveTemplateId = selectedTemplateId || defaultTemplateId || templates[0]?.id;
  const selectedTemplate = templates.find((t) => t.id === effectiveTemplateId);

  const segmentCount = filteredSegmentIds.length;
  const progressPercent = totalToProcess > 0 ? (processedCount / totalToProcess) * 100 : 0;

  const handleStart = () => {
    if (!effectiveTemplateId || segmentCount === 0) return;
    startBatchRevision(filteredSegmentIds, effectiveTemplateId);
  };

  return (
    <div className="border-t pt-3 mt-3">
      {/* Collapsible Header */}
      <button
        type="button"
        className={cn(
          "flex items-center gap-2 w-full text-left",
          "text-sm font-medium text-muted-foreground",
          "hover:text-foreground transition-colors",
        )}
        onClick={() => setIsExpanded(!isExpanded)}
        aria-expanded={isExpanded}
      >
        {isExpanded ? (
          <ChevronDown className="h-4 w-4" />
        ) : (
          <ChevronRight className="h-4 w-4" />
        )}
        <Sparkles className="h-4 w-4" />
        <span>AI Batch Revision</span>
        {segmentCount > 0 && !isExpanded && (
          <span className="ml-auto text-xs text-muted-foreground">
            {segmentCount} Segment{segmentCount !== 1 ? "e" : ""}
          </span>
        )}
      </button>

      {/* Expanded Content */}
      {isExpanded && (
        <div className="mt-3 space-y-3 pl-6">
          {/* Template Selector */}
          <div className="space-y-1.5">
            <label htmlFor="revision-template" className="text-xs text-muted-foreground">
              Template
            </label>
            <Select
              value={effectiveTemplateId}
              onValueChange={setSelectedTemplateId}
              disabled={isProcessing}
            >
              <SelectTrigger id="revision-template" className="h-8 text-sm">
                <SelectValue placeholder="Template wählen..." />
              </SelectTrigger>
              <SelectContent>
                {templates.map((template) => (
                  <SelectItem key={template.id} value={template.id}>
                    {template.name}
                    {template.isDefault && (
                      <span className="ml-2 text-xs text-muted-foreground">(Standard)</span>
                    )}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Segment Count */}
          <div className="text-sm text-muted-foreground">
            {segmentCount === 0 ? (
              <span className="text-amber-600 dark:text-amber-400">
                Keine Segmente gefiltert
              </span>
            ) : (
              <span>
                {segmentCount} Segment{segmentCount !== 1 ? "e" : ""} (gefiltert)
              </span>
            )}
          </div>

          {/* Progress Bar (when processing) */}
          {isProcessing && (
            <div className="space-y-1.5">
              <Progress value={progressPercent} className="h-2" />
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>
                  {processedCount} / {totalToProcess}
                </span>
                <span>{Math.round(progressPercent)}%</span>
              </div>
            </div>
          )}

          {/* Error Message */}
          {error && (
            <div className="text-sm text-destructive bg-destructive/10 rounded-md px-3 py-2">
              {error}
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-2">
            {isProcessing ? (
              <Button
                variant="outline"
                size="sm"
                className="flex-1"
                onClick={cancelRevision}
              >
                <X className="h-4 w-4 mr-1" />
                Abbrechen
              </Button>
            ) : (
              <Button
                variant="default"
                size="sm"
                className="flex-1"
                onClick={handleStart}
                disabled={segmentCount === 0 || !selectedTemplate}
              >
                {isProcessing ? (
                  <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                ) : (
                  <Sparkles className="h-4 w-4 mr-1" />
                )}
                Starten
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Batch Results Summary
 *
 * Shows accept all / reject all buttons when there are pending revisions.
 */
interface BatchResultsSummaryProps {
  pendingCount: number;
  acceptedCount: number;
  rejectedCount: number;
}

export function BatchResultsSummary({
  pendingCount,
  acceptedCount,
  rejectedCount,
}: BatchResultsSummaryProps) {
  const acceptAllRevisions = useTranscriptStore((s) => s.acceptAllRevisions);
  const rejectAllRevisions = useTranscriptStore((s) => s.rejectAllRevisions);
  const clearRevisions = useTranscriptStore((s) => s.clearRevisions);

  if (pendingCount === 0 && acceptedCount === 0 && rejectedCount === 0) {
    return null;
  }

  return (
    <div className="border-t pt-3 mt-3 space-y-2">
      <div className="text-xs text-muted-foreground">
        Revisionen: {pendingCount} ausstehend, {acceptedCount} übernommen, {rejectedCount} abgelehnt
      </div>

      {pendingCount > 0 && (
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            className="flex-1 text-destructive hover:text-destructive"
            onClick={rejectAllRevisions}
          >
            Alle ablehnen
          </Button>
          <Button
            variant="default"
            size="sm"
            className="flex-1"
            onClick={acceptAllRevisions}
          >
            Alle übernehmen
          </Button>
        </div>
      )}

      {pendingCount === 0 && (acceptedCount > 0 || rejectedCount > 0) && (
        <Button
          variant="ghost"
          size="sm"
          className="w-full text-muted-foreground"
          onClick={clearRevisions}
        >
          Ergebnisse löschen
        </Button>
      )}
    </div>
  );
}

