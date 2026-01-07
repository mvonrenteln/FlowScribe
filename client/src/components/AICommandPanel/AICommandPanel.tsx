import { Bot, X } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { MergePanel } from "./MergePanel";
import { RevisionPanel } from "./RevisionPanel";
import { SpeakerPanel } from "./SpeakerPanel";

export type AICommandPanelTab = "revision" | "speaker" | "merge";

interface AICommandPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  filteredSegmentIds: string[];
  onOpenSettings: () => void;
  onOpenMergeDialog: () => void;
}

export function AICommandPanel({
  open,
  onOpenChange,
  filteredSegmentIds,
  onOpenSettings,
  onOpenMergeDialog,
}: AICommandPanelProps) {
  const [activeTab, setActiveTab] = useState<AICommandPanelTab>("revision");

  if (!open) return null;

  return (
    <aside className="w-96 border-l bg-card flex-shrink-0 flex flex-col">
      <div className="flex items-center justify-between px-4 py-3 border-b">
        <div className="flex items-center gap-2">
          <Bot className="h-4 w-4 text-muted-foreground" />
          <h2 className="text-sm font-semibold">AI Command Panel</h2>
        </div>
        <Button
          size="icon"
          variant="ghost"
          onClick={() => onOpenChange(false)}
          aria-label="Close AI command panel"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      <div className="px-4 py-3 border-b">
        <div className="flex gap-1 rounded-lg bg-muted/60 p-1">
          {(
            [
              { id: "revision", label: "Revision" },
              { id: "speaker", label: "Speaker" },
              { id: "merge", label: "Merge" },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              type="button"
              className={cn(
                "flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                activeTab === tab.id
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
              onClick={() => setActiveTab(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-auto p-4">
        {activeTab === "revision" && <RevisionPanel filteredSegmentIds={filteredSegmentIds} />}
        {activeTab === "speaker" && <SpeakerPanel onOpenSettings={onOpenSettings} />}
        {activeTab === "merge" && <MergePanel onOpenMergeDialog={onOpenMergeDialog} />}
      </div>
    </aside>
  );
}
