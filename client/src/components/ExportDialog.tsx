import { Download, FileJson, FileText } from "lucide-react";
import { memo, useCallback, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { buildJSONExport } from "@/lib/exportUtils";
import type { Segment, Tag } from "@/lib/store";
import { useTranscriptStore } from "@/lib/store";
import { getSegmentTags } from "@/lib/store/utils/segmentTags";

interface ExportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  segments: Segment[];
  filteredSegments: Segment[];
  tags: Tag[];
  fileName?: string;
}

type ExportFormat = "json" | "srt" | "txt";

function formatSRT(segments: Segment[]): string {
  return segments
    .map((segment, index) => {
      const formatTime = (seconds: number): string => {
        const hrs = Math.floor(seconds / 3600);
        const mins = Math.floor((seconds % 3600) / 60);
        const secs = Math.floor(seconds % 60);
        const ms = Math.floor((seconds % 1) * 1000);
        return `${hrs.toString().padStart(2, "0")}:${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")},${ms.toString().padStart(3, "0")}`;
      };

      return `${index + 1}
${formatTime(segment.start)} --> ${formatTime(segment.end)}
[${segment.speaker}] ${segment.text}
`;
    })
    .join("\n");
}

const ExportDialogComponent = ({
  open,
  onOpenChange,
  segments,
  filteredSegments,
  tags,
  fileName = "transcript",
}: ExportDialogProps) => {
  const [format, setFormat] = useState<ExportFormat>("json");
  const [useFilters, setUseFilters] = useState(true);
  const [useRewritten, setUseRewritten] = useState(false);

  // Get chapters from store
  const chapters = useTranscriptStore((state) => state.chapters);

  // Pre-compute tagsById Map once
  const tagsById = useMemo(() => new Map(tags.map((t) => [t.id, t])), [tags]);

  // Determine which segments to export
  const segmentsToExport = useFilters ? filteredSegments : segments;

  // Pre-compute all export formats (only recalculates when segments/tags change)
  const exportedJSON = useMemo(
    () => JSON.stringify(buildJSONExport(segmentsToExport, tags, chapters), null, 2),
    [segmentsToExport, tags, chapters],
  );

  const exportedSRT = useMemo(() => formatSRT(segmentsToExport), [segmentsToExport]);

  const exportedTXT = useMemo(() => {
    // If useRewritten is enabled and there are chapters, try chapter-based export
    if (useRewritten && chapters.length > 0) {
      const parts: string[] = [];

      for (const chapter of chapters) {
        // Find segments in this chapter that are in segmentsToExport
        const chapterSegments = segmentsToExport.filter(
          (seg) =>
            segments.findIndex((s) => s.id === chapter.startSegmentId) <=
              segments.findIndex((s) => s.id === seg.id) &&
            segments.findIndex((s) => s.id === seg.id) <=
              segments.findIndex((s) => s.id === chapter.endSegmentId),
        );

        // Skip chapters with no segments in the export
        if (chapterSegments.length === 0) {
          continue;
        }

        // Chapter header
        parts.push(`# ${chapter.title}`);
        if (chapter.summary) {
          parts.push(`\n${chapter.summary}\n`);
        }

        // Use rewritten text if available, otherwise fall back to segments
        if (chapter.rewrittenText) {
          parts.push(chapter.rewrittenText);
        } else {
          const formatTime = (seconds: number): string => {
            const mins = Math.floor(seconds / 60);
            const secs = Math.floor(seconds % 60);
            return `${mins}:${secs.toString().padStart(2, "0")}`;
          };

          const segmentTexts = chapterSegments.map((segment) => {
            const segmentTagIds = getSegmentTags(segment);
            const tagNames = segmentTagIds
              .map((tagId) => tagsById.get(tagId)?.name)
              .filter((name): name is string => !!name);

            const speakerLabel =
              tagNames.length > 0 ? `${segment.speaker} (${tagNames.join(", ")})` : segment.speaker;

            return `[${formatTime(segment.start)}] ${speakerLabel}: ${segment.text}`;
          });

          parts.push(segmentTexts.join("\n\n"));
        }

        parts.push("\n\n");
      }

      return parts.join("\n");
    }

    // Default segment-based export
    return segmentsToExport
      .map((segment) => {
        const formatTime = (seconds: number): string => {
          const mins = Math.floor(seconds / 60);
          const secs = Math.floor(seconds % 60);
          return `${mins}:${secs.toString().padStart(2, "0")}`;
        };

        const segmentTagIds = getSegmentTags(segment);
        const tagNames = segmentTagIds
          .map((tagId) => tagsById.get(tagId)?.name)
          .filter((name): name is string => !!name);

        const speakerLabel =
          tagNames.length > 0 ? `${segment.speaker} (${tagNames.join(", ")})` : segment.speaker;

        return `[${formatTime(segment.start)}] ${speakerLabel}: ${segment.text}`;
      })
      .join("\n\n");
  }, [segmentsToExport, tagsById, useRewritten, chapters, segments]);

  // Memoize the export description text
  const exportDescription = useMemo(
    () =>
      useFilters
        ? `Export ${filteredSegments.length} of ${segments.length} segments`
        : `Export all ${segments.length} segments`,
    [useFilters, filteredSegments.length, segments.length],
  );

  const handleExport = useCallback(() => {
    let content: string;
    let mimeType: string;
    let extension: string;

    switch (format) {
      case "json":
        content = exportedJSON;
        mimeType = "application/json";
        extension = "json";
        break;
      case "srt":
        content = exportedSRT;
        mimeType = "text/srt";
        extension = "srt";
        break;
      case "txt":
        content = exportedTXT;
        mimeType = "text/plain";
        extension = "txt";
        break;
    }

    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${fileName}.${extension}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    onOpenChange(false);
  }, [format, exportedJSON, exportedSRT, exportedTXT, fileName, onOpenChange]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Export Transcript</DialogTitle>
          <DialogDescription>Choose a format to export your edited transcript.</DialogDescription>
        </DialogHeader>

        <div className="py-4">
          <RadioGroup value={format} onValueChange={(v) => setFormat(v as ExportFormat)}>
            <div className="flex items-start gap-3 p-3 rounded-md border hover-elevate cursor-pointer">
              <RadioGroupItem value="json" id="json" className="mt-1" />
              <Label htmlFor="json" className="flex-1 cursor-pointer">
                <div className="flex items-center gap-2">
                  <FileJson className="h-4 w-4 text-primary" />
                  <span className="font-medium">JSON</span>
                </div>
                <p className="text-sm text-muted-foreground mt-1">
                  WhisperX-compatible format with word-level timestamps
                </p>
              </Label>
            </div>

            <div className="flex items-start gap-3 p-3 rounded-md border hover-elevate cursor-pointer mt-2">
              <RadioGroupItem value="srt" id="srt" className="mt-1" />
              <Label htmlFor="srt" className="flex-1 cursor-pointer">
                <div className="flex items-center gap-2">
                  <FileText className="h-4 w-4 text-primary" />
                  <span className="font-medium">SRT Subtitles</span>
                </div>
                <p className="text-sm text-muted-foreground mt-1">
                  Standard subtitle format for video players
                </p>
              </Label>
            </div>

            <div className="flex items-start gap-3 p-3 rounded-md border hover-elevate cursor-pointer mt-2">
              <RadioGroupItem value="txt" id="txt" className="mt-1" />
              <Label htmlFor="txt" className="flex-1 cursor-pointer">
                <div className="flex items-center gap-2">
                  <FileText className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium">Plain Text</span>
                </div>
                <p className="text-sm text-muted-foreground mt-1">
                  Simple text with speaker labels and timestamps
                </p>
              </Label>
            </div>
          </RadioGroup>

          <div className="flex flex-col gap-3 mt-4 pt-4 border-t">
            <div className="flex items-center gap-2">
              <Checkbox
                id="use-filters"
                checked={useFilters}
                onCheckedChange={(checked) => setUseFilters(checked === true)}
              />
              <Label htmlFor="use-filters" className="cursor-pointer">
                <span className="font-medium">Apply active filters</span>
                <p className="text-sm text-muted-foreground">{exportDescription}</p>
              </Label>
            </div>

            {format === "txt" && chapters.length > 0 && (
              <div className="flex items-center gap-2">
                <Checkbox
                  id="use-rewritten"
                  checked={useRewritten}
                  onCheckedChange={(checked) => setUseRewritten(checked === true)}
                />
                <Label htmlFor="use-rewritten" className="cursor-pointer">
                  <span className="font-medium">Use rewritten text (where available)</span>
                  <p className="text-sm text-muted-foreground">
                    Organize by chapters and use rewritten text when available
                  </p>
                </Label>
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleExport} data-testid="button-export-confirm">
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export const ExportDialog = memo(ExportDialogComponent);
