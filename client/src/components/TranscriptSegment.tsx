import { useState, useRef, useCallback, useEffect } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { 
  MoreVertical, 
  Scissors, 
  Merge, 
  Trash2, 
  User 
} from 'lucide-react';
import type { Segment, Speaker, Word } from '@/lib/store';
import { cn } from '@/lib/utils';

interface TranscriptSegmentProps {
  segment: Segment;
  speakers: Speaker[];
  isSelected: boolean;
  isActive: boolean;
  currentTime: number;
  onSelect: () => void;
  onTextChange: (text: string) => void;
  onSpeakerChange: (speaker: string) => void;
  onSplit: (wordIndex: number) => void;
  onMergeWithPrevious?: () => void;
  onMergeWithNext?: () => void;
  onDelete: () => void;
  onSeek: (time: number) => void;
}

function formatTimestamp(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  const ms = Math.floor((seconds % 1) * 100);
  return `${mins}:${secs.toString().padStart(2, '0')}.${ms.toString().padStart(2, '0')}`;
}

export function TranscriptSegment({
  segment,
  speakers,
  isSelected,
  isActive,
  currentTime,
  onSelect,
  onTextChange,
  onSpeakerChange,
  onSplit,
  onMergeWithPrevious,
  onMergeWithNext,
  onDelete,
  onSeek,
}: TranscriptSegmentProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [selectedWordIndex, setSelectedWordIndex] = useState<number | null>(null);
  const textRef = useRef<HTMLDivElement>(null);

  const speaker = speakers.find(s => s.name === segment.speaker);
  const speakerColor = speaker?.color || 'hsl(217, 91%, 48%)';

  const handleBlur = useCallback(() => {
    setIsEditing(false);
    if (textRef.current) {
      onTextChange(textRef.current.innerText);
    }
  }, [onTextChange]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleBlur();
    }
    if (e.key === 'Escape') {
      setIsEditing(false);
      if (textRef.current) {
        textRef.current.innerText = segment.text;
      }
    }
  }, [handleBlur, segment.text]);

  const handleWordClick = useCallback((word: Word, index: number, e: React.MouseEvent) => {
    e.stopPropagation();
    if (e.shiftKey) {
      setSelectedWordIndex(index);
    } else {
      onSeek(word.start);
    }
  }, [onSeek]);

  const getActiveWordIndex = useCallback(() => {
    if (!isActive) return -1;
    return segment.words.findIndex(
      (w) => currentTime >= w.start && currentTime <= w.end
    );
  }, [segment.words, currentTime, isActive]);

  const activeWordIndex = getActiveWordIndex();

  return (
    <div
      className={cn(
        "group relative p-3 rounded-md border transition-colors cursor-pointer",
        isSelected && "ring-2 ring-ring",
        isActive && "bg-accent/50",
        !isSelected && !isActive && "hover-elevate"
      )}
      onClick={onSelect}
      data-testid={`segment-${segment.id}`}
      role="article"
      aria-label={`Segment by ${segment.speaker}`}
    >
      <div className="flex items-start gap-3">
        <div 
          className="w-1 self-stretch rounded-full"
          style={{ backgroundColor: speakerColor }}
        />
        
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Badge 
                  variant="secondary" 
                  className="cursor-pointer text-xs uppercase tracking-wide"
                  style={{ 
                    backgroundColor: `${speakerColor}20`,
                    color: speakerColor,
                    borderColor: speakerColor 
                  }}
                  data-testid={`badge-speaker-${segment.id}`}
                >
                  <User className="h-3 w-3 mr-1" />
                  {segment.speaker}
                </Badge>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                {speakers.map((s) => (
                  <DropdownMenuItem
                    key={s.id}
                    onClick={() => onSpeakerChange(s.name)}
                    data-testid={`menu-speaker-${s.name}`}
                  >
                    <div 
                      className="w-2 h-2 rounded-full mr-2" 
                      style={{ backgroundColor: s.color }}
                    />
                    {s.name}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
            
            <span className="text-xs font-mono tabular-nums text-muted-foreground">
              {formatTimestamp(segment.start)} - {formatTimestamp(segment.end)}
            </span>
          </div>

          <div
            ref={textRef}
            contentEditable={isEditing}
            suppressContentEditableWarning
            onDoubleClick={() => setIsEditing(true)}
            onBlur={handleBlur}
            onKeyDown={handleKeyDown}
            className={cn(
              "text-base leading-relaxed outline-none",
              isEditing && "bg-background rounded px-2 py-1 ring-1 ring-ring"
            )}
            data-testid={`text-segment-${segment.id}`}
          >
            {!isEditing ? (
              segment.words.map((word, index) => (
                <span
                  key={index}
                  onClick={(e) => handleWordClick(word, index, e)}
                  className={cn(
                    "cursor-pointer transition-colors",
                    index === activeWordIndex && "bg-primary/20 underline",
                    index === selectedWordIndex && "bg-accent ring-1 ring-ring"
                  )}
                  data-testid={`word-${segment.id}-${index}`}
                >
                  {word.word}{' '}
                </span>
              ))
            ) : (
              segment.text
            )}
          </div>
        </div>

        <div className="flex items-center gap-1 visibility-hidden group-hover:visible">
          {selectedWordIndex !== null && selectedWordIndex > 0 && (
            <Button
              size="icon"
              variant="ghost"
              onClick={(e) => {
                e.stopPropagation();
                onSplit(selectedWordIndex);
                setSelectedWordIndex(null);
              }}
              data-testid={`button-split-${segment.id}`}
              aria-label="Split segment at selected word"
            >
              <Scissors className="h-4 w-4" />
            </Button>
          )}
          
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button 
                size="icon" 
                variant="ghost"
                onClick={(e) => e.stopPropagation()}
                data-testid={`button-segment-menu-${segment.id}`}
                aria-label="Segment options"
              >
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {onMergeWithPrevious && (
                <DropdownMenuItem onClick={onMergeWithPrevious}>
                  <Merge className="h-4 w-4 mr-2" />
                  Merge with previous
                </DropdownMenuItem>
              )}
              {onMergeWithNext && (
                <DropdownMenuItem onClick={onMergeWithNext}>
                  <Merge className="h-4 w-4 mr-2" />
                  Merge with next
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem 
                onClick={onDelete}
                className="text-destructive"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Delete segment
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </div>
  );
}
