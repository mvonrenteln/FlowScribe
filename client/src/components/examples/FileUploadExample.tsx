import { useState } from "react";
import { createLogger } from "@/lib/logging";
import { FileUpload } from "../FileUpload";

const logger = createLogger({ feature: "FileUploadExample", namespace: "Examples" });

export default function FileUploadExample() {
  const [audioFileName, setAudioFileName] = useState<string | undefined>();
  const [transcriptFileName, setTranscriptFileName] = useState<string | undefined>();
  const [transcriptLoaded, setTranscriptLoaded] = useState(false);

  return (
    <FileUpload
      onAudioUpload={(file) => {
        logger.info("Audio uploaded.", { fileName: file.name });
        setAudioFileName(file.name);
      }}
      onTranscriptUpload={(data, reference) => {
        logger.info("Transcript loaded.", { data });
        setTranscriptFileName(reference?.name);
        setTranscriptLoaded(true);
      }}
      audioFileName={audioFileName}
      transcriptFileName={transcriptFileName}
      transcriptLoaded={transcriptLoaded}
    />
  );
}
