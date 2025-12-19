import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Plus, Check, X, Edit2, Merge } from 'lucide-react';
import type { Speaker, Segment } from '@/lib/store';
import { cn } from '@/lib/utils';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface SpeakerSidebarProps {
  speakers: Speaker[];
  segments: Segment[];
  onRenameSpeaker: (oldName: string, newName: string) => void;
  onAddSpeaker: (name: string) => void;
  onMergeSpeakers?: (fromName: string, toName: string) => void;
  onSpeakerSelect?: (speakerName: string) => void;
  onClearFilter?: () => void;
  selectedSpeaker?: string;
}

export function SpeakerSidebar({
  speakers,
  segments,
  onRenameSpeaker,
  onAddSpeaker,
  onMergeSpeakers,
  onSpeakerSelect,
  onClearFilter,
  selectedSpeaker,
}: SpeakerSidebarProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [newSpeakerName, setNewSpeakerName] = useState('');
  const editInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editingId && editInputRef.current) {
      editInputRef.current.focus();
      editInputRef.current.select();
    }
  }, [editingId]);

  const getSegmentCount = (speakerName: string) => {
    return segments.filter(s => s.speaker === speakerName).length;
  };

  const getTotalDuration = (speakerName: string) => {
    const speakerSegments = segments.filter(s => s.speaker === speakerName);
    const total = speakerSegments.reduce((acc, s) => acc + (s.end - s.start), 0);
    const mins = Math.floor(total / 60);
    const secs = Math.floor(total % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleStartEdit = (speaker: Speaker) => {
    setEditingId(speaker.id);
    setEditValue(speaker.name);
  };

  const handleSaveEdit = (oldName: string) => {
    if (editValue.trim() && editValue !== oldName) {
      onRenameSpeaker(oldName, editValue.trim());
    }
    setEditingId(null);
    setEditValue('');
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditValue('');
  };

  const handleAddSpeaker = () => {
    if (newSpeakerName.trim()) {
      onAddSpeaker(newSpeakerName.trim());
      setNewSpeakerName('');
      setIsAdding(false);
    }
  };

  return (
    <div className="flex flex-col h-full">
      <div className="p-4 border-b">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-sm font-semibold">Speakers</h2>
          {selectedSpeaker && (
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
          {speakers.length} speaker{speakers.length !== 1 ? 's' : ''} detected
        </p>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-2 space-y-1">
          {speakers.map((speaker, index) => (
            <div
              key={speaker.id}
              className={cn(
                "group flex items-center gap-2 p-2 rounded-md cursor-pointer hover-elevate",
                selectedSpeaker === speaker.name && "bg-accent"
              )}
              onClick={() => onSpeakerSelect?.(speaker.name)}
              data-testid={`speaker-card-${speaker.id}`}
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
                        if (e.key === 'Enter') handleSaveEdit(speaker.name);
                        if (e.key === 'Escape') handleCancelEdit();
                      }}
                      className="h-7 text-sm"
                      autoFocus
                      data-testid={`input-rename-${speaker.id}`}
                    />
                    <Button 
                      size="icon" 
                      variant="ghost" 
                      className="h-7 w-7"
                      onClick={() => handleSaveEdit(speaker.name)}
                    >
                      <Check className="h-3 w-3" />
                    </Button>
                    <Button 
                      size="icon" 
                      variant="ghost" 
                      className="h-7 w-7"
                      onClick={handleCancelEdit}
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
                      <span className="text-sm font-medium truncate">
                        {speaker.name}
                      </span>
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
                          {speakers.filter((s) => s.name !== speaker.name).map((target) => (
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
        </div>
      </ScrollArea>

      <div className="p-2 border-t">
        {isAdding ? (
          <div className="flex items-center gap-1">
            <Input
              value={newSpeakerName}
              onChange={(e) => setNewSpeakerName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleAddSpeaker();
                if (e.key === 'Escape') {
                  setIsAdding(false);
                  setNewSpeakerName('');
                }
              }}
              placeholder="Speaker name..."
              className="h-8 text-sm"
              autoFocus
              data-testid="input-new-speaker"
            />
            <Button 
              size="icon" 
              variant="ghost" 
              className="h-8 w-8"
              onClick={handleAddSpeaker}
            >
              <Check className="h-4 w-4" />
            </Button>
            <Button 
              size="icon" 
              variant="ghost" 
              className="h-8 w-8"
              onClick={() => {
                setIsAdding(false);
                setNewSpeakerName('');
              }}
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
