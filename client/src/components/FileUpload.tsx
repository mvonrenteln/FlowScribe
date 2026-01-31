import { FileAudio, FileText, RotateCcw, Upload } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  buildAudioRefKey,
  clearAudioHandleForAudioRef,
  loadAudioHandleForAudioRef,
  requestAudioHandlePermission,
  saveAudioHandleForAudioRef,
} from "@/lib/audioHandleStorage";
import confirmIfLargeAudio from "@/lib/confirmLargeFile";
import { buildFileReference, type FileReference } from "@/lib/fileReference";
import { useTranscriptStore } from "@/lib/store";

interface FileUploadProps {
  onAudioUpload: (file: File) => void;
  onTranscriptUpload: (data: unknown, reference?: FileReference | null) => void;
  audioFileName?: string;
  transcriptFileName?: string;
  transcriptLoaded?: boolean;
  variant?: "card" | "inline";
  revisionName?: string | null;
}

// confirmIfLargeAudio moved to shared utility to allow reuse across restore flows

export function FileUpload({
  onAudioUpload,
  onTranscriptUpload,
  audioFileName,
  transcriptFileName,
  transcriptLoaded,
  variant = "card",
  revisionName,
}: FileUploadProps) {
  const audioInputRef = useRef<HTMLInputElement>(null);
  const transcriptInputRef = useRef<HTMLInputElement>(null);
  const [audioHandle, setAudioHandle] = useState<FileSystemFileHandle | null>(null);
  const [localTranscriptFileName, setLocalTranscriptFileName] = useState<string | undefined>(
    transcriptFileName,
  );

  // Get audioRef from store to compute audio reference key for handle storage
  const audioRef = useTranscriptStore((state) => state.audioRef);
  const audioRefKey = audioRef ? buildAudioRefKey(audioRef) : null;

  useEffect(() => {
    if (!audioRefKey) return;

    let isMounted = true;
    loadAudioHandleForAudioRef(audioRefKey)
      .then((handle) => {
        if (isMounted) {
          setAudioHandle(handle);
        }
      })
      .catch((err) => {
        console.error("Failed to load saved audio handle:", err);
      });
    // Listen for external changes to the stored handle (save/clear) so we
    // can update the `Reopen Audio` button immediately.
    const onHandleUpdated = (ev: Event) => {
      try {
        const ce = ev as CustomEvent<{ audioRefKey?: string; present?: boolean }>;
        // Only react to updates for this audio
        if (ce?.detail?.audioRefKey !== audioRefKey) return;
        if (ce?.detail?.present === false) {
          setAudioHandle(null);
          return;
        }
      } catch (_e) {
        // ignore
      }
      // If present or unknown, reload the handle from storage.
      loadAudioHandleForAudioRef(audioRefKey)
        .then((h) => setAudioHandle(h))
        .catch((err) => console.error("Failed to reload saved audio handle:", err));
    };
    window.addEventListener("flowscribe:audio-handle-updated", onHandleUpdated as EventListener);
    return () => {
      isMounted = false;
      window.removeEventListener(
        "flowscribe:audio-handle-updated",
        onHandleUpdated as EventListener,
      );
    };
  }, [audioRefKey]);

  useEffect(() => {
    setLocalTranscriptFileName(transcriptFileName);
  }, [transcriptFileName]);

  const handleAudioChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
        const proceed = confirmIfLargeAudio(file);
        if (!proceed) return;

        // Clear handle for old audio if exists
        if (audioRefKey) {
          clearAudioHandleForAudioRef(audioRefKey)
            .then(() => setAudioHandle(null))
            .catch((err) => {
              console.error("Failed to clear saved audio handle:", err);
            });
        }

        onAudioUpload(file);
      }
    },
    [onAudioUpload, audioRefKey],
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
      const proceed = confirmIfLargeAudio(file);
      if (!proceed) return;

      // Call onAudioUpload FIRST to trigger session creation/change
      onAudioUpload(file);

      // Save the handle using the audio reference key
      // Multiple sessions with the same audio file will share this handle
      const audioRef = buildFileReference(file);
      const audioRefKey = buildAudioRefKey(audioRef);
      await saveAudioHandleForAudioRef(audioRefKey, handle);
      setAudioHandle(handle);
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return;
      console.error("Failed to pick audio file:", err);
    }
  }, [onAudioUpload]);

  const handleRestoreAudio = useCallback(async () => {
    if (!audioHandle || !audioRefKey) return;
    const granted = await requestAudioHandlePermission(audioHandle);
    if (!granted) return;
    try {
      const file = await audioHandle.getFile();
      const proceed = confirmIfLargeAudio(file);
      if (!proceed) {
        // User declined loading the previously saved large file — clear it
        // so the UI no longer offers reopening the same problematic file.
        clearAudioHandleForAudioRef(audioRefKey)
          .then(() => setAudioHandle(null))
          .catch((err) => console.error("Failed to clear saved audio handle:", err));
        return;
      }
      onAudioUpload(file);
    } catch (err) {
      console.error("Failed to restore audio file:", err);
    }
  }, [audioHandle, onAudioUpload, audioRefKey]);

  // confirmIfLargeAudio moved to module scope above to avoid recreating the function on each render

  const handleTranscriptChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = (event) => {
          try {
            const data = JSON.parse(event.target?.result as string);
            onTranscriptUpload(data, buildFileReference(file));
            setLocalTranscriptFileName(file.name);
          } catch (err) {
            console.error("Failed to parse transcript JSON:", err);
          }
        };
        reader.readAsText(file);
      }
    },
    [onTranscriptUpload],
  );

  const transcriptLabel =
    localTranscriptFileName || (transcriptLoaded ? "Transcript Loaded" : "Load Transcript");
  const transcriptDisplay = revisionName ? `${transcriptLabel} (${revisionName})` : transcriptLabel;

  const content = (
    <TooltipProvider delayDuration={200}>
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

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant={audioFileName ? "secondary" : "default"}
              onClick={handleAudioPick}
              data-testid="button-upload-audio"
            >
              <FileAudio className="h-4 w-4 mr-2" />
              {audioFileName || "Load Audio"}
            </Button>
          </TooltipTrigger>
          <TooltipContent>Load audio file</TooltipContent>
        </Tooltip>

        {!audioFileName && audioHandle && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="outline"
                onClick={handleRestoreAudio}
                data-testid="button-restore-audio"
              >
                <RotateCcw className="h-4 w-4 mr-2" />
                Reopen Audio
              </Button>
            </TooltipTrigger>
            <TooltipContent>Reopen last audio file</TooltipContent>
          </Tooltip>
        )}

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant={transcriptLoaded ? "secondary" : "outline"}
              onClick={() => transcriptInputRef.current?.click()}
              data-testid="button-upload-transcript"
            >
              <FileText className="h-4 w-4 mr-2" />
              {transcriptDisplay}
            </Button>
          </TooltipTrigger>
          <TooltipContent>Load transcript JSON</TooltipContent>
        </Tooltip>

        {variant === "card" && !audioFileName && !transcriptLoaded && (
          <span className="text-sm text-muted-foreground">
            <Upload className="h-4 w-4 inline mr-1" />
            Drop files or click to upload
          </span>
        )}
      </div>
    </TooltipProvider>
  );

  if (variant === "inline") {
    return <div className="flex items-center">{content}</div>;
  }

  return <Card className="p-4">{content}</Card>;
}
