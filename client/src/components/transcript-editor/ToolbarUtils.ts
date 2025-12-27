export const getFileNameWithoutExtension = (name?: string): string => {
  if (!name) return "";
  const lastDotIndex = name.lastIndexOf(".");
  if (lastDotIndex === -1) return name;
  return name.substring(0, lastDotIndex);
};

export const getFileExtension = (name?: string): string => {
  if (!name) return "";
  const lastDotIndex = name.lastIndexOf(".");
  if (lastDotIndex === -1 || lastDotIndex === name.length - 1) return "";
  return name.substring(lastDotIndex);
};

export const formatAudioName = (name?: string) => {
  return getFileNameWithoutExtension(name) || "Unknown Audio";
};

export const formatTranscriptName = (name?: string) => {
  return getFileNameWithoutExtension(name) || "Untitled transcript";
};
