import { useState } from 'react';
import { FileUpload } from '../FileUpload';

export default function FileUploadExample() {
  const [audioFileName, setAudioFileName] = useState<string | undefined>();
  const [transcriptLoaded, setTranscriptLoaded] = useState(false);

  return (
    <FileUpload
      onAudioUpload={(file) => {
        console.log('Audio uploaded:', file.name);
        setAudioFileName(file.name);
      }}
      onTranscriptUpload={(data) => {
        console.log('Transcript loaded:', data);
        setTranscriptLoaded(true);
      }}
      audioFileName={audioFileName}
      transcriptLoaded={transcriptLoaded}
    />
  );
}
