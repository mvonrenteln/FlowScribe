import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useToast } from "@/hooks/use-toast";
import {
  buildAudioRefKey,
  clearAudioHandleForAudioRef,
  loadAudioHandleForAudioRef,
  queryAudioHandlePermission,
} from "@/lib/audioHandleStorage";
import confirmIfLargeAudio from "@/lib/confirmLargeFile";
import { buildFileReference, type FileReference } from "@/lib/fileReference";
import { createLogger } from "@/lib/logging";
import type { Segment, TranscriptStore } from "@/lib/store/types";
import { parseTranscriptData } from "@/lib/transcriptParsing";

const logger = createLogger({ feature: "TranscriptInitialization", namespace: "UI" });

interface UseTranscriptInitializationParams {
  audioFile: File | null;
  audioUrl: string | null;
  audioRef: FileReference | null;
  duration: number;
  setAudioFile: TranscriptStore["setAudioFile"];
  setAudioUrl: TranscriptStore["setAudioUrl"];
  setAudioReference: TranscriptStore["setAudioReference"];
  loadTranscript: (params: {
    segments: Segment[];
    isWhisperXFormat: boolean;
    reference: FileReference | null;
  }) => void;
}

export const useTranscriptInitialization = ({
  audioFile,
  audioUrl,
  audioRef,
  duration,
  setAudioFile,
  setAudioUrl,
  setAudioReference,
  loadTranscript,
}: UseTranscriptInitializationParams) => {
  const { t } = useTranslation();
  const { toast } = useToast();
  // Compute audio reference key for handle storage
  const audioRefKey = audioRef ? buildAudioRefKey(audioRef) : null;
  const [isWaveReady, setIsWaveReady] = useState(!audioUrl);
  const restoreAttemptedRef = useRef(false);

  const handleAudioUpload = useCallback(
    (file: File) => {
      setAudioFile(file);
      const url = URL.createObjectURL(file);
      setAudioUrl(url);
      setAudioReference(buildFileReference(file));
    },
    [setAudioFile, setAudioReference, setAudioUrl],
  );

  const handleTranscriptUpload = useCallback(
    (data: unknown, reference?: FileReference | null) => {
      const parsed = parseTranscriptData(data);
      if (!parsed) {
        logger.error("Unknown transcript format. Expected Whisper or WhisperX format.");
        toast({
          title: t("import.transcriptFormatError"),
          description: t("import.transcriptFormatErrorDescription"),
          variant: "destructive",
        });
        return;
      }

      // Check transcript duration against audio duration
      if (parsed.segments.length > 0 && duration > 0) {
        const transcriptDuration = Math.max(...parsed.segments.map((s) => s.end));
        const TOLERANCE = 10; // 10 seconds tolerance

        if (transcriptDuration < duration - TOLERANCE) {
          toast({
            title: t("import.transcriptDurationWarning"),
            description: t("import.transcriptTooShort", {
              transcriptDuration: transcriptDuration.toFixed(1),
              audioDuration: duration.toFixed(1),
            }),
          });
        } else if (transcriptDuration > duration + TOLERANCE) {
          toast({
            title: t("import.transcriptDurationWarning"),
            description: t("import.transcriptTooLong", {
              transcriptDuration: transcriptDuration.toFixed(1),
              audioDuration: duration.toFixed(1),
            }),
          });
        }
      }

      loadTranscript({
        segments: parsed.segments,
        isWhisperXFormat: parsed.isWhisperXFormat,
        reference: reference ?? null,
      });
    },
    [loadTranscript, t, toast, duration],
  );

  useEffect(() => {
    if (restoreAttemptedRef.current || audioFile || !audioRefKey) return;
    restoreAttemptedRef.current = true;
    let isMounted = true;

    loadAudioHandleForAudioRef(audioRefKey)
      .then(async (handle) => {
        if (!handle || !isMounted) return;
        const granted = await queryAudioHandlePermission(handle);
        if (!granted || !isMounted) return;
        const file = await handle.getFile();
        if (!isMounted) return;
        const proceed = confirmIfLargeAudio(file);
        if (!proceed) {
          // User declined loading the previously saved large file after reload.
          // Clear the stored handle for this audio to avoid repeatedly prompting.
          clearAudioHandleForAudioRef(audioRefKey).catch((err) =>
            logger.error("Failed to clear saved audio handle.", { error: err }),
          );
          return;
        }
        handleAudioUpload(file);
      })
      .catch((err) => {
        logger.error("Failed to restore audio handle.", { error: err });
      });

    return () => {
      isMounted = false;
    };
  }, [audioFile, handleAudioUpload, audioRefKey]);

  useEffect(() => {
    setIsWaveReady(!audioUrl);
  }, [audioUrl]);

  const handleWaveReady = useCallback(() => {
    setIsWaveReady(true);
  }, []);

  return {
    handleAudioUpload,
    handleTranscriptUpload,
    handleWaveReady,
    isWaveReady,
  };
};

export type TranscriptInitializationState = ReturnType<typeof useTranscriptInitialization>;
