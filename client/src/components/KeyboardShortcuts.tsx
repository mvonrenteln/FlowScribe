import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';

interface KeyboardShortcutsProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const shortcuts = {
  Playback: [
    { keys: ['Space'], description: 'Play / Pause' },
    { keys: ['J'], description: 'Skip back 5 seconds' },
    { keys: ['L'], description: 'Skip forward 5 seconds' },
    { keys: ['←'], description: 'Seek back 1 second' },
    { keys: ['→'], description: 'Seek forward 1 second' },
    { keys: ['Home'], description: 'Go to start' },
    { keys: ['End'], description: 'Go to end' },
  ],
  Navigation: [
    { keys: ['↑'], description: 'Previous segment' },
    { keys: ['↓'], description: 'Next segment' },
    { keys: ['Enter'], description: 'Select segment' },
    { keys: ['Escape'], description: 'Deselect / Cancel edit' },
  ],
  Editing: [
    { keys: ['Ctrl', 'Z'], description: 'Undo' },
    { keys: ['Ctrl', 'Shift', 'Z'], description: 'Redo' },
    { keys: ['S'], description: 'Split at word (with Shift+Click)' },
    { keys: ['M'], description: 'Merge with next segment' },
    { keys: ['Delete'], description: 'Delete selected segment' },
    { keys: ['1-9'], description: 'Assign speaker by number' },
  ],
  Export: [
    { keys: ['Ctrl', 'E'], description: 'Export transcript' },
    { keys: ['?'], description: 'Show keyboard shortcuts' },
  ],
};

export function KeyboardShortcuts({ open, onOpenChange }: KeyboardShortcutsProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Keyboard Shortcuts</DialogTitle>
        </DialogHeader>
        
        <div className="grid grid-cols-2 gap-6 mt-4">
          {Object.entries(shortcuts).map(([category, items]) => (
            <div key={category}>
              <h3 className="text-sm font-semibold mb-3">{category}</h3>
              <div className="space-y-2">
                {items.map((shortcut, index) => (
                  <div 
                    key={index} 
                    className="flex items-center justify-between gap-4"
                  >
                    <div className="flex items-center gap-1">
                      {shortcut.keys.map((key, keyIndex) => (
                        <span key={keyIndex} className="contents">
                          <Badge 
                            variant="secondary" 
                            className="font-mono text-xs px-2"
                          >
                            {key}
                          </Badge>
                          {keyIndex < shortcut.keys.length - 1 && (
                            <span className="text-muted-foreground text-xs">+</span>
                          )}
                        </span>
                      ))}
                    </div>
                    <span className="text-sm text-muted-foreground">
                      {shortcut.description}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
