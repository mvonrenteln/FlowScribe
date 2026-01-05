import { User } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { Segment, Speaker } from "@/lib/store";

interface SegmentHeaderProps {
  readonly segment: Segment;
  readonly speakers: Speaker[];
  readonly speakerColor: string;
  readonly onSpeakerChange: (speaker: string) => void;
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
    </div>
  );
}
