export type FileReference = {
  name: string;
  size: number;
  lastModified: number;
};

export const buildFileReference = (file: File): FileReference => ({
  name: file.name,
  size: file.size,
  lastModified: file.lastModified,
});

const encodeName = (name: string) => encodeURIComponent(name);

export const serializeFileReference = (ref: FileReference): string =>
  `${encodeName(ref.name)}:${ref.size}:${ref.lastModified}`;

export const isSameFileReference = (
  a: FileReference | null,
  b: FileReference | null,
): boolean => {
  if (a === b) return true;
  if (!a || !b) return false;
  return a.name === b.name && a.size === b.size && a.lastModified === b.lastModified;
};

export const buildSessionKey = (
  audioRef: FileReference | null,
  transcriptRef: FileReference | null,
): string => {
  const audioKey = audioRef ? serializeFileReference(audioRef) : "none";
  const transcriptKey = transcriptRef ? serializeFileReference(transcriptRef) : "none";
  return `audio:${audioKey}|transcript:${transcriptKey}`;
};
