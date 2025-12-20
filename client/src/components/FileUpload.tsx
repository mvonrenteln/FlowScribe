import { FileAudio, FileText, Upload } from "lucide-react";
import { useCallback, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

interface FileUploadProps {
  onAudioUpload: (file: File) => void;
  onTranscriptUpload: (data: unknown) => void;
  audioFileName?: string;
  transcriptLoaded?: boolean;
}

export function FileUpload({
  onAudioUpload,
  onTranscriptUpload,
  audioFileName,
  transcriptLoaded,
}: FileUploadProps) {
  const audioInputRef = useRef<HTMLInputElement>(null);
  const transcriptInputRef = useRef<HTMLInputElement>(null);

  const handleAudioChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
        onAudioUpload(file);
      }
    },
    [onAudioUpload],
  );

  const handleTranscriptChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = (event) => {
          try {
            const data = JSON.parse(event.target?.result as string);
            onTranscriptUpload(data);
          } catch (err) {
            console.error("Failed to parse transcript JSON:", err);
          }
        };
        reader.readAsText(file);
      }
    },
    [onTranscriptUpload],
  );

  return (
    <Card className="p-4">
      <div className="flex flex-wrap items-center gap-3">
        <input
          ref={audioInputRef}
          type="file"
          accept="audio/*,.mp3,.wav,.m4a,.ogg,.flac"
          onChange={handleAudioChange}
          className="hidden"
          data-testid="input-audio-file"
        />
        <input
          ref={transcriptInputRef}
          type="file"
          accept=".json"
          onChange={handleTranscriptChange}
          className="hidden"
          data-testid="input-transcript-file"
        />

        <Button
          variant={audioFileName ? "secondary" : "default"}
          onClick={() => audioInputRef.current?.click()}
          data-testid="button-upload-audio"
        >
          <FileAudio className="h-4 w-4 mr-2" />
          {audioFileName || "Load Audio"}
        </Button>

        <Button
          variant={transcriptLoaded ? "secondary" : "outline"}
          onClick={() => transcriptInputRef.current?.click()}
          data-testid="button-upload-transcript"
        >
          <FileText className="h-4 w-4 mr-2" />
          {transcriptLoaded ? "Transcript Loaded" : "Load Transcript"}
        </Button>

        {!audioFileName && !transcriptLoaded && (
          <span className="text-sm text-muted-foreground">
            <Upload className="h-4 w-4 inline mr-1" />
            Drop files or click to upload
          </span>
        )}
      </div>
    </Card>
  );
}
