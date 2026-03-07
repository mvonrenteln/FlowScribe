import { Download, FileJson, FileText } from "lucide-react";
import { memo, useCallback, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
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
import { buildJSONExport, buildTXTExport, buildVTTExport } from "@/lib/exportUtils";
import type { Segment, Tag } from "@/lib/store";
import { useTranscriptStore } from "@/lib/store";

interface ExportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  segments: Segment[];
  filteredSegments: Segment[];
  tags: Tag[];
  fileName?: string;
}

type ExportFormat = "json" | "srt" | "txt" | "vtt";

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
  fileName,
}: ExportDialogProps) => {
  const { t } = useTranslation();
  const resolvedFileName = fileName ?? t("export.dialog.defaultFileName");
  const [format, setFormat] = useState<ExportFormat>("json");
  const [useFilters, setUseFilters] = useState(true);
  const [useRewritten, setUseRewritten] = useState(false);
  const [includeChapterHeadings, setIncludeChapterHeadings] = useState(false);
  const [includeChapterSummaries, setIncludeChapterSummaries] = useState(false);

  // Get chapters from store
  const chapters = useTranscriptStore((state) => state.chapters);

  // Determine which segments to export
  const segmentsToExport = useFilters ? filteredSegments : segments;

  // Pre-compute all export formats (only recalculates when segments/tags change)
  const exportedJSON = useMemo(
    () => JSON.stringify(buildJSONExport(segmentsToExport, tags, chapters), null, 2),
    [segmentsToExport, tags, chapters],
  );

  const exportedSRT = useMemo(() => formatSRT(segmentsToExport), [segmentsToExport]);

  const exportedTXT = useMemo(() => {
    return buildTXTExport(segmentsToExport, segments, tags, chapters, {
      useRewrittenText: useRewritten,
      includeChapterHeadings,
      includeChapterSummaries,
    });
  }, [
    segmentsToExport,
    segments,
    tags,
    chapters,
    useRewritten,
    includeChapterHeadings,
    includeChapterSummaries,
  ]);

  const exportedVTT = useMemo(() => buildVTTExport(segmentsToExport), [segmentsToExport]);

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
      case "vtt":
        content = exportedVTT;
        mimeType = "text/vtt";
        extension = "vtt";
        break;
    }

    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${resolvedFileName}.${extension}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    onOpenChange(false);
  }, [format, exportedJSON, exportedSRT, exportedTXT, exportedVTT, resolvedFileName, onOpenChange]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("export.dialog.title")}</DialogTitle>
          <DialogDescription>{t("export.dialog.description")}</DialogDescription>
        </DialogHeader>

        <div className="py-4">
          <RadioGroup value={format} onValueChange={(v) => setFormat(v as ExportFormat)}>
            <div className="flex items-start gap-3 p-3 rounded-md border hover-elevate cursor-pointer">
              <RadioGroupItem value="json" id="json" className="mt-1" />
              <Label htmlFor="json" className="flex-1 cursor-pointer">
                <div className="flex items-center gap-2">
                  <FileJson className="h-4 w-4 text-primary" />
                  <span className="font-medium">{t("export.dialog.formats.json.title")}</span>
                </div>
                <p className="text-sm text-muted-foreground mt-1">
                  {t("export.dialog.formats.json.description")}
                </p>
              </Label>
            </div>

            <div className="flex items-start gap-3 p-3 rounded-md border hover-elevate cursor-pointer mt-2">
              <RadioGroupItem value="srt" id="srt" className="mt-1" />
              <Label htmlFor="srt" className="flex-1 cursor-pointer">
                <div className="flex items-center gap-2">
                  <FileText className="h-4 w-4 text-primary" />
                  <span className="font-medium">{t("export.dialog.formats.srt.title")}</span>
                </div>
                <p className="text-sm text-muted-foreground mt-1">
                  {t("export.dialog.formats.srt.description")}
                </p>
              </Label>
            </div>

            <div className="flex items-start gap-3 p-3 rounded-md border hover-elevate cursor-pointer mt-2">
              <RadioGroupItem value="txt" id="txt" className="mt-1" />
              <Label htmlFor="txt" className="flex-1 cursor-pointer">
                <div className="flex items-center gap-2">
                  <FileText className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium">{t("export.dialog.formats.txt.title")}</span>
                </div>
                <p className="text-sm text-muted-foreground mt-1">
                  {t("export.dialog.formats.txt.description")}
                </p>
              </Label>
            </div>

            <div className="flex items-start gap-3 p-3 rounded-md border hover-elevate cursor-pointer mt-2">
              <RadioGroupItem value="vtt" id="vtt" className="mt-1" />
              <Label htmlFor="vtt" className="flex-1 cursor-pointer">
                <div className="flex items-center gap-2">
                  <FileText className="h-4 w-4 text-primary" />
                  <span className="font-medium">{t("export.dialog.formats.vtt.title")}</span>
                </div>
                <p className="text-sm text-muted-foreground mt-1">
                  {t("export.dialog.formats.vtt.description")}
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
                <span className="font-medium">{t("export.dialog.applyFilters")}</span>
                <p className="text-sm text-muted-foreground">
                  {useFilters
                    ? t("export.dialog.exportFiltered", {
                        count: filteredSegments.length,
                        total: segments.length,
                      })
                    : t("export.dialog.exportAll", { count: segments.length })}
                </p>
              </Label>
            </div>

            {format === "txt" && chapters.length > 0 && (
              <div className="flex flex-col gap-3">
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="use-rewritten"
                    checked={useRewritten}
                    onCheckedChange={(checked) => setUseRewritten(checked === true)}
                  />
                  <Label htmlFor="use-rewritten" className="cursor-pointer">
                    <span className="font-medium">{t("export.dialog.useRewrittenText")}</span>
                    <p className="text-sm text-muted-foreground">
                      {t("export.dialog.useRewrittenTextDescription")}
                    </p>
                  </Label>
                </div>

                <div className="flex items-center gap-2">
                  <Checkbox
                    id="include-chapter-headings"
                    checked={includeChapterHeadings}
                    onCheckedChange={(checked) => setIncludeChapterHeadings(checked === true)}
                  />
                  <Label htmlFor="include-chapter-headings" className="cursor-pointer">
                    <span className="font-medium">{t("export.dialog.includeChapterHeadings")}</span>
                    <p className="text-sm text-muted-foreground">
                      {t("export.dialog.includeChapterHeadingsDescription")}
                    </p>
                  </Label>
                </div>

                <div className="flex items-center gap-2">
                  <Checkbox
                    id="include-chapter-summaries"
                    checked={includeChapterSummaries}
                    onCheckedChange={(checked) => setIncludeChapterSummaries(checked === true)}
                  />
                  <Label htmlFor="include-chapter-summaries" className="cursor-pointer">
                    <span className="font-medium">
                      {t("export.dialog.includeChapterSummaries")}
                    </span>
                    <p className="text-sm text-muted-foreground">
                      {t("export.dialog.includeChapterSummariesDescription")}
                    </p>
                  </Label>
                </div>
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t("export.dialog.cancel")}
          </Button>
          <Button onClick={handleExport} data-testid="button-export-confirm">
            <Download className="h-4 w-4 mr-2" />
            {t("export.dialog.export")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export const ExportDialog = memo(ExportDialogComponent);
