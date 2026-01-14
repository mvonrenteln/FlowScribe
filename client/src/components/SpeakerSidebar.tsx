import {
  Check,
  CircleDashed,
  Edit2,
  Merge,
  Plus,
  Tag as TagIcon,
  Trash2,
  UsersRound,
  X,
  XCircle,
} from "lucide-react";
import { type KeyboardEvent, useEffect, useMemo, useRef, useState } from "react";
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
import type { Segment, Speaker, Tag } from "@/lib/store";
import { cn } from "@/lib/utils";
import { SearchAndReplacePanel } from "./transcript-editor/SearchAndReplacePanel";

interface SpeakerSidebarProps {
  speakers: Speaker[];
  segments: Segment[];
  tags: Tag[];
  onRenameSpeaker: (oldName: string, newName: string) => void;
  onAddSpeaker: (name: string) => void;
  onMergeSpeakers?: (fromName: string, toName: string) => void;
  onSpeakerSelect?: (speakerId: string) => void;
  onClearFilter?: () => void;
  selectedSpeakerId?: string;
  // Tag operations
  onAddTag?: (name: string) => boolean | void;
  onRenameTag?: (tagId: string, newName: string) => boolean | void;
  onDeleteTag?: (tagId: string) => void;
  onTagSelect?: (tagId: string) => void;
  selectedTagIds?: string[];
  selectedNotTagIds?: string[];
  noTagsFilterActive?: boolean;
  onToggleNoTagsFilter?: () => void;
  lowConfidenceFilterActive?: boolean;
  onToggleLowConfidenceFilter?: () => void;
  lowConfidenceThreshold?: number | null;
  onLowConfidenceThresholdChange?: (value: number | null) => void;
  bookmarkFilterActive?: boolean;
  onToggleBookmarkFilter?: () => void;
  lexiconFilterActive?: boolean;
  onToggleLexiconFilter?: () => void;
  lexiconMatchCount?: number;
  lexiconLowScoreMatchCount?: number;
  lexiconLowScoreFilterActive?: boolean;
  onToggleLexiconLowScoreFilter?: () => void;
  spellcheckFilterActive?: boolean;
  onToggleSpellcheckFilter?: () => void;
  spellcheckMatchCount?: number;
  spellcheckMatchLimitReached?: boolean;
  spellcheckEnabled?: boolean;
  searchQuery?: string;
  onSearchQueryChange?: (value: string) => void;
  isRegexSearch?: boolean;
  onToggleRegexSearch?: () => void;
  replaceQuery?: string;
  onReplaceQueryChange?: (value: string) => void;
  currentMatchIndex?: number;
  totalMatches?: number;
  goToNextMatch?: () => void;
  goToPrevMatch?: () => void;
  onReplaceCurrent?: () => void;
  onReplaceAll?: () => void;
}

