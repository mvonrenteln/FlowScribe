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
  onCreateRevision: (name: string, overwrite?: boolean) => string | null;
  canCreateRevision: boolean;
  activeSessionName: string;
  activeSessionKind: SessionKind;
  existingRevisionNames: string[];
  defaultRevisionName?: string;
}

export function RevisionDialog({
  open,
  onOpenChange,
  onCreateRevision,
  canCreateRevision,
  activeSessionName,
  activeSessionKind,
  existingRevisionNames,
  defaultRevisionName,
}: RevisionDialogProps) {
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [confirmOverwrite, setConfirmOverwrite] = useState(false);

  useEffect(() => {
    if (open) {
      setName(defaultRevisionName ?? "");
      setError(null);
      setConfirmOverwrite(false);
    }
  }, [open, defaultRevisionName]);

  const handleSubmit = () => {
    const trimmed = name.trim();
    if (!trimmed) {
      setError("Please provide a revision name.");
      return;
    }

    if (!confirmOverwrite && existingRevisionNames.includes(trimmed)) {
      setConfirmOverwrite(true);
      return;
    }

    const created = onCreateRevision(trimmed, confirmOverwrite);
    if (created) {
      setName("");
      setError(null);
      setConfirmOverwrite(false);
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
          <DialogTitle>Save Revision</DialogTitle>
          <DialogDescription>
            Create a named Revision of the current session. New edits continue on the active
            version; the saved Revision will stay unchanged until you open and edit it explicitly.
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

          {confirmOverwrite ? (
            <div className="p-4 border border-yellow-200 bg-yellow-50 rounded-md text-sm text-yellow-800 dark:bg-yellow-900/20 dark:border-yellow-900/50 dark:text-yellow-200">
              <p className="font-medium mb-1">Overwrite existing revision?</p>
              <p>
                A revision named "{name}" already exists. Saving will overwrite it with the current
                state.
              </p>
            </div>
          ) : (
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
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          {confirmOverwrite ? (
            <>
              <Button
                variant="ghost"
                onClick={() => {
                  setConfirmOverwrite(false);
                  // Focus back on input?
                }}
              >
                Back
              </Button>
              <Button onClick={handleSubmit}>Overwrite</Button>
            </>
          ) : (
            <Button onClick={handleSubmit} disabled={!canCreateRevision}>
              Save Revision
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
