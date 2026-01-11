import { useState } from "react";
import type { Segment, Speaker } from "@/lib/store";
import { SpeakerSidebar } from "../SpeakerSidebar";

// todo: remove mock functionality
const initialSpeakers: Speaker[] = [
  { id: "1", name: "SPEAKER_00", color: "hsl(217, 91%, 48%)" },
  { id: "2", name: "SPEAKER_01", color: "hsl(142, 76%, 36%)" },
  { id: "3", name: "SPEAKER_02", color: "hsl(271, 81%, 48%)" },
];

const mockSegments: Segment[] = [
  { id: "1", speaker: "SPEAKER_00", tags: [], start: 0, end: 5, text: "Hello", words: [] },
  { id: "2", speaker: "SPEAKER_01", tags: [], start: 5, end: 12, text: "Hi", words: [] },
  { id: "3", speaker: "SPEAKER_00", tags: [], start: 12, end: 20, text: "How are you?", words: [] },
  { id: "4", speaker: "SPEAKER_02", tags: [], start: 20, end: 35, text: "Good thanks", words: [] },
  { id: "5", speaker: "SPEAKER_00", tags: [], start: 35, end: 45, text: "Great", words: [] },
];

export default function SpeakerSidebarExample() {
  const [speakers, setSpeakers] = useState(initialSpeakers);
  const [selectedSpeakerId, setSelectedSpeakerId] = useState<string | undefined>();

  const handleRename = (oldName: string, newName: string) => {
    setSpeakers(speakers.map((s) => (s.name === oldName ? { ...s, name: newName } : s)));
    console.log(`Renamed ${oldName} to ${newName}`);
  };

  const handleAdd = (name: string) => {
    const colors = ["hsl(43, 96%, 42%)", "hsl(340, 82%, 52%)"];
    setSpeakers([
      ...speakers,
      {
        id: String(speakers.length + 1),
        name,
        color: colors[speakers.length % colors.length],
      },
    ]);
    console.log("Added speaker:", name);
  };

  return (
    <div className="h-[400px] w-64 border rounded-lg bg-sidebar">
      <SpeakerSidebar
        speakers={speakers}
        segments={mockSegments}
        onRenameSpeaker={handleRename}
        onAddSpeaker={handleAdd}
        onSpeakerSelect={setSelectedSpeakerId}
        selectedSpeakerId={selectedSpeakerId}
      />
    </div>
  );
}
