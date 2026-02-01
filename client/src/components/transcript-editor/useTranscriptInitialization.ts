import { useCallback, useEffect, useRef, useState } from "react";
import {
  buildAudioRefKey,
  clearAudioHandleForAudioRef,
  loadAudioHandleForAudioRef,
  queryAudioHandlePermission,
} from "@/lib/audioHandleStorage";
import confirmIfLargeAudio from "@/lib/confirmLargeFile";
import { buildFileReference, type FileReference } from "@/lib/fileReference";
import type { Segment, TranscriptStore } from "@/lib/store/types";
import { parseTranscriptData } from "@/lib/transcriptParsing";

interface UseTranscriptInitializationParams {
  audioFile: File | null;
  audioUrl: string | null;
  audioRef: FileReference | null;
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
  setAudioFile,
  setAudioUrl,
  setAudioReference,
  loadTranscript,
}: UseTranscriptInitializationParams) => {
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
        console.error("Unknown transcript format. Expected Whisper or WhisperX format.");
        return;
      }

      loadTranscript({
        segments: parsed.segments,
        isWhisperXFormat: parsed.isWhisperXFormat,
        reference: reference ?? null,
      });
    },
    [loadTranscript],
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
            console.error("Failed to clear saved audio handle:", err),
          );
          return;
        }
        handleAudioUpload(file);
      })
      .catch((err) => {
        console.error("Failed to restore audio handle:", err);
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
