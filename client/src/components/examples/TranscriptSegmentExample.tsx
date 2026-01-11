import { useState } from "react";
import type { Segment, Speaker } from "@/lib/store";
import { TranscriptSegment } from "../TranscriptSegment";

// todo: remove mock functionality
const mockSpeakers: Speaker[] = [
  { id: "1", name: "SPEAKER_00", color: "hsl(217, 91%, 48%)" },
  { id: "2", name: "SPEAKER_01", color: "hsl(142, 76%, 36%)" },
];

const mockSegment: Segment = {
  id: "seg1",
  speaker: "SPEAKER_00",
  tags: [],
  start: 0.5,
  end: 4.2,
  text: "Hello, welcome to the podcast. Today we are going to discuss something interesting.",
  words: [
    { word: "Hello,", start: 0.5, end: 0.8 },
    { word: "welcome", start: 0.9, end: 1.2 },
    { word: "to", start: 1.25, end: 1.35 },
    { word: "the", start: 1.4, end: 1.5 },
    { word: "podcast.", start: 1.55, end: 1.9 },
    { word: "Today", start: 2.0, end: 2.3 },
    { word: "we", start: 2.35, end: 2.45 },
    { word: "are", start: 2.5, end: 2.6 },
    { word: "going", start: 2.65, end: 2.85 },
    { word: "to", start: 2.9, end: 3.0 },
    { word: "discuss", start: 3.05, end: 3.4 },
    { word: "something", start: 3.45, end: 3.8 },
    { word: "interesting.", start: 3.85, end: 4.2 },
  ],
};

export default function TranscriptSegmentExample() {
  const [segment, setSegment] = useState(mockSegment);
  const [isSelected, setIsSelected] = useState(false);

  return (
    <div className="p-4 space-y-4">
      <TranscriptSegment
        segment={segment}
        speakers={mockSpeakers}
        isSelected={isSelected}
        isActive={true}
        onSelect={() => setIsSelected(!isSelected)}
        onTextChange={(text) => setSegment({ ...segment, text })}
        onSpeakerChange={(speaker) => setSegment({ ...segment, speaker })}
        onSplit={(wordIndex) => console.log("Split at word:", wordIndex)}
        onConfirm={() => setSegment({ ...segment, confirmed: true })}
        onToggleBookmark={() =>
          setSegment((current) => ({ ...current, bookmarked: !current.bookmarked }))
        }
        onMergeWithNext={() => console.log("Merge with next")}
        onDelete={() => console.log("Delete segment")}
        onSeek={(time) => console.log("Seek to:", time)}
      />
    </div>
  );
}
