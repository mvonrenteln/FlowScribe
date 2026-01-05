import { useCallback, useEffect, useRef, useState } from "react";
import { loadAudioHandle, queryAudioHandlePermission } from "@/lib/audioHandleStorage";
import { buildFileReference, type FileReference } from "@/lib/fileReference";
import type { Segment, TranscriptStore } from "@/lib/store/types";
import { parseTranscriptData } from "@/lib/transcriptParsing";

interface UseTranscriptInitializationParams {
  audioFile: File | null;
  audioUrl: string | null;
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
  setAudioFile,
  setAudioUrl,
  setAudioReference,
  loadTranscript,
}: UseTranscriptInitializationParams) => {
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
    if (restoreAttemptedRef.current || audioFile) return;
    restoreAttemptedRef.current = true;
    let isMounted = true;

    loadAudioHandle()
      .then(async (handle) => {
        if (!handle || !isMounted) return;
        const granted = await queryAudioHandlePermission(handle);
        if (!granted || !isMounted) return;
        const file = await handle.getFile();
        if (isMounted) {
          handleAudioUpload(file);
        }
      })
      .catch((err) => {
        console.error("Failed to restore audio handle:", err);
      });

    return () => {
      isMounted = false;
    };
  }, [audioFile, handleAudioUpload]);

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
