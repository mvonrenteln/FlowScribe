import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Download, FileJson, FileText } from 'lucide-react';
import type { Segment } from '@/lib/store';

interface ExportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  segments: Segment[];
  fileName?: string;
}

type ExportFormat = 'json' | 'srt' | 'txt';

function formatSRT(segments: Segment[]): string {
  return segments.map((segment, index) => {
    const formatTime = (seconds: number): string => {
      const hrs = Math.floor(seconds / 3600);
      const mins = Math.floor((seconds % 3600) / 60);
      const secs = Math.floor(seconds % 60);
      const ms = Math.floor((seconds % 1) * 1000);
      return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')},${ms.toString().padStart(3, '0')}`;
    };

    return `${index + 1}
${formatTime(segment.start)} --> ${formatTime(segment.end)}
[${segment.speaker}] ${segment.text}
`;
  }).join('\n');
}

function formatTXT(segments: Segment[]): string {
  return segments.map(segment => {
    const formatTime = (seconds: number): string => {
      const mins = Math.floor(seconds / 60);
      const secs = Math.floor(seconds % 60);
      return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    return `[${formatTime(segment.start)}] ${segment.speaker}: ${segment.text}`;
  }).join('\n\n');
}

export function ExportDialog({ 
  open, 
  onOpenChange, 
  segments,
  fileName = 'transcript'
}: ExportDialogProps) {
  const [format, setFormat] = useState<ExportFormat>('json');

  const handleExport = () => {
    let content: string;
    let mimeType: string;
    let extension: string;

    switch (format) {
      case 'json':
        content = JSON.stringify({ segments }, null, 2);
        mimeType = 'application/json';
        extension = 'json';
        break;
      case 'srt':
        content = formatSRT(segments);
        mimeType = 'text/srt';
        extension = 'srt';
        break;
      case 'txt':
        content = formatTXT(segments);
        mimeType = 'text/plain';
        extension = 'txt';
        break;
    }

    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
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
          <DialogDescription>
            Choose a format to export your edited transcript.
          </DialogDescription>
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