export function SpeakerSidebar({
  speakers,
  segments,
  tags,
  onRenameSpeaker,
  onAddSpeaker,
  onMergeSpeakers,
  onSpeakerSelect,
  onClearFilter,
  selectedSpeakerId,
  onAddTag,
  onRenameTag,
  onDeleteTag,
  onTagSelect,
  selectedTagIds = [],
  selectedNotTagIds = [],
  noTagsFilterActive = false,
  onToggleNoTagsFilter,
  lowConfidenceFilterActive = false,
  onToggleLowConfidenceFilter,
  lowConfidenceThreshold = null,
  onLowConfidenceThresholdChange,
  bookmarkFilterActive = false,
  onToggleBookmarkFilter,
  lexiconFilterActive = false,
  onToggleLexiconFilter,
  lexiconMatchCount = 0,
  lexiconLowScoreMatchCount = 0,
  lexiconLowScoreFilterActive = false,
  onToggleLexiconLowScoreFilter,
  spellcheckFilterActive = false,
  onToggleSpellcheckFilter,
  spellcheckMatchCount = 0,
  spellcheckMatchLimitReached = false,
  spellcheckEnabled = false,
  searchQuery = "",
  onSearchQueryChange,
  isRegexSearch = false,
  onToggleRegexSearch,
  replaceQuery = "",
  onReplaceQueryChange,
  currentMatchIndex = -1,
  totalMatches = 0,
  goToNextMatch,
  goToPrevMatch,
  onReplaceCurrent,
  onReplaceAll,
}: Readonly<SpeakerSidebarProps>) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [isAdding, setIsAdding] = useState(false);
  const [newSpeakerName, setNewSpeakerName] = useState("");
  const [editingTagId, setEditingTagId] = useState<string | null>(null);
  const [editTagValue, setEditTagValue] = useState("");
  const [isAddingTag, setIsAddingTag] = useState(false);
  const [newTagName, setNewTagName] = useState("");
  const [tagError, setTagError] = useState<string | null>(null);
  const [tagInputInvalid, setTagInputInvalid] = useState(false);
  const editInputRef = useRef<HTMLInputElement>(null);
  const editTagInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editingId && editInputRef.current) {
      editInputRef.current.focus();
      editInputRef.current.select();
    }
  }, [editingId]);

  useEffect(() => {
    if (editingTagId && editTagInputRef.current) {
      editTagInputRef.current.focus();
      editTagInputRef.current.select();
    }
  }, [editingTagId]);

  const getSegmentCount = (speakerName: string) => {
    return segments.filter((s) => s.speaker === speakerName).length;
  };

  // Memoize tag segment counts to avoid recalculating on every render
  const tagSegmentCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const tag of tags) {
      counts.set(tag.id, 0);
    }
    for (const segment of segments) {
      const segmentTags = segment.tags ?? [];
      for (const tagId of segmentTags) {
        counts.set(tagId, (counts.get(tagId) ?? 0) + 1);
      }
    }
    return counts;
  }, [segments, tags]);

  const getTagSegmentCount = (tagId: string) => {
    return tagSegmentCounts.get(tagId) ?? 0;
  };

  const getNoTagsSegmentCount = () => {
    return segments.filter((s) => (s.tags ?? []).length === 0).length;
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
  const bookmarkCount = segments.filter((segment) => segment.bookmarked).length;
  const spellcheckCount = spellcheckMatchCount ?? 0;
  const spellcheckCountLabel = spellcheckMatchLimitReached ? "1000+" : `${spellcheckCount}`;

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

  const handleStartTagEdit = (tag: Tag) => {
    setEditingTagId(tag.id);
    setEditTagValue(tag.name);
  };

  const handleSaveTagEdit = (tagId: string) => {
    const trimmedValue = editTagValue.trim();
    const tag = tags.find((t) => t.id === tagId);
    if (tag && trimmedValue && trimmedValue !== tag.name) {
      const ok = onRenameTag?.(tagId, trimmedValue);
      if (ok === false) {
        setTagInputInvalid(true);
        setTagError("Tag name invalid or already exists");
        return;
      }
    }
    setEditingTagId(null);
    setEditTagValue("");
    setTagInputInvalid(false);
    setTagError(null);
  };

  const handleCancelTagEdit = () => {
    setEditingTagId(null);
    setEditTagValue("");
  };

  const handleAddTag = () => {
    const trimmed = newTagName.trim();
    if (!trimmed) {
      setTagError("Tag name cannot be empty or whitespace");
      setTagInputInvalid(true);
      return;
    }
    const ok = onAddTag?.(trimmed);
    if (ok === false) {
      setTagError("Tag name invalid or already exists");
      setTagInputInvalid(true);
      return;
    }
    setNewTagName("");
    setIsAddingTag(false);
    setTagInputInvalid(false);
    setTagError(null);
  };

  const handleTagKeyDown = (event: KeyboardEvent<HTMLDivElement>, tagId: string) => {
    if (editingTagId === tagId) {
      return;
    }
    if (event.key === "Enter") {
      event.preventDefault();
      onTagSelect?.(tagId);
    }
  };

  // Debounce search input to prevent filtering on every keystroke
  const [localSearchQuery, setLocalSearchQuery] = useState(searchQuery);

  useEffect(() => {
    setLocalSearchQuery(searchQuery);
  }, [searchQuery]);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (localSearchQuery !== searchQuery) {
        onSearchQueryChange?.(localSearchQuery);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [localSearchQuery, searchQuery, onSearchQueryChange]);

  return (
    <div className="flex flex-col h-full">
      <div className="p-4 border-b space-y-3">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            Transcript Filter
          </h2>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => onClearFilter?.()}
            data-testid="button-clear-filters"
          >
            Clear
          </Button>
        </div>

        <SearchAndReplacePanel
          searchQuery={searchQuery}
          onSearchQueryChange={onSearchQueryChange ?? (() => {})}
          replaceQuery={replaceQuery}
          onReplaceQueryChange={onReplaceQueryChange ?? (() => {})}
          isRegexSearch={isRegexSearch}
          onToggleRegexSearch={onToggleRegexSearch ?? (() => {})}
          currentMatchIndex={currentMatchIndex}
          totalMatches={totalMatches}
          goToNextMatch={goToNextMatch ?? (() => {})}
          goToPrevMatch={goToPrevMatch ?? (() => {})}
          onReplaceCurrent={onReplaceCurrent ?? (() => {})}
          onReplaceAll={onReplaceAll ?? (() => {})}
        />
      </div>

      {/* Speakers Section */}
      <div className="px-4 pt-3 pb-2 border-b">
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2">
            <UsersRound className="h-4 w-4 text-muted-foreground" />
            <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              Speakers
            </span>
          </div>
        </div>
      </div>
      <ScrollArea className="flex-1" style={{ maxHeight: "40%" }}>
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

          {/* Add Speaker Button */}
          {isAdding ? (
            <div className="flex items-center gap-1 pt-2">
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
            <div className="pt-2">
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
            </div>
          )}
        </div>
      </ScrollArea>

      {/* Tags Section */}
      <div className="px-4 pt-3 pb-2 border-b">
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2">
            <TagIcon className="h-4 w-4 text-muted-foreground" />
            <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              Tags
            </span>
          </div>
        </div>
      </div>
      <ScrollArea className="flex-1" style={{ maxHeight: "30%" }}>
        <div className="p-2 space-y-1">
          {tags.map((tag, index) => {
            const isNotFilter = selectedNotTagIds.includes(tag.id);
            const isNormalFilter = selectedTagIds.includes(tag.id);
            return (
              <div
                key={tag.id}
                className={cn(
                  "group flex items-center gap-2 p-2 rounded-md cursor-pointer hover-elevate",
                  (isNormalFilter || isNotFilter) && "bg-accent",
                )}
                onClick={() => {
                  if (editingTagId === tag.id) {
                    return;
                  }
                  onTagSelect?.(tag.id);
                }}
                onKeyDown={(event) => handleTagKeyDown(event, tag.id)}
                data-testid={`tag-card-${tag.id}`}
                role="button"
                tabIndex={0}
                aria-pressed={isNormalFilter || isNotFilter}
              >
                <div
                  className="w-1 h-10 rounded-full flex-shrink-0"
                  style={{ backgroundColor: tag.color }}
                />

                <div className="flex-1 min-w-0">
                  {editingTagId === tag.id ? (
                    <div className="flex items-center gap-1">
                      <Input
                        ref={editTagInputRef}
                        value={editTagValue}
                        onChange={(e) => {
                          setEditTagValue(e.target.value);
                          if (tagInputInvalid) {
                            setTagInputInvalid(false);
                            setTagError(null);
                          }
                        }}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            e.stopPropagation();
                            handleSaveTagEdit(tag.id);
                            return;
                          }
                          if (e.key === "Escape") {
                            e.preventDefault();
                            e.stopPropagation();
                            handleCancelTagEdit();
                          }
                        }}
                        className="h-7 text-sm"
                        autoFocus
                        data-testid={`input-rename-tag-${tag.id}`}
                      />
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7"
                        onClick={(event) => {
                          event.stopPropagation();
                          handleSaveTagEdit(tag.id);
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
                          handleCancelTagEdit();
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
                        <span
                          className={cn(
                            "text-sm font-medium truncate",
                            isNotFilter && "line-through",
                          )}
                        >
                          {tag.name}
                        </span>
                        {isNotFilter && <XCircle className="h-4 w-4 text-destructive" />}
                        <div className="invisible group-hover:visible flex gap-1">
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-6 w-6"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleStartTagEdit(tag);
                            }}
                            data-testid={`button-edit-tag-${tag.id}`}
                          >
                            <Edit2 className="h-3 w-3" />
                          </Button>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-6 w-6"
                                onClick={(e) => e.stopPropagation()}
                                data-testid={`button-delete-tag-${tag.id}`}
                              >
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onDeleteTag?.(tag.id);
                                }}
                                className="text-destructive focus:text-destructive"
                                data-testid={`confirm-delete-tag-${tag.id}`}
                              >
                                <Trash2 className="h-3 w-3 mr-2" />
                                Tag löschen
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <span>{getTagSegmentCount(tag.id)} segments</span>
                      </div>
                    </>
                  )}
                </div>
              </div>
            );
          })}

          {/* No Tags Filter */}
          <div
            className={cn(
              "group flex items-center gap-2 p-2 rounded-md cursor-pointer hover-elevate",
              noTagsFilterActive && "bg-accent",
            )}
            onClick={(e) => {
              e.stopPropagation();
              console.log("No Tags clicked", { noTagsFilterActive, onToggleNoTagsFilter });
              onToggleNoTagsFilter?.();
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                e.stopPropagation();
                onToggleNoTagsFilter?.();
              }
            }}
            data-testid="no-tags-filter"
            role="button"
            tabIndex={0}
            aria-pressed={noTagsFilterActive}
          >
            <CircleDashed className="h-4 w-4 text-muted-foreground flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">No Tags</span>
              </div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span>{getNoTagsSegmentCount()} segments</span>
              </div>
            </div>
          </div>

          {/* Add Tag Button */}
          {isAddingTag ? (
            <>
              <div className="flex items-center gap-1 pt-2">
              <Input
                value={newTagName}
                onChange={(e) => {
                  setNewTagName(e.target.value);
                  if (tagInputInvalid) {
                    setTagInputInvalid(false);
                    setTagError(null);
                  }
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleAddTag();
                  if (e.key === "Escape") {
                    setIsAddingTag(false);
                    setNewTagName("");
                  }
                }}
                placeholder="Tag name..."
                className={cn("h-8 text-sm", tagInputInvalid && "border-destructive ring-1 ring-destructive")}
                autoFocus
                data-testid="input-new-tag"
              />
              <Button size="icon" variant="ghost" className="h-8 w-8" onClick={handleAddTag}>
                <Check className="h-4 w-4" />
              </Button>
              <Button
                size="icon"
                variant="ghost"
                className="h-8 w-8"
                onClick={() => {
                  setIsAddingTag(false);
                  setNewTagName("");
                }}
                data-testid="button-cancel-add-tag"
              >
                <X className="h-4 w-4" />
              </Button>
              </div>
              {tagError && (
                <p className="text-destructive text-xs mt-1 px-2" data-testid="tag-error">
                  {tagError}
                </p>
              )}
            </>
          ) : (
            <div className="pt-2">
              <Button
                variant="outline"
                size="sm"
                className="w-full"
                onClick={() => setIsAddingTag(true)}
                data-testid="button-add-tag"
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Tag
              </Button>
            </div>
          )}
          <div className="border-t">
            {/* Review/Filters Section */}
            <div className="px-4 pt-3 pb-2">
              <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                Review
              </div>
            </div>
            <div className="p-2">
              <button
                type="button"
                data-testid="button-filter-low-confidence"
                className={cn(
                  "mt-2 w-full flex items-center justify-between gap-2 rounded-md px-2 py-1.5 text-sm",
                  "hover-elevate",
                  lowConfidenceFilterActive && "bg-accent",
                  lowConfidenceCount === 0 && !lowConfidenceFilterActive && "opacity-50 cursor-not-allowed",
                )}
                onClick={() => {
                  if (lowConfidenceCount === 0 && !lowConfidenceFilterActive) return;
                  onToggleLowConfidenceFilter?.();
                }}
              >
                <span>Low confidence</span>
                <span className="text-xs text-muted-foreground">{lowConfidenceCount}</span>
              </button>
            </div>
            <div className="p-2 space-y-1">
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
          
          <button
            type="button"
            className={cn(
              "mt-2 w-full flex items-center justify-between gap-2 rounded-md px-2 py-1.5 text-sm",
              "hover-elevate",
              spellcheckFilterActive && "bg-accent",
              (!spellcheckEnabled || spellcheckCount === 0) &&
                !spellcheckFilterActive &&
                "opacity-50 cursor-not-allowed",
            )}
            onClick={() => {
              if (!spellcheckEnabled) return;
              if (spellcheckCount === 0 && !spellcheckFilterActive) return;
              onToggleSpellcheckFilter?.();
            }}
            data-testid="button-filter-spellcheck"
          >
            <span>Spelling issues</span>
            <span className="text-xs text-muted-foreground">{spellcheckCountLabel}</span>
          </button>
          <button
            type="button"
            className={cn(
              "mt-2 w-full flex items-center justify-between gap-2 rounded-md px-2 py-1.5 text-sm",
              "hover-elevate",
              lexiconFilterActive && "bg-accent",
              lexiconMatchCount === 0 && !lexiconFilterActive && "opacity-50 cursor-not-allowed",
            )}
            onClick={() => {
              if (lexiconMatchCount === 0 && !lexiconFilterActive) return;
              onToggleLexiconFilter?.();
            }}
            data-testid="button-filter-glossary"
          >
            <span>Glossary matches</span>
            <span className="text-xs text-muted-foreground">{lexiconMatchCount}</span>
          </button>
          <button
            type="button"
            className={cn(
              "mt-2 w-full flex items-center justify-between gap-2 rounded-md px-2 py-1.5 text-sm",
              "hover-elevate",
              lexiconLowScoreFilterActive && "bg-accent",
              lexiconLowScoreMatchCount === 0 &&
                !lexiconLowScoreFilterActive &&
                "opacity-50 cursor-not-allowed",
            )}
            onClick={() => {
              if (lexiconLowScoreMatchCount === 0 && !lexiconLowScoreFilterActive) return;
              onToggleLexiconLowScoreFilter?.();
            }}
            data-testid="button-filter-glossary-low-score"
          >
            <span>Uncertain Glossary Matches</span>
            <span className="text-xs text-muted-foreground">{lexiconLowScoreMatchCount}</span>
          </button>
          <button
            type="button"
            className={cn(
              "mt-2 w-full flex items-center justify-between gap-2 rounded-md px-2 py-1.5 text-sm",
              "hover-elevate",
              bookmarkFilterActive && "bg-accent",
              bookmarkCount === 0 && !bookmarkFilterActive && "opacity-50 cursor-not-allowed",
            )}
            onClick={() => {
              if (bookmarkCount === 0 && !bookmarkFilterActive) return;
              onToggleBookmarkFilter?.();
            }}
            data-testid="button-filter-bookmarks"
          >
            <span>Bookmarked</span>
            <span className="text-xs text-muted-foreground">{bookmarkCount}</span>
          </button>
        </div>
        </div>
      </div>
      </ScrollArea>
    </div>
  );
}
