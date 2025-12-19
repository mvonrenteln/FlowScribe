import { useState } from 'react';
import { ExportDialog } from '../ExportDialog';
import { Button } from '@/components/ui/button';
import { Download } from 'lucide-react';
import type { Segment } from '@/lib/store';

// todo: remove mock functionality
const mockSegments: Segment[] = [
  {
    id: '1',
    speaker: 'SPEAKER_00',
    start: 0.5,
    end: 4.2,
    text: 'Hello, welcome to the podcast.',
    words: [
      { word: 'Hello,', start: 0.5, end: 0.8 },
      { word: 'welcome', start: 0.9, end: 1.2 },
      { word: 'to', start: 1.25, end: 1.35 },
      { word: 'the', start: 1.4, end: 1.5 },
      { word: 'podcast.', start: 1.55, end: 4.2 },
    ],
  },
  {
    id: '2',
    speaker: 'SPEAKER_01',
    start: 4.5,
    end: 8.0,
    text: 'Thank you for having me here today.',
    words: [
      { word: 'Thank', start: 4.5, end: 4.8 },
      { word: 'you', start: 4.85, end: 5.0 },
      { word: 'for', start: 5.05, end: 5.2 },
      { word: 'having', start: 5.25, end: 5.6 },
      { word: 'me', start: 5.65, end: 5.8 },
      { word: 'here', start: 5.85, end: 6.1 },
      { word: 'today.', start: 6.15, end: 8.0 },
    ],
  },
];

export default function ExportDialogExample() {
  const [open, setOpen] = useState(false);

  return (
    <div className="p-4">
      <Button onClick={() => setOpen(true)}>
        <Download className="h-4 w-4 mr-2" />
        Export Transcript
      </Button>
      <ExportDialog 
        open={open} 
        onOpenChange={setOpen} 
        segments={mockSegments}
        fileName="my-transcript"
      />
    </div>
  );
}
