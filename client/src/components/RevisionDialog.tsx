import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { SessionKind } from "@/lib/store";

interface RevisionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreateRevision: (name: string) => string | null;
  canCreateRevision: boolean;
  activeSessionName: string;
  activeSessionKind: SessionKind;
}

export function RevisionDialog({
  open,
  onOpenChange,
  onCreateRevision,
  canCreateRevision,
  activeSessionName,
  activeSessionKind,
}: RevisionDialogProps) {
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      setName("");
      setError(null);
    }
  }, [open]);

  const handleSubmit = () => {
    const trimmed = name.trim();
    if (!trimmed) {
      setError("Please provide a revision name.");
      return;
    }
    const created = onCreateRevision(trimmed);
    if (created) {
      setName("");
      setError(null);
    }
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") {
      event.preventDefault();
      handleSubmit();
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Save revision</DialogTitle>
          <DialogDescription>
            Create a named snapshot of the current session. New edits continue on the active
            version; the saved revision will stay unchanged until you open and edit it explicitly.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Badge variant="secondary">
              {activeSessionKind === "revision" ? "Revision" : "Current"}
            </Badge>
            <span className="truncate" title={activeSessionName}>
              {activeSessionName}
            </span>
          </div>

          <div className="space-y-2">
            <Label htmlFor="revision-name">Revision name</Label>
            <Input
              id="revision-name"
              value={name}
              autoFocus
              onChange={(event) => {
                setName(event.target.value);
                if (event.target.value.trim()) {
                  setError(null);
                }
              }}
              onKeyDown={handleKeyDown}
              placeholder="e.g. First pass, Timing review, Client feedback"
            />
            {error && <p className="text-sm text-destructive">{error}</p>}
            <p className="text-xs text-muted-foreground">
              Names are free-form. Duplicate names are allowed and tied to the current file.
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={!canCreateRevision}>
            Save revision
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
