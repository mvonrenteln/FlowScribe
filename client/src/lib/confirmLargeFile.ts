import { createLogger } from "@/lib/logging";

const MB = 1024 * 1024;
const GB = 1024 * 1024 * 1024;

const logger = createLogger({ feature: "ConfirmLargeFile", namespace: "App" });

export function formatFileSize(size: number) {
  if (size >= GB) return `${(size / GB).toFixed(2)} GB`;
  return `${(size / MB).toFixed(1)} MB`;
}

/**
 * Confirm loading of large audio files.
 * Returns true if loading may proceed (either below limits or user confirmed).
 */
export function confirmIfLargeAudio(file: File) {
  const name = file.name || "unknown";
  const lower = name.toLowerCase();
  const size = file.size || 0;

  const AUDIO_LIMITS = {
    FLAC: 300 * MB,
    WAV: 1 * GB,
  } as const;

  let limit: number | null = null;
  if (lower.endsWith(".flac") || file.type === "audio/flac") {
    limit = AUDIO_LIMITS.FLAC;
  } else if (lower.endsWith(".wav") || file.type === "audio/wav") {
    limit = AUDIO_LIMITS.WAV;
  }

  if (limit && size > limit) {
    const humanReadableFileSize = formatFileSize(size);
    const msg =
      `The file "${name}" is ${humanReadableFileSize}.\n` +
      `Large files can cause instability or crash the browser tab. If the file is stereo, consider converting it to mono. Or split the file if you experience instability. This is not a bug in FlowScribe but a browser and RAM limitation.\n\nDo you want to continue loading this file?`;
    try {
      return globalThis.confirm(msg);
    } catch (err) {
      // If confirmation cannot be shown, allow proceeding to avoid blocking the flow
      logger.error("Failed to show confirmation dialog.", { error: err });
      return true;
    }
  }
  return true;
}

export default confirmIfLargeAudio;
