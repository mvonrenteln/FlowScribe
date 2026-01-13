import { Download, FileJson, FileText } from "lucide-react";
import { useState } from "react";
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
import type { Segment, Tag } from "@/lib/store";
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

function formatTXT(segments: Segment[], tags: Tag[]): string {
  const tagsById = new Map(tags.map((t) => [t.id, t]));

  return segments
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
}

export function ExportDialog({
  open,
  onOpenChange,
  segments,
  filteredSegments,
  tags,
  fileName = "transcript",
}: ExportDialogProps) {
  const [format, setFormat] = useState<ExportFormat>("json");
  const [useFilters, setUseFilters] = useState(true);

  const handleExport = () => {
    const segmentsToExport = useFilters ? filteredSegments : segments;
    let content: string;
    let mimeType: string;
    let extension: string;

    switch (format) {
      case "json":
        content = JSON.stringify(
          {
            segments: segmentsToExport.map((seg) => ({
              ...seg,
              tags: seg.tags || [],
            })),
          },
          null,
          2,
        );
        mimeType = "application/json";
        extension = "json";
        break;
      case "srt":
        content = formatSRT(segmentsToExport);
        mimeType = "text/srt";
        extension = "srt";
        break;
      case "txt":
        content = formatTXT(segmentsToExport, tags);
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
  };

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

          <div className="flex items-center gap-2 mt-4 pt-4 border-t">
            <Checkbox
              id="use-filters"
              checked={useFilters}
              onCheckedChange={(checked) => setUseFilters(checked === true)}
            />
            <Label htmlFor="use-filters" className="cursor-pointer">
              <span className="font-medium">Apply active filters</span>
              <p className="text-sm text-muted-foreground">
                {useFilters
                  ? `Export ${filteredSegments.length} of ${segments.length} segments`
                  : `Export all ${segments.length} segments`}
              </p>
            </Label>
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
}
