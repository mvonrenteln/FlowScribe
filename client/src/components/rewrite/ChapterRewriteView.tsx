/**
 * ChapterRewriteView Component
 *
 * Split-view for chapter rewrite with original segments on the left
 * and rewritten text on the right. Includes Accept/Reject/Regenerate actions.
 */

import { Check, Loader2, RotateCw, X, XCircle } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { useTranscriptStore } from "@/lib/store";
import { cn } from "@/lib/utils";
import { ChapterRewriteDialog } from "./ChapterRewriteDialog";
import { RewrittenTextDisplay } from "./RewrittenTextDisplay";

interface ChapterRewriteViewProps {
  /** Chapter ID being rewritten */
  chapterId: string;
  /** Called when user closes the view */
  onClose: () => void;
  /** Optional trigger element to return focus to when closing */
  triggerElement?: HTMLElement | null;
}

export function ChapterRewriteView({
  chapterId,
  onClose,
  triggerElement,
}: ChapterRewriteViewProps) {
  const { t } = useTranslation();
  const chapters = useTranscriptStore((s) => s.chapters);
  const chapter = useMemo(
    () => chapters.find((item) => item.id === chapterId),
    [chapters, chapterId],
  );
  const chapterSegments = useTranscriptStore((state) => state.selectSegmentsInChapter(chapterId));
  const rewriteInProgress = useTranscriptStore((s) => s.rewriteInProgress);
  const rewriteChapterId = useTranscriptStore((s) => s.rewriteChapterId);
  const rewriteError = useTranscriptStore((s) => s.rewriteError);
  const setChapterRewrite = useTranscriptStore((s) => s.setChapterRewrite);
  const setChapterDisplayMode = useTranscriptStore((s) => s.setChapterDisplayMode);
  const cancelRewrite = useTranscriptStore((s) => s.cancelRewrite);
  const startRewrite = useTranscriptStore((s) => s.startRewrite);
  const paragraphRewriteInProgress = useTranscriptStore((s) => s.paragraphRewriteInProgress);
  const paragraphRewriteChapterId = useTranscriptStore((s) => s.paragraphRewriteChapterId);
  const paragraphRewriteParagraphIndex = useTranscriptStore(
    (s) => s.paragraphRewriteParagraphIndex,
  );

  const [rewrittenText, setRewrittenText] = useState<string>("");
  const [promptId, setPromptId] = useState<string>("");
  const [isMounted, setIsMounted] = useState(false);
  const [paragraphDialogOpen, setParagraphDialogOpen] = useState(false);
  const [paragraphDialogIndex, setParagraphDialogIndex] = useState<number | null>(null);

  // Refs for focus management
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  // Check if rewrite is in progress for this chapter
  const isProcessing = rewriteInProgress && rewriteChapterId === chapterId;

  // Update rewritten text when chapter updates
  useEffect(() => {
    if (chapter?.rewrittenText) {
      setRewrittenText(chapter.rewrittenText);
      setPromptId(chapter.rewritePromptId || "");
    }
  }, [chapter?.rewrittenText, chapter?.rewritePromptId]);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    return () => {
      document.body.style.pointerEvents = "";
      document.documentElement.style.pointerEvents = "";
    };
  }, []);

  // Focus management: Set initial focus and return focus on unmount
  useEffect(() => {
    if (!isMounted) return;

    // Set initial focus to close button
    closeButtonRef.current?.focus();

    // Return focus to trigger element on unmount
    return () => {
      if (triggerElement && document.body.contains(triggerElement)) {
        triggerElement.focus();
      }
    };
  }, [isMounted, triggerElement]);

  // Focus trap
  useEffect(() => {
    if (!isMounted || !dialogRef.current) return;

    const dialog = dialogRef.current;
    const focusableSelector =
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';

    const handleFocusTrap = (e: FocusEvent) => {
      const target = e.target;
      if (!(target instanceof Node)) return;

      // If focus moved outside the dialog, bring it back
      if (!dialog.contains(target)) {
        e.preventDefault();
        closeButtonRef.current?.focus();
      }
    };

    const handleTabKey = (e: KeyboardEvent) => {
      if (e.key !== "Tab") return;

      const focusableElements = Array.from(
        dialog.querySelectorAll<HTMLElement>(focusableSelector),
      ).filter((el) => !el.hasAttribute("disabled"));

      if (focusableElements.length === 0) return;

      const firstElement = focusableElements[0];
      const lastElement = focusableElements[focusableElements.length - 1];

      if (e.shiftKey) {
        // Shift + Tab
        if (document.activeElement === firstElement) {
          e.preventDefault();
          lastElement?.focus();
        }
      } else {
        // Tab
        if (document.activeElement === lastElement) {
          e.preventDefault();
          firstElement?.focus();
        }
      }
    };

    document.addEventListener("focusin", handleFocusTrap);
    dialog.addEventListener("keydown", handleTabKey);

    return () => {
      document.removeEventListener("focusin", handleFocusTrap);
      dialog.removeEventListener("keydown", handleTabKey);
    };
  }, [isMounted]);

  const handleAccept = useCallback(() => {
    if (!chapter || !rewrittenText) return;

    setChapterRewrite(chapterId, rewrittenText, {
      promptId,
      providerId: chapter.rewriteContext?.providerId,
      model: chapter.rewriteContext?.model,
    });

    // Automatically switch to rewritten view after accepting
    setChapterDisplayMode(chapterId, "rewritten");

    onClose();
  }, [
    chapter,
    chapterId,
    rewrittenText,
    promptId,
    setChapterRewrite,
    setChapterDisplayMode,
    onClose,
  ]);

  const handleReject = useCallback(() => {
    cancelRewrite();
    onClose();
  }, [cancelRewrite, onClose]);

  // Escape key handler (must be after handleReject definition)
  useEffect(() => {
    if (!isMounted) return;

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        handleReject();
      }
    };

    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [isMounted, handleReject]);

  const handleRegenerate = useCallback(() => {
    if (!promptId) return;
    startRewrite(chapterId, promptId);
  }, [chapterId, promptId, startRewrite]);

  const handleRefineParagraph = useCallback((index: number) => {
    setParagraphDialogIndex(index);
    setParagraphDialogOpen(true);
  }, []);

  if (!chapter || !isMounted) {
    return null;
  }

  const content = (
    <div
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-labelledby="rewrite-view-title"
      aria-describedby="rewrite-view-description"
      className="fixed inset-0 z-[60] flex flex-col bg-background pointer-events-auto"
      data-testid="chapter-rewrite-view"
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border bg-muted/30 px-4 py-3">
        <div className="flex items-center gap-2">
          <h2 id="rewrite-view-title" className="text-lg font-semibold">
            {t("rewrite.view.title")}
          </h2>
          <span id="rewrite-view-description" className="text-sm text-muted-foreground">
            — {chapter.title}
          </span>
        </div>

        <Button
          ref={closeButtonRef}
          variant="ghost"
          size="icon"
          onClick={handleReject}
          aria-label={t("rewrite.view.close", { defaultValue: "Schließen" })}
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Split View */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left: Original Segments */}
        <div className="flex w-1/2 flex-col border-r border-border">
          <div className="border-b border-border bg-muted/20 px-4 py-2">
            <h3 className="text-sm font-medium text-muted-foreground">
              {t("rewrite.view.originalLabel", { count: chapterSegments.length })}
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

        {/* Right: Rewritten Text */}
        <div className="flex w-1/2 flex-col">
          <div className="border-b border-border bg-muted/20 px-4 py-2">
            <h3 className="text-sm font-medium text-muted-foreground">
              {t("rewrite.view.rewrittenLabel")}
            </h3>
          </div>

          <div className="flex-1 overflow-y-auto">
            {isProcessing ? (
              <div className="flex h-full items-center justify-center">
                <div className="flex flex-col items-center gap-3">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                  <p className="text-sm text-muted-foreground">{t("rewrite.view.processing")}</p>
                </div>
              </div>
            ) : rewriteError ? (
              <div className="flex h-full items-center justify-center">
                <div className="flex flex-col items-center gap-3">
                  <XCircle className="h-8 w-8 text-destructive" />
                  <p className="text-sm text-destructive">{rewriteError}</p>
                  <Button size="sm" variant="outline" onClick={handleRegenerate}>
                    <RotateCw className="mr-2 h-3 w-3" />
                    {t("rewrite.view.retry")}
                  </Button>
                </div>
              </div>
            ) : rewrittenText ? (
              <RewrittenTextDisplay
                chapterId={chapterId}
                text={rewrittenText}
                onRefineParagraph={handleRefineParagraph}
                refiningParagraphIndex={
                  paragraphRewriteChapterId === chapterId ? paragraphRewriteParagraphIndex : null
                }
                refineDisabled={paragraphRewriteInProgress}
              />
            ) : (
              <div className="flex h-full items-center justify-center">
                <p className="text-sm text-muted-foreground">{t("rewrite.view.waiting")}</p>
              </div>
            )}
          </div>
        </div>
      </div>

      <ChapterRewriteDialog
        open={paragraphDialogOpen}
        onOpenChange={(open) => {
          setParagraphDialogOpen(open);
          if (!open) {
            setParagraphDialogIndex(null);
          }
        }}
        chapterId={chapterId}
        mode="paragraph"
        paragraphIndex={paragraphDialogIndex ?? undefined}
      />

      {/* Footer Actions */}
      <div className="flex items-center justify-between border-t border-border bg-muted/30 px-4 py-3">
        <div className="text-sm text-muted-foreground">
          {rewrittenText &&
            t("rewrite.view.wordCount", {
              rewritten: rewrittenText.split(/\s+/).length,
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
            {t("rewrite.actions.reject")}
          </Button>

          <Button
            variant="outline"
            onClick={handleRegenerate}
            disabled={isProcessing || !promptId}
            className="min-w-24"
          >
            <RotateCw className={cn("mr-2 h-4 w-4", isProcessing && "animate-spin")} />
            {t("rewrite.actions.regenerate")}
          </Button>

          <Button
            variant="default"
            onClick={handleAccept}
            disabled={isProcessing || !rewrittenText || !!rewriteError}
            className="min-w-24"
          >
            <Check className="mr-2 h-4 w-4" />
            {t("rewrite.actions.accept")}
          </Button>
        </div>
      </div>
    </div>
  );

  return createPortal(content, document.body);
}
