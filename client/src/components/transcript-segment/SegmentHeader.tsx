import { Plus, User, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
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
  const [isHovered, setIsHovered] = useState(false);
  const [hoveredTagId, setHoveredTagId] = useState<string | null>(null);
  const [hasOverflow, setHasOverflow] = useState(false);
  const tagRowRef = useRef<HTMLDivElement>(null);
  const tagContainerRef = useRef<HTMLDivElement>(null);

  // Check if tags overflow - recheck when tags change
  // biome-ignore lint/correctness/useExhaustiveDependencies: Need to recalculate when tags are added/removed
  useEffect(() => {
    const checkOverflow = () => {
      if (tagContainerRef.current) {
        const { scrollWidth, clientWidth } = tagContainerRef.current;
        const overflow = scrollWidth > clientWidth + 1; // +1 for rounding
        setHasOverflow(overflow);
      }
    };

    // Small delay to ensure DOM is fully rendered
    const timer = setTimeout(checkOverflow, 0);

    // Recheck on window resize
    window.addEventListener("resize", checkOverflow);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("resize", checkOverflow);
    };
  }, [segment.tags?.length]); // Recheck when tag count changes
  return (
    <div
      className="segment-header-row relative flex flex-wrap items-center gap-2 mb-2 overflow-visible"
      data-testid={`segment-header-${segment.id}`}
    >
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

      {/* Tag list - inline with optional hover-to-expand for overflow */}
      {/* biome-ignore lint/a11y/noStaticElementInteractions: Hover-based UI for tag management */}
      <div
        ref={tagRowRef}
        className="segment-tag-row ml-auto mr-2 relative flex items-center"
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => {
          if (tagRowRef.current?.contains(document.activeElement)) return;
          setIsHovered(false);
        }}
        onFocusCapture={() => setIsHovered(true)}
        onBlurCapture={(event) => {
          const nextFocused = event.relatedTarget as Node | null;
          if (nextFocused && event.currentTarget.contains(nextFocused)) return;
          setIsHovered(false);
        }}
        role="presentation"
        data-testid={`segment-tags-${segment.id}`}
      >
        {segment.tags && segment.tags.length > 0 ? (
          <>
            {/* Normal inline tag display */}
            <div className="flex items-center gap-1.5">
              {/* Tag badges container - clips when too long */}
              <div
                ref={tagContainerRef}
                className="flex items-center gap-1.5 max-w-[28ch] overflow-hidden"
              >
                {segment.tags.map((tagId) => {
                  const tag = tags.find((t) => t.id === tagId);
                  if (!tag) return null;
                  return (
                    <Badge
                      key={tagId}
                      variant="secondary"
                      className="segment-tag-badge text-xs px-2 py-0.5 flex items-center gap-1.5 flex-shrink-0 group/tag"
                      style={{ borderLeftWidth: "3px", borderLeftColor: tag.color }}
                      onMouseEnter={() => setHoveredTagId(tagId)}
                      onMouseLeave={() => setHoveredTagId(null)}
                    >
                      <span>{tag.name}</span>
                      {onRemoveTag && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onRemoveTag(tagId);
                          }}
                          onFocus={() => setHoveredTagId(tagId)}
                          onBlur={() => setHoveredTagId(null)}
                          className={`transition-opacity ${hoveredTagId === tagId ? "opacity-100" : "opacity-0"} w-3`}
                          aria-label={`Remove tag ${tag.name}`}
                        >
                          <X className="h-3 w-3" />
                        </button>
                      )}
                    </Badge>
                  );
                })}
              </div>

              {/* Add Tag Button - always at the end */}
              {onAddTag && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className={`segment-tag-button flex-shrink-0 transition-opacity ${isHovered ? "opacity-100" : "opacity-0"}`}
                      data-testid={`button-add-tag-${segment.id}`}
                      onPointerDown={(e) => {
                        e.stopPropagation();
                      }}
                    >
                      <Plus className="h-3 w-3" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="max-h-64 overflow-auto p-1 text-xs">
                    {tags
                      .filter((tag) => !segment.tags?.includes(tag.id))
                      .map((tag) => (
                        <DropdownMenuItem
                          key={tag.id}
                          className="py-1.5 text-xs"
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

            {/* Overlay for overflow - only shown when tags overflow and hovered */}
            {hasOverflow && isHovered && (
              <div
                className="absolute right-0 top-0 flex flex-wrap gap-1.5 p-2 bg-popover border rounded shadow-lg z-50 max-w-xs"
                role="presentation"
              >
                {segment.tags.map((tagId) => {
                  const tag = tags.find((t) => t.id === tagId);
                  if (!tag) return null;
                  return (
                    <Badge
                      key={`overlay-${tagId}`}
                      variant="secondary"
                      className="segment-tag-badge text-xs px-2 py-0.5 flex items-center gap-1.5 flex-shrink-0"
                      style={{ borderLeftWidth: "3px", borderLeftColor: tag.color }}
                      onMouseEnter={() => setHoveredTagId(tagId)}
                      onMouseLeave={() => setHoveredTagId(null)}
                    >
                      <span>{tag.name}</span>
                      {onRemoveTag && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onRemoveTag(tagId);
                          }}
                          onFocus={() => setHoveredTagId(tagId)}
                          onBlur={() => setHoveredTagId(null)}
                          className={`transition-opacity ${hoveredTagId === tagId ? "opacity-100" : "opacity-0"} w-3`}
                          aria-label={`Remove tag ${tag.name}`}
                        >
                          <X className="h-3 w-3" />
                        </button>
                      )}
                    </Badge>
                  );
                })}
                {/* Add button in overlay */}
                {onAddTag && (
                  <DropdownMenu modal={false}>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="segment-tag-button flex-shrink-0"
                        data-testid={`button-add-tag-overlay-${segment.id}`}
                        onPointerDown={(e) => {
                          e.stopPropagation();
                        }}
                      >
                        <Plus className="h-3 w-3" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="max-h-64 overflow-auto p-1 text-xs">
                      {tags
                        .filter((tag) => !segment.tags?.includes(tag.id))
                        .map((tag) => (
                          <DropdownMenuItem
                            key={tag.id}
                            className="py-1.5 text-xs"
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
            )}
          </>
        ) : (
          /* No tags yet - show "Add Tag" button only on hover */
          onAddTag && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className={`segment-tag-button w-auto px-2 text-xs gap-1.5 transition-opacity ${isHovered ? "opacity-100" : "opacity-0"}`}
                  data-testid={`button-add-first-tag-${segment.id}`}
                >
                  <Plus className="h-3 w-3" />
                  <span>Add Tag</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="max-h-64 overflow-auto p-1 text-xs">
                {tags.map((tag) => (
                  <DropdownMenuItem
                    key={tag.id}
                    className="py-1.5 text-xs"
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
                {tags.length === 0 && (
                  <div className="px-2 py-1.5 text-xs text-muted-foreground">
                    Keine Tags verfügbar
                  </div>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          )
        )}
      </div>
    </div>
  );
}
