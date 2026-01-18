import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

interface KeyboardShortcutsProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const shortcuts = {
  Playback: [
    { keys: ["Space"], description: "Play / Pause" },
    { keys: ["J"], description: "Skip back 5 seconds" },
    { keys: ["L"], description: "Skip forward 5 seconds" },
    { keys: ["←"], description: "Seek back 1 second" },
    { keys: ["→"], description: "Seek forward 1 second" },
    { keys: ["Home"], description: "Go to start" },
    { keys: ["End"], description: "Go to end" },
  ],
  Navigation: [
    { keys: ["↑"], description: "Previous segment" },
    { keys: ["↓"], description: "Next segment" },
    { keys: ["Escape"], description: "Deselect segment / Cancel edit" },
  ],
  Editing: [
    { keys: ["Ctrl", "Z"], description: "Undo" },
    { keys: ["Ctrl", "Shift", "Z"], description: "Redo" },
    { keys: ["E"], description: "Edit selected segment" },
    { keys: ["S"], description: "Split at current word" },
    { keys: ["P"], description: "Merge with previous segment" },
    { keys: ["M"], description: "Merge with next segment" },
    { keys: ["B"], description: "Toggle bookmark" },
    { keys: ["C"], description: "Confirm segment" },
    { keys: ["Delete"], description: "Delete selected segment" },
    { keys: ["1-9"], description: "Assign speaker by number" },
    { keys: ["T", "1-9"], description: "Toggle tag assignment (T+1 to T+9)" },
    { keys: ["T", "0"], description: "Toggle tag #10" },
  ],
  "AI Revision": [
    { keys: ["Alt", "R"], description: "Run default AI revision prompt" },
    { keys: ["Alt", "Shift", "R"], description: "Open AI revision menu" },
  ],
  "AI Merge": [{ keys: ["Alt", "Shift", "M"], description: "Open AI merge analysis" }],
  Export: [
    { keys: ["Ctrl", "E"], description: "Export transcript" },
    { keys: ["Ctrl", ","], description: "Open settings" },
    { keys: ["?"], description: "Show keyboard shortcuts" },
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
                {items.map((shortcut) => (
                  <div
                    key={`${category}-${shortcut.description}`}
                    className="flex items-center justify-between gap-4"
                  >
                    <div className="flex items-center gap-1">
                      {shortcut.keys.map((key) => (
                        <span key={`${shortcut.description}-${key}`} className="contents">
                          <Badge variant="secondary" className="font-mono text-xs px-2">
                            {key}
                          </Badge>
                          {key !== shortcut.keys[shortcut.keys.length - 1] && (
                            <span className="text-muted-foreground text-xs">+</span>
                          )}
                        </span>
                      ))}
                    </div>
                    <span className="text-sm text-muted-foreground">{shortcut.description}</span>
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
