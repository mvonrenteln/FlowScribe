import { useState } from 'react';
import { KeyboardShortcuts } from '../KeyboardShortcuts';
import { Button } from '@/components/ui/button';
import { Keyboard } from 'lucide-react';

export default function KeyboardShortcutsExample() {
  const [open, setOpen] = useState(false);

  return (
    <div className="p-4">
      <Button variant="outline" onClick={() => setOpen(true)}>
        <Keyboard className="h-4 w-4 mr-2" />
        View Shortcuts
      </Button>
      <KeyboardShortcuts open={open} onOpenChange={setOpen} />
    </div>
  );
}
