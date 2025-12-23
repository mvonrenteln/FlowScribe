import { useState } from "react";
import { FileUpload } from "../FileUpload";

export default function FileUploadExample() {
  const [audioFileName, setAudioFileName] = useState<string | undefined>();
  const [transcriptFileName, setTranscriptFileName] = useState<string | undefined>();
  const [transcriptLoaded, setTranscriptLoaded] = useState(false);

  return (
    <FileUpload
      onAudioUpload={(file) => {
        console.log("Audio uploaded:", file.name);
        setAudioFileName(file.name);
      }}
      onTranscriptUpload={(data, reference) => {
        console.log("Transcript loaded:", data);
        setTranscriptFileName(reference?.name);
        setTranscriptLoaded(true);
      }}
      audioFileName={audioFileName}
      transcriptFileName={transcriptFileName}
      transcriptLoaded={transcriptLoaded}
    />
  );
}
