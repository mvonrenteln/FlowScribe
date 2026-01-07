import { GitMerge } from "lucide-react";
import { Button } from "@/components/ui/button";

interface MergePanelProps {
  onOpenMergeDialog: () => void;
}

export function MergePanel({ onOpenMergeDialog }: MergePanelProps) {
  return (
    <div className="space-y-4">
      <div className="rounded-lg border bg-muted/20 p-4 text-sm text-muted-foreground">
        <div className="flex items-center gap-2 text-foreground font-medium">
          <GitMerge className="h-4 w-4" />
          AI Merge
        </div>
        <p className="mt-2">
          The merge workflow still uses the existing dialog. Open it from here while the command
          panel infrastructure is being migrated.
        </p>
      </div>
      <Button onClick={onOpenMergeDialog} variant="outline" className="w-full">
        Open AI Merge Dialog
      </Button>
    </div>
  );
}
