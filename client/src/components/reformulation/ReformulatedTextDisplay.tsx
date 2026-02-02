/**
 * ReformulatedTextDisplay Component
 *
 * Displays reformulated chapter text as editable paragraphs.
 * Paragraphs are split by double newlines (\n\n).
 */

import { useCallback, useMemo, useState } from "react";
import { createSearchRegex, findMatchesInText } from "@/lib/searchUtils";
import { useStore } from "@/lib/store";
import { ReformulatedParagraph } from "./ReformulatedParagraph";

interface ReformulatedTextDisplayProps {
  /** Chapter ID */
  chapterId: string;
  /** Reformulated text */
  text: string;
  /** Search query for highlighting */
  searchQuery?: string;
  /** Whether to use regex search */
  isRegexSearch?: boolean;
}

export function ReformulatedTextDisplay({
  chapterId,
  text,
  searchQuery = "",
  isRegexSearch = false,
}: ReformulatedTextDisplayProps) {
  const [selectedParagraphIndex, setSelectedParagraphIndex] = useState<number | null>(null);
  const updateChapterReformulation = useStore((s) => s.updateChapterReformulation);

  // Split text into paragraphs by double newline
  const paragraphs = text.split(/\n\n+/).filter((p) => p.trim().length > 0);

  // Build search regex
  const searchRegex = useMemo(() => {
    const trimmedQuery = searchQuery.trim();
    if (!trimmedQuery) return null;
    return createSearchRegex(trimmedQuery, isRegexSearch);
  }, [searchQuery, isRegexSearch]);

  // Find matches in each paragraph
  const paragraphMatches = useMemo(() => {
    if (!searchRegex) return [];
    return paragraphs.map((paragraph) => findMatchesInText(paragraph, searchRegex));
  }, [paragraphs, searchRegex]);

  const handleParagraphChange = useCallback(
    (index: number, newText: string) => {
      // Reconstruct full text with updated paragraph
      const updatedParagraphs = [...paragraphs];
      updatedParagraphs[index] = newText;
      const updatedText = updatedParagraphs.join("\n\n");

      updateChapterReformulation(chapterId, updatedText);
    },
    [chapterId, paragraphs, updateChapterReformulation],
  );

  if (paragraphs.length === 0) {
    return (
      <div className="flex h-full items-center justify-center text-muted-foreground">
        <p className="text-sm">Kein reformulierter Text vorhanden.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4 p-4">
      {paragraphs.map((paragraph, index) => (
        <ReformulatedParagraph
          key={index}
          text={paragraph}
          index={index}
          onTextChange={(newText) => handleParagraphChange(index, newText)}
          isSelected={selectedParagraphIndex === index}
          onSelect={() => setSelectedParagraphIndex(index)}
          searchMatches={paragraphMatches[index] || []}
        />
      ))}
    </div>
  );
}
