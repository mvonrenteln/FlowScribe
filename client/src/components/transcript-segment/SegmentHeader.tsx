import { User, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { Segment, Speaker, Tag } from "@/lib/store";

interface SegmentHeaderProps {
  readonly segment: Segment;
  readonly speakers: Speaker[];
  readonly speakerColor: string;
  readonly onSpeakerChange: (speaker: string) => void;
  readonly tags?: Tag[];
  readonly onRemoveTag?: (tagId: string) => void;
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
}: SegmentHeaderProps) {
  return (
    <div className="flex flex-wrap items-center gap-2 mb-2">
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

      <span className="text-xs font-mono tabular-nums text-muted-foreground">
        {formatTimestamp(segment.start)} - {formatTimestamp(segment.end)}
      </span>
      {segment.confirmed && (
        <span className="text-xs font-semibold text-emerald-600/90 bg-emerald-600/10 rounded px-1.5 py-0.5">
          Confirmed
        </span>
      )}

      {/* Inline Tag Badges in header to save vertical space */}
      {segment.tags && segment.tags.length > 0 && (
        <div className="flex items-center gap-1 ml-auto">
          {segment.tags.map((tagId) => {
            const tag = tags.find((t) => t.id === tagId);
            if (!tag) return null;
            return (
              <Badge
                key={tagId}
                variant="secondary"
                className="text-xs px-2 py-0.5 gap-1 flex items-center"
                style={{ borderLeftWidth: "3px", borderLeftColor: tag.color }}
              >
                <span className="mr-1">{tag.name}</span>
                {onRemoveTag && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onRemoveTag(tagId);
                    }}
                    className="hover:text-destructive"
                    aria-label={`Remove tag ${tag.name}`}
                  >
                    <X className="h-3 w-3" />
                  </button>
                )}
              </Badge>
            );
          })}
        </div>
      )}
    </div>
  );
}
