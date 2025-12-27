export const formatTranscriptName = (name?: string) => {
  return name?.replace(".json", "") || "Untitled transcript";
};
