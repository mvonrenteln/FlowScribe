import { Plus, User, X } from "lucide-react";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { Segment, Speaker, Tag } from "@/lib/store";

export interface SegmentHeaderProps {
  readonly segment: Segment;
  readonly speakers: Speaker[];
  readonly speakerColor: string;
  readonly onSpeakerChange: (speaker: string) => void;
  readonly tags?: Tag[];
  readonly onRemoveTag?: (tagId: string) => void;
  readonly onAddTag?: (tagId: string) => void;
}

function formatTimestamp(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  const ms = Math.floor((seconds % 1) * 100);
  return `${mins}:${secs.toString().padStart(2, "0")}.${ms.toString().padStart(2, "0")}`;
}

export function SegmentHeader({
  segment,
  speakers,
  speakerColor,
  onSpeakerChange,
  tags = [],
  onRemoveTag,
  onAddTag,
}: SegmentHeaderProps) {
  const [overlayOpen, setOverlayOpen] = useState(false);
  return (
    <div className="relative flex flex-wrap items-center gap-2 mb-2 overflow-visible">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Badge
            variant="secondary"
            className="cursor-pointer text-xs uppercase tracking-wide"
            style={{
              backgroundColor: `${speakerColor}20`,
              color: speakerColor,
              borderColor: speakerColor,
            }}
            data-testid={`badge-speaker-${segment.id}`}
          >
            <User className="h-3 w-3 mr-1" />
            {segment.speaker}
          </Badge>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          {speakers.map((speaker) => (
            <DropdownMenuItem
              key={speaker.id}
              onClick={() => onSpeakerChange(speaker.name)}
              data-testid={`menu-speaker-${speaker.name}`}
            >
              <div
                className="w-2 h-2 rounded-full mr-2"
                style={{ backgroundColor: speaker.color }}
              />
              {speaker.name}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      <span className="text-xs font-mono tabular-nums text-muted-foreground mr-3">
        {formatTimestamp(segment.start)} - {formatTimestamp(segment.end)}
      </span>
      {segment.confirmed && (
        <span className="text-xs font-semibold text-emerald-600/90 bg-emerald-600/10 rounded px-1.5 py-0.5">
          Confirmed
        </span>
      )}

      {/* Tag list with hover-to-expand functionality */}
      {segment.tags && segment.tags.length > 0 && (
        // biome-ignore lint/a11y/noStaticElementInteractions: Hover-based UI for tag overlay
        <div
          className="ml-auto mr-2 relative group"
          onMouseEnter={() => setOverlayOpen(true)}
          onMouseLeave={() => setOverlayOpen(false)}
          role="presentation"
        >
          {/* Tag container that transitions between inline and overlay mode */}
          <div
            className={`
              flex items-center gap-1.5 transition-all
              ${
                overlayOpen
                  ? "absolute right-0 top-0 flex-wrap p-2 bg-popover border rounded shadow-lg z-50 max-h-56 overflow-auto"
                  : "max-w-[28ch] overflow-hidden whitespace-nowrap"
              }
            `}
          >
            {segment.tags.map((tagId) => {
              const tag = tags.find((t) => t.id === tagId);
              if (!tag) return null;
              return (
                <Badge
                  key={tagId}
                  variant="secondary"
                  className="text-xs px-2 py-0.5 flex items-center gap-1.5 flex-shrink-0"
                  style={{ borderLeftWidth: "3px", borderLeftColor: tag.color }}
                >
                  <span>{tag.name}</span>
                  {onRemoveTag && overlayOpen && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onRemoveTag(tagId);
                      }}
                      className="hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
                      aria-label={`Remove tag ${tag.name}`}
                    >
                      <X className="h-3 w-3" />
                    </button>
                  )}
                </Badge>
              );
            })}
            {/* Add Tag Button - visible on hover at the end of tag list */}
            {onAddTag && overlayOpen && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 flex-shrink-0"
                    data-testid={`button-add-tag-${segment.id}`}
                  >
                    <Plus className="h-3 w-3" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="max-h-64 overflow-auto">
                  {tags
                    .filter((tag) => !segment.tags?.includes(tag.id))
                    .map((tag) => (
                      <DropdownMenuItem
                        key={tag.id}
                        onClick={() => onAddTag(tag.id)}
                        data-testid={`menu-add-tag-${tag.id}`}
                      >
                        <div
                          className="w-2 h-2 rounded-full mr-2"
                          style={{ backgroundColor: tag.color }}
                        />
                        {tag.name}
                      </DropdownMenuItem>
                    ))}
                  {tags.filter((tag) => !segment.tags?.includes(tag.id)).length === 0 && (
                    <div className="px-2 py-1.5 text-xs text-muted-foreground">
                      Alle Tags bereits zugewiesen
                    </div>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
