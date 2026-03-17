import { useCallback, useEffect, useRef, useState } from "react";

type AudioRestoreState = "pending" | "in-progress" | "done" | "failed";

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
import type { Segment, TranscriptImportTag, TranscriptStore } from "@/lib/store/types";
import { parseTranscriptData } from "@/lib/transcriptParsing";
import type { Chapter } from "@/types/chapter";

const logger = createLogger({ feature: "TranscriptInitialization", namespace: "UI" });

interface UseTranscriptInitializationParams {
  audioFile: File | null;
  audioUrl: string | null;
  audioRef: FileReference | null;
  duration: number;
  setAudioFile: TranscriptStore["setAudioFile"];
  setAudioUrl: TranscriptStore["setAudioUrl"];
  setAudioReference: TranscriptStore["setAudioReference"];
  reconnectAudio: TranscriptStore["reconnectAudio"];
  loadTranscript: (params: {
    segments: Segment[];
    isWhisperXFormat: boolean;
    tags?: TranscriptImportTag[] | undefined;
    chapters?: Chapter[] | undefined;
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
  reconnectAudio,
  loadTranscript,
}: UseTranscriptInitializationParams) => {
  const { t } = useTranslation();
  const { toast } = useToast();
  // Compute audio reference key for handle storage
  const audioRefKey = audioRef ? buildAudioRefKey(audioRef) : null;
  const [isWaveReady, setIsWaveReady] = useState(!audioUrl);
  const restoreAttemptedRef = useRef(false);
  // "pending"     — we haven't tried yet (audioRefKey not yet known, or effect not run)
  // "in-progress" — async restore is running
  // "done"        — restore succeeded (or no handle was needed)
  // "failed"      — handle missing / permission denied → show Reopen button
  const [audioRestoreState, setAudioRestoreState] = useState<AudioRestoreState>(
    audioRefKey ? "pending" : "done",
  );

  const handleAudioUpload = useCallback(
    (file: File, options?: { mode?: "replace" | "reconnect" }) => {
      // If a session with transcript data already exists but no audio is loaded
      // (e.g. after a backup restore + page reload), reconnect without resetting
      // transcript state. In all other cases use the normal path which resets the
      // transcript when a new audio file is introduced.
      const isReconnect =
        (options?.mode === "reconnect" && audioRef !== null) ||
        (options?.mode !== "replace" && audioUrl === null && audioRef !== null);
      if (isReconnect) {
        reconnectAudio(file);
      } else {
        setAudioFile(file);
        const url = URL.createObjectURL(file);
        setAudioUrl(url);
        setAudioReference(buildFileReference(file));
      }
    },
    [audioRef, audioUrl, reconnectAudio, setAudioFile, setAudioReference, setAudioUrl],
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
        tags: parsed.tags,
        chapters: parsed.chapters,
        reference: reference ?? null,
      });
    },
    [loadTranscript, t, toast, duration],
  );

  useEffect(() => {
    if (restoreAttemptedRef.current || audioFile || !audioRefKey) return;
    restoreAttemptedRef.current = true;
    let isMounted = true;

    setAudioRestoreState("in-progress");

    loadAudioHandleForAudioRef(audioRefKey)
      .then(async (handle) => {
        if (!handle || !isMounted) {
          if (isMounted) setAudioRestoreState("failed");
          return;
        }
        const granted = await queryAudioHandlePermission(handle);
        if (!granted || !isMounted) {
          if (isMounted) setAudioRestoreState("failed");
          return;
        }
        const file = await handle.getFile();
        if (!isMounted) return;
        const proceed = confirmIfLargeAudio(file);
        if (!proceed) {
          clearAudioHandleForAudioRef(audioRefKey).catch((err) =>
            logger.error("Failed to clear saved audio handle.", { error: err }),
          );
          if (isMounted) setAudioRestoreState("failed");
          return;
        }
        handleAudioUpload(file);
        if (isMounted) setAudioRestoreState("done");
      })
      .catch((err) => {
        logger.error("Failed to restore audio handle.", { error: err });
        if (isMounted) setAudioRestoreState("failed");
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
    audioRestoreState,
  };
};

export type TranscriptInitializationState = ReturnType<typeof useTranscriptInitialization>;
