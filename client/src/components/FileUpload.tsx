import { FileAudio, FileText, RotateCcw, Upload } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  clearAudioHandle,
  loadAudioHandle,
  requestAudioHandlePermission,
  saveAudioHandle,
} from "@/lib/audioHandleStorage";

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
  const [audioHandle, setAudioHandle] = useState<FileSystemFileHandle | null>(null);

  useEffect(() => {
    let isMounted = true;
    loadAudioHandle()
      .then((handle) => {
        if (isMounted) {
          setAudioHandle(handle);
        }
      })
      .catch((err) => {
        console.error("Failed to load saved audio handle:", err);
      });
    return () => {
      isMounted = false;
    };
  }, []);

  const handleAudioChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
        clearAudioHandle()
          .then(() => setAudioHandle(null))
          .catch((err) => {
            console.error("Failed to clear saved audio handle:", err);
          });
        onAudioUpload(file);
      }
    },
    [onAudioUpload],
  );

  const handleAudioPick = useCallback(async () => {
    const picker = (
      window as Window & {
        showOpenFilePicker?: (options?: {
          types?: Array<{
            description?: string;
            accept: Record<string, string[]>;
          }>;
          multiple?: boolean;
          excludeAcceptAllOption?: boolean;
        }) => Promise<FileSystemFileHandle[]>;
      }
    ).showOpenFilePicker;

    if (!picker) {
      audioInputRef.current?.click();
      return;
    }

    try {
      const [handle] = await picker({
        multiple: false,
        types: [
          {
            description: "Audio files",
            accept: {
              "audio/*": [".mp3", ".wav", ".m4a", ".ogg", ".flac"],
            },
          },
        ],
      });
      if (!handle) return;
      const file = await handle.getFile();
      await saveAudioHandle(handle);
      setAudioHandle(handle);
      onAudioUpload(file);
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return;
      console.error("Failed to pick audio file:", err);
    }
  }, [onAudioUpload]);

  const handleRestoreAudio = useCallback(async () => {
    if (!audioHandle) return;
    const granted = await requestAudioHandlePermission(audioHandle);
    if (!granted) return;
    try {
      const file = await audioHandle.getFile();
      onAudioUpload(file);
    } catch (err) {
      console.error("Failed to restore audio file:", err);
    }
  }, [audioHandle, onAudioUpload]);

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
          onClick={handleAudioPick}
          data-testid="button-upload-audio"
        >
          <FileAudio className="h-4 w-4 mr-2" />
          {audioFileName || "Load Audio"}
        </Button>

        {!audioFileName && audioHandle && (
          <Button variant="outline" onClick={handleRestoreAudio} data-testid="button-restore-audio">
            <RotateCcw className="h-4 w-4 mr-2" />
            Reopen Audio
          </Button>
        )}

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
