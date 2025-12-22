import { Check, Edit2, Merge, Plus, X } from "lucide-react";
import { type KeyboardEvent, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Slider } from "@/components/ui/slider";
import type { Segment, Speaker } from "@/lib/store";
import { cn } from "@/lib/utils";

interface SpeakerSidebarProps {
  speakers: Speaker[];
  segments: Segment[];
  onRenameSpeaker: (oldName: string, newName: string) => void;
  onAddSpeaker: (name: string) => void;
  onMergeSpeakers?: (fromName: string, toName: string) => void;
  onSpeakerSelect?: (speakerId: string) => void;
  onClearFilter?: () => void;
  selectedSpeakerId?: string;
  lowConfidenceFilterActive?: boolean;
  onToggleLowConfidenceFilter?: () => void;
  lowConfidenceThreshold?: number | null;
  onLowConfidenceThresholdChange?: (value: number | null) => void;
}

export function SpeakerSidebar({
  speakers,
  segments,
  onRenameSpeaker,
  onAddSpeaker,
  onMergeSpeakers,
  onSpeakerSelect,
  onClearFilter,
  selectedSpeakerId,
  lowConfidenceFilterActive = false,
  onToggleLowConfidenceFilter,
  lowConfidenceThreshold = null,
  onLowConfidenceThresholdChange,
}: Readonly<SpeakerSidebarProps>) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [isAdding, setIsAdding] = useState(false);
  const [newSpeakerName, setNewSpeakerName] = useState("");
  const editInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editingId && editInputRef.current) {
      editInputRef.current.focus();
      editInputRef.current.select();
    }
  }, [editingId]);

  const getSegmentCount = (speakerName: string) => {
    return segments.filter((s) => s.speaker === speakerName).length;
  };

  const getTotalDuration = (speakerName: string) => {
    const speakerSegments = segments.filter((s) => s.speaker === speakerName);
    const total = speakerSegments.reduce((acc, s) => acc + (s.end - s.start), 0);
    const mins = Math.floor(total / 60);
    const secs = Math.floor(total % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const lowConfidenceCount =
    lowConfidenceThreshold === null
      ? 0
      : segments.filter((segment) =>
          segment.words.some(
            (word) => typeof word.score === "number" && word.score <= lowConfidenceThreshold,
          ),
        ).length;

  const handleStartEdit = (speaker: Speaker) => {
    setEditingId(speaker.id);
    setEditValue(speaker.name);
  };

  const handleSaveEdit = (oldName: string) => {
    const trimmedValue = editValue.trim();
    if (trimmedValue && trimmedValue !== oldName) {
      onRenameSpeaker(oldName, trimmedValue);
    }
    setEditingId(null);
    setEditValue("");
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditValue("");
  };

  const handleAddSpeaker = () => {
    if (newSpeakerName.trim()) {
      onAddSpeaker(newSpeakerName.trim());
      setNewSpeakerName("");
      setIsAdding(false);
    }
  };

  const handleSpeakerKeyDown = (event: KeyboardEvent<HTMLDivElement>, speakerId: string) => {
    if (editingId === speakerId) {
      return;
    }
    if (event.key === "Enter") {
      event.preventDefault();
      onSpeakerSelect?.(speakerId);
    }
  };

  return (
    <div className="flex flex-col h-full">
      <div className="p-4 border-b">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-sm font-semibold">Speakers</h2>
          {selectedSpeakerId && (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => onClearFilter?.()}
              data-testid="button-clear-speaker-filter"
            >
              Clear
            </Button>
          )}
        </div>
        <p className="text-xs text-muted-foreground mt-1">
          {speakers.length} speaker{speakers.length !== 1 ? "s" : ""} detected
        </p>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-2 space-y-1">
          {speakers.map((speaker, index) => (
            <div
              key={speaker.id}
              className={cn(
                "group flex items-center gap-2 p-2 rounded-md cursor-pointer hover-elevate",
                selectedSpeakerId === speaker.id && "bg-accent",
              )}
              onClick={() => {
                if (editingId === speaker.id) {
                  return;
                }
                onSpeakerSelect?.(speaker.id);
              }}
              onKeyDown={(event) => handleSpeakerKeyDown(event, speaker.id)}
              data-testid={`speaker-card-${speaker.id}`}
              role="button"
              tabIndex={0}
              aria-pressed={selectedSpeakerId === speaker.id}
            >
              <div
                className="w-1 h-10 rounded-full flex-shrink-0"
                style={{ backgroundColor: speaker.color }}
              />

              <div className="flex-1 min-w-0">
                {editingId === speaker.id ? (
                  <div className="flex items-center gap-1">
                    <Input
                      ref={editInputRef}
                      value={editValue}
                      onChange={(e) => setEditValue(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          e.stopPropagation();
                          handleSaveEdit(speaker.name);
                          return;
                        }
                        if (e.key === "Escape") {
                          e.preventDefault();
                          e.stopPropagation();
                          handleCancelEdit();
                        }
                      }}
                      className="h-7 text-sm"
                      autoFocus
                      data-testid={`input-rename-${speaker.id}`}
                    />
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7"
                      onClick={(event) => {
                        event.stopPropagation();
                        handleSaveEdit(speaker.name);
                      }}
                    >
                      <Check className="h-3 w-3" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7"
                      onClick={(event) => {
                        event.stopPropagation();
                        handleCancelEdit();
                      }}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                ) : (
                  <>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground border rounded px-1.5 py-0.5">
                        {index + 1}
                      </span>
                      <span className="text-sm font-medium truncate">{speaker.name}</span>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-6 w-6 invisible group-hover:visible"
                            onClick={(e) => e.stopPropagation()}
                            data-testid={`button-merge-${speaker.id}`}
                          >
                            <Merge className="h-3 w-3" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          {speakers
                            .filter((s) => s.name !== speaker.name)
                            .map((target) => (
                              <DropdownMenuItem
                                key={target.id}
                                onClick={() => onMergeSpeakers?.(speaker.name, target.name)}
                                data-testid={`menu-merge-${speaker.id}-into-${target.id}`}
                              >
                                Merge into {target.name}
                              </DropdownMenuItem>
                            ))}
                        </DropdownMenuContent>
                      </DropdownMenu>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-6 w-6 invisible group-hover:visible"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleStartEdit(speaker);
                        }}
                        data-testid={`button-edit-${speaker.id}`}
                      >
                        <Edit2 className="h-3 w-3" />
                      </Button>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span>{getSegmentCount(speaker.name)} segments</span>
                      <span className="font-mono">{getTotalDuration(speaker.name)}</span>
                    </div>
                  </>
                )}
              </div>
            </div>
          ))}
          <div className="pt-3 mt-3 border-t">
            <div className="px-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              Quality
            </div>
            <button
              type="button"
              className={cn(
                "mt-2 w-full flex items-center justify-between gap-2 rounded-md px-2 py-1.5 text-sm",
                "hover-elevate",
                lowConfidenceFilterActive && "bg-accent",
                lowConfidenceThreshold === null && "opacity-50 cursor-not-allowed",
              )}
              onClick={() => {
                if (lowConfidenceThreshold === null) return;
                onToggleLowConfidenceFilter?.();
              }}
              data-testid="button-filter-low-confidence"
            >
              <span>Low score</span>
              <span className="text-xs text-muted-foreground">{lowConfidenceCount}</span>
            </button>
            {lowConfidenceFilterActive && (
              <div className="mt-3 space-y-2 px-1">
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>Threshold</span>
                  <span>
                    {lowConfidenceThreshold === null
                      ? "No scores"
                      : lowConfidenceThreshold.toFixed(2)}
                  </span>
                </div>
                <Slider
                  value={[lowConfidenceThreshold ?? 0.4]}
                  min={0}
                  max={1}
                  step={0.05}
                  disabled={lowConfidenceThreshold === null}
                  onValueChange={(value) => {
                    onLowConfidenceThresholdChange?.(value[0] ?? 0.4);
                  }}
                />
                <div className="flex justify-end">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => onLowConfidenceThresholdChange?.(null)}
                    disabled={lowConfidenceThreshold === null}
                  >
                    Auto
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      </ScrollArea>

      <div className="p-2 border-t">
        {isAdding ? (
          <div className="flex items-center gap-1">
            <Input
              value={newSpeakerName}
              onChange={(e) => setNewSpeakerName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleAddSpeaker();
                if (e.key === "Escape") {
                  setIsAdding(false);
                  setNewSpeakerName("");
                }
              }}
              placeholder="Speaker name..."
              className="h-8 text-sm"
              autoFocus
              data-testid="input-new-speaker"
            />
            <Button size="icon" variant="ghost" className="h-8 w-8" onClick={handleAddSpeaker}>
              <Check className="h-4 w-4" />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              className="h-8 w-8"
              onClick={() => {
                setIsAdding(false);
                setNewSpeakerName("");
              }}
              data-testid="button-cancel-add-speaker"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        ) : (
          <Button
            variant="outline"
            size="sm"
            className="w-full"
            onClick={() => setIsAdding(true)}
            data-testid="button-add-speaker"
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Speaker
          </Button>
        )}
      </div>
    </div>
  );
}
