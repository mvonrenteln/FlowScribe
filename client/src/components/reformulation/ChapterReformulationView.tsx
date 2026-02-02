/**
 * ChapterReformulationView Component
 *
 * Split-view for chapter reformulation with original segments on the left
 * and reformulated text on the right. Includes Accept/Reject/Regenerate actions.
 */

import { Check, Loader2, RotateCw, X, XCircle } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { useSegmentIndexById, useTranscriptStore } from "@/lib/store";
import { getChapterRangeIndices } from "@/lib/store/utils/chapters";
import { cn } from "@/lib/utils";
import { ReformulatedTextDisplay } from "./ReformulatedTextDisplay";

interface ChapterReformulationViewProps {
  /** Chapter ID being reformulated */
  chapterId: string;
  /** Called when user closes the view */
  onClose: () => void;
}

export function ChapterReformulationView({ chapterId, onClose }: ChapterReformulationViewProps) {
  const { t } = useTranslation();
  const chapters = useTranscriptStore((s) => s.chapters);
  const segments = useTranscriptStore((s) => s.segments);
  const indexById = useSegmentIndexById();
  const chapter = useMemo(
    () => chapters.find((item) => item.id === chapterId),
    [chapters, chapterId],
  );
  const chapterSegments = useMemo(() => {
    if (!chapter) return [];
    const range = getChapterRangeIndices(chapter, indexById);
    if (!range) return [];
    return segments.slice(range.startIndex, range.endIndex + 1);
  }, [chapter, indexById, segments]);
  const reformulationInProgress = useTranscriptStore((s) => s.reformulationInProgress);
  const reformulationChapterId = useTranscriptStore((s) => s.reformulationChapterId);
  const reformulationError = useTranscriptStore((s) => s.reformulationError);
  const setChapterReformulation = useTranscriptStore((s) => s.setChapterReformulation);
  const cancelReformulation = useTranscriptStore((s) => s.cancelReformulation);
  const startReformulation = useTranscriptStore((s) => s.startReformulation);

  const [reformulatedText, setReformulatedText] = useState<string>("");
  const [promptId, setPromptId] = useState<string>("");
  const [isMounted, setIsMounted] = useState(false);

  // Check if reformulation is in progress for this chapter
  const isProcessing = reformulationInProgress && reformulationChapterId === chapterId;

  // Update reformulated text when chapter updates
  useEffect(() => {
    if (chapter?.reformulatedText) {
      setReformulatedText(chapter.reformulatedText);
      setPromptId(chapter.reformulationPromptId || "");
    }
  }, [chapter?.reformulatedText, chapter?.reformulationPromptId]);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    return () => {
      document.body.style.pointerEvents = "";
      document.documentElement.style.pointerEvents = "";
    };
  }, []);

  const handleAccept = useCallback(() => {
    if (!chapter || !reformulatedText) return;

    setChapterReformulation(chapterId, reformulatedText, {
      promptId,
      providerId: chapter.reformulationContext?.providerId,
      model: chapter.reformulationContext?.model,
    });

    onClose();
  }, [chapter, chapterId, reformulatedText, promptId, setChapterReformulation, onClose]);

  const handleReject = useCallback(() => {
    cancelReformulation();
    onClose();
  }, [cancelReformulation, onClose]);

  const handleRegenerate = useCallback(() => {
    if (!promptId) return;
    startReformulation(chapterId, promptId);
  }, [chapterId, promptId, startReformulation]);

  if (!chapter || !isMounted) {
    return null;
  }

  const content = (
    <div
      className="fixed inset-0 z-[60] flex flex-col bg-background pointer-events-auto"
      data-testid="chapter-reformulation-view"
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border bg-muted/30 px-4 py-3">
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-semibold">{t("reformulation.view.title")}</h2>
          <span className="text-sm text-muted-foreground">— {chapter.title}</span>
        </div>

        <Button variant="ghost" size="icon" onClick={handleReject}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Split View */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left: Original Segments */}
        <div className="flex w-1/2 flex-col border-r border-border">
          <div className="border-b border-border bg-muted/20 px-4 py-2">
            <h3 className="text-sm font-medium text-muted-foreground">
              {t("reformulation.view.originalLabel", { count: chapterSegments.length })}
            </h3>
          </div>

          <div className="flex-1 overflow-y-auto p-4">
            <div className="space-y-3">
              {chapterSegments.map((segment) => (
                <div key={segment.id} className="rounded border border-border bg-background p-3">
                  <div className="mb-1 text-xs font-medium text-muted-foreground">
                    {segment.speaker}
                  </div>
                  <p className="whitespace-pre-wrap text-sm leading-relaxed">{segment.text}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right: Reformulated Text */}
        <div className="flex w-1/2 flex-col">
          <div className="border-b border-border bg-muted/20 px-4 py-2">
            <h3 className="text-sm font-medium text-muted-foreground">
              {t("reformulation.view.reformulatedLabel")}
            </h3>
          </div>

          <div className="flex-1 overflow-y-auto">
            {isProcessing ? (
              <div className="flex h-full items-center justify-center">
                <div className="flex flex-col items-center gap-3">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                  <p className="text-sm text-muted-foreground">
                    {t("reformulation.view.processing")}
                  </p>
                </div>
              </div>
            ) : reformulationError ? (
              <div className="flex h-full items-center justify-center">
                <div className="flex flex-col items-center gap-3">
                  <XCircle className="h-8 w-8 text-destructive" />
                  <p className="text-sm text-destructive">{reformulationError}</p>
                  <Button size="sm" variant="outline" onClick={handleRegenerate}>
                    <RotateCw className="mr-2 h-3 w-3" />
                    {t("reformulation.view.retry")}
                  </Button>
                </div>
              </div>
            ) : reformulatedText ? (
              <ReformulatedTextDisplay chapterId={chapterId} text={reformulatedText} />
            ) : (
              <div className="flex h-full items-center justify-center">
                <p className="text-sm text-muted-foreground">{t("reformulation.view.waiting")}</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Footer Actions */}
      <div className="flex items-center justify-between border-t border-border bg-muted/30 px-4 py-3">
        <div className="text-sm text-muted-foreground">
          {reformulatedText &&
            t("reformulation.view.wordCount", {
              reformulated: reformulatedText.split(/\s+/).length,
              original: chapterSegments.reduce((sum, s) => sum + s.text.split(/\s+/).length, 0),
            })}
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={handleReject}
            disabled={isProcessing}
            className="min-w-24"
          >
            <XCircle className="mr-2 h-4 w-4" />
            {t("reformulation.actions.reject")}
          </Button>

          <Button
            variant="outline"
            onClick={handleRegenerate}
            disabled={isProcessing || !promptId}
            className="min-w-24"
          >
            <RotateCw className={cn("mr-2 h-4 w-4", isProcessing && "animate-spin")} />
            {t("reformulation.actions.regenerate")}
          </Button>

          <Button
            variant="default"
            onClick={handleAccept}
            disabled={isProcessing || !reformulatedText || !!reformulationError}
            className="min-w-24"
          >
            <Check className="mr-2 h-4 w-4" />
            {t("reformulation.actions.accept")}
          </Button>
        </div>
      </div>
    </div>
  );

  return createPortal(content, document.body);
}
