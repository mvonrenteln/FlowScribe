import { BookOpen, Copy, FileText, Loader2, Sparkles, Wand2 } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { useTranscriptStore } from "@/lib/store";
import {
  BUILTIN_TITLE_SUGGESTION_ID,
  BUILTIN_SUMMARY_GENERATION_ID,
  BUILTIN_NOTES_GENERATION_ID,
} from "@/lib/store/utils/chapterMetadataPrompts";
import { TitleSuggestionDialog } from "./TitleSuggestionDialog";

interface ChapterAIMenuProps {
  readonly chapterId: string;
  readonly onRewriteChapter: (chapterId: string) => void;
  readonly className?: string;
}

/**
 * ChapterAIMenu
 *
 * Quick-access AI actions for a chapter header.
 * Supports:
 * - Title suggestion
 * - Summary generation
 * - Notes generation
 * - Chapter rewrite
 */
export function ChapterAIMenu({
  chapterId,
  onRewriteChapter,
  className,
}: Readonly<ChapterAIMenuProps>) {
  const [showTitleDialog, setShowTitleDialog] = useState(false);

  // Store actions
  const suggestTitle = useTranscriptStore((state) => state.suggestChapterTitle);
  const generateSummary = useTranscriptStore((state) => state.generateChapterSummary);
  const generateNotes = useTranscriptStore((state) => state.generateChapterNotes);

  // Loading states
  const titleLoading = useTranscriptStore(
    (state) => state.chapterMetadataTitleLoading && state.chapterMetadataTitleChapterId === chapterId
  );
  const summaryLoading = useTranscriptStore(
    (state) => state.chapterMetadataSummaryLoading && state.chapterMetadataSummaryChapterId === chapterId
  );
  const notesLoading = useTranscriptStore(
    (state) => state.chapterMetadataNotesLoading && state.chapterMetadataNotesChapterId === chapterId
  );

  const handleSuggestTitle = () => {
    suggestTitle(chapterId, BUILTIN_TITLE_SUGGESTION_ID);
    setShowTitleDialog(true);
  };

  const handleGenerateSummary = () => {
    generateSummary(chapterId, BUILTIN_SUMMARY_GENERATION_ID);
  };

  const handleGenerateNotes = () => {
    generateNotes(chapterId, BUILTIN_NOTES_GENERATION_ID);
  };

  const isLoading = titleLoading || summaryLoading || notesLoading;

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className={cn("h-6 w-6 transition-opacity focus-visible:ring-0", className)}
            onClick={(event) => event.stopPropagation()}
            aria-label="Chapter AI actions"
            data-testid={`button-chapter-ai-${chapterId}`}
            disabled={isLoading}
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            ) : (
              <Sparkles className="h-4 w-4" />
            )}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuLabel>AI Chapter Actions</DropdownMenuLabel>
          <DropdownMenuSeparator />

          <DropdownMenuItem
            onClick={(e) => {
              e.stopPropagation();
              handleSuggestTitle();
            }}
            disabled={isLoading}
          >
            <Wand2 className="mr-2 h-4 w-4" />
            Suggest Title
          </DropdownMenuItem>

          <DropdownMenuItem
            onClick={(e) => {
              e.stopPropagation();
              handleGenerateSummary();
            }}
            disabled={isLoading}
          >
            <FileText className="mr-2 h-4 w-4" />
            Generate Summary
          </DropdownMenuItem>

          <DropdownMenuItem
            onClick={(e) => {
              e.stopPropagation();
              handleGenerateNotes();
            }}
            disabled={isLoading}
          >
            <BookOpen className="mr-2 h-4 w-4" />
            Generate Notes
          </DropdownMenuItem>

          <DropdownMenuSeparator />

          <DropdownMenuItem
            onClick={(e) => {
              e.stopPropagation();
              onRewriteChapter(chapterId);
            }}
            disabled={isLoading}
            className="text-purple-600 focus:text-purple-700"
          >
            <Sparkles className="mr-2 h-4 w-4" />
            Rewrite Chapter
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <TitleSuggestionDialog
        chapterId={chapterId}
        open={showTitleDialog}
        onOpenChange={setShowTitleDialog}
      />
    </>
  );
}
