import {
  BookmarkPlus,
  BookOpenText,
  Check,
  Clock,
  Download,
  Keyboard,
  PanelLeft,
  PanelLeftClose,
  Redo2,
  ScanText,
  SpellCheck,
  Trash2,
  Undo2,
} from "lucide-react";
import { useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Separator } from "@/components/ui/separator";
import { Slider } from "@/components/ui/slider";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { FileUpload } from "../FileUpload";
import { ThemeToggle } from "../ThemeToggle";
import type { TranscriptEditorState } from "./useTranscriptEditor";

type ToolbarProps = TranscriptEditorState["toolbarProps"];

export function Toolbar({
  sidebarOpen,
  onToggleSidebar,
  onAudioUpload,
  onTranscriptUpload,
  audioFileName,
  transcriptFileName,
  transcriptLoaded,
  sessionKind,
  sessionLabel,
  activeSessionKey,
  recentSessions,
  onActivateSession,
  onDeleteSession,
  onShowRevisionDialog,
  canCreateRevision,
  onUndo,
  onRedo,
  canUndo,
  canRedo,
  onShowShortcuts,
  onShowExport,
  highlightLowConfidence,
  onToggleHighlightLowConfidence,
  confidencePopoverOpen,
  onConfidencePopoverChange,
  lowConfidenceThreshold,
  onManualConfidenceChange,
  onResetConfidenceThreshold,
  spellcheckPopoverOpen,
  onSpellcheckPopoverChange,
  spellcheckEnabled,
  onToggleSpellcheck,
  spellcheckLanguages,
  onSpellcheckLanguageChange,
  spellcheckCustomEnabled,
  onToggleSpellcheckCustom,
  onShowCustomDictionaries,
  spellcheckCustomDictionariesCount,
  onShowSpellcheckDialog,
  spellcheckDebugEnabled,
  effectiveSpellcheckLanguages,
  spellcheckerLanguages,
  spellcheckHighlightActive,
  glossaryHighlightActive,
  onShowGlossary,
}: ToolbarProps) {
  const revisionName = sessionKind === "revision" ? (sessionLabel ?? "Revision") : null;

  const groupedSessions = useMemo(() => {
    const baseOrder: string[] = [];
    const baseMap = new Map<string, (typeof recentSessions)[number]>();
    const revisionsByBase = new Map<string, (typeof recentSessions)[number][]>();

    recentSessions.forEach((session) => {
      if (session.kind !== "revision") {
        if (!baseMap.has(session.key)) {
          baseOrder.push(session.key);
          baseMap.set(session.key, session);
        }
      }
    });

    recentSessions.forEach((session) => {
      if (session.kind !== "revision" || !session.baseSessionKey) return;
      const list = revisionsByBase.get(session.baseSessionKey) ?? [];
      list.push(session);
      revisionsByBase.set(session.baseSessionKey, list);
      if (!baseMap.has(session.baseSessionKey)) {
        baseOrder.push(session.baseSessionKey);
        baseMap.set(session.baseSessionKey, {
          key: session.baseSessionKey,
          audioName: session.audioName,
          transcriptName: session.transcriptName,
          updatedAt: session.updatedAt,
          kind: "current",
          label: null,
          baseSessionKey: null,
        });
      }
    });

    return baseOrder.map((key) => ({
      base: baseMap.get(key),
      revisions: (revisionsByBase.get(key) ?? []).sort(
        (a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0),
      ),
    }));
  }, [recentSessions]);

  return (
    <header className="flex items-center gap-3 h-14 px-4 border-b bg-card">
      <TooltipProvider delayDuration={200}>
        <div className="flex flex-1 items-center gap-3 min-w-0">
          <div className="flex items-center gap-2">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={onToggleSidebar}
                  data-testid="button-toggle-sidebar"
                  aria-label={sidebarOpen ? "Close sidebar" : "Open sidebar"}
                >
                  {sidebarOpen ? (
                    <PanelLeftClose className="h-4 w-4" />
                  ) : (
                    <PanelLeft className="h-4 w-4" />
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent>Toggle sidebar</TooltipContent>
            </Tooltip>
            <h1 className="text-sm font-semibold tracking-tight">FlowScribe</h1>
          </div>

          <Separator orientation="vertical" className="h-6" />

          <div className="flex items-center gap-2">
            <FileUpload
              onAudioUpload={onAudioUpload}
              onTranscriptUpload={onTranscriptUpload}
              audioFileName={audioFileName}
              transcriptFileName={transcriptFileName}
              transcriptLoaded={transcriptLoaded}
              revisionName={revisionName}
              variant="inline"
            />
            <DropdownMenu>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span>
                    <DropdownMenuTrigger asChild>
                      <Button
                        size="icon"
                        variant="ghost"
                        aria-label="Recent sessions"
                        data-testid="button-recent-sessions"
                      >
                        <Clock className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                  </span>
                </TooltipTrigger>
                <TooltipContent>Recent sessions</TooltipContent>
              </Tooltip>
              <DropdownMenuContent align="end" className="w-64">
                <DropdownMenuLabel>Recent sessions</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {recentSessions.length === 0 ? (
                  <DropdownMenuItem disabled>No recent sessions</DropdownMenuItem>
                ) : (
                  groupedSessions.slice(0, 8).map(({ base, revisions }) => {
                    if (!base) return null;
                    const baseActive = base.key === activeSessionKey;
                    return (
                      <div key={base.key} className="flex flex-col">
                        <DropdownMenuItem
                          onClick={() => onActivateSession(base.key)}
                          className={cn(
                            "flex flex-col items-start gap-1 group relative pr-8",
                            baseActive && "bg-accent/40",
                          )}
                          aria-current={baseActive ? "true" : undefined}
                        >
                          <div className="flex w-full items-center gap-2">
                            <span className="text-xs text-muted-foreground">
                              {base.audioName || "Unknown audio"}
                            </span>
                            {baseActive ? (
                              <Check className="h-3 w-3 text-muted-foreground" />
                            ) : null}
                          </div>
                          <div className="flex items-center gap-2 w-full">
                            <span className="text-sm font-medium">
                              {base.transcriptName || "Untitled transcript"}
                            </span>
                          </div>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="absolute right-1 top-1/2 -translate-y-1/2 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                            onClick={(e) => {
                              e.stopPropagation();
                              onDeleteSession(base.key);
                            }}
                            aria-label="Delete session"
                          >
                            <Trash2 className="h-3 w-3 text-muted-foreground hover:text-destructive" />
                          </Button>
                        </DropdownMenuItem>
                        {revisions.map((revision) => {
                          const isActive = revision.key === activeSessionKey;
                          return (
                            <DropdownMenuItem
                              key={revision.key}
                              onClick={() => onActivateSession(revision.key)}
                              className={cn(
                                "flex flex-col items-start gap-1 pl-6 group relative pr-8",
                                isActive && "bg-accent/40",
                              )}
                              aria-current={isActive ? "true" : undefined}
                            >
                              <div className="flex w-full items-center gap-2">
                                <span className="text-xs text-muted-foreground">
                                  {revision.audioName || "Unknown audio"}
                                </span>
                                {isActive ? (
                                  <Check className="h-3 w-3 text-muted-foreground" />
                                ) : null}
                              </div>
                              <div className="flex items-center gap-2 w-full">
                                <span className="text-sm font-medium">
                                  {revision.transcriptName || "Untitled transcript"}
                                </span>
                                {revision.label ? (
                                  <Badge variant="secondary">{revision.label}</Badge>
                                ) : null}
                              </div>
                              <Button
                                size="icon"
                                variant="ghost"
                                className="absolute right-1 top-1/2 -translate-y-1/2 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onDeleteSession(revision.key);
                                }}
                                aria-label="Delete revision"
                              >
                                <Trash2 className="h-3 w-3 text-muted-foreground hover:text-destructive" />
                              </Button>
                            </DropdownMenuItem>
                          );
                        })}
                      </div>
                    );
                  })
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          <Separator orientation="vertical" className="h-6" />

          <div className="flex items-center gap-2">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={onUndo}
                  disabled={!canUndo}
                  data-testid="button-undo"
                  aria-label="Undo"
                >
                  <Undo2 className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Undo (Ctrl+Z)</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={onRedo}
                  disabled={!canRedo}
                  data-testid="button-redo"
                  aria-label="Redo"
                >
                  <Redo2 className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Redo (Ctrl+Shift+Z)</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={onShowShortcuts}
                  data-testid="button-show-shortcuts"
                  aria-label="Keyboard shortcuts"
                >
                  <Keyboard className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Keyboard shortcuts</TooltipContent>
            </Tooltip>
          </div>

          <Separator orientation="vertical" className="h-6" />

          <div className="flex items-center gap-2">
            <Popover open={confidencePopoverOpen} onOpenChange={onConfidencePopoverChange}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <PopoverTrigger asChild>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        onToggleHighlightLowConfidence();
                        onConfidencePopoverChange(true);
                      }}
                      aria-pressed={highlightLowConfidence}
                      aria-label="Toggle low confidence highlight"
                      data-testid="button-toggle-confidence"
                      className={
                        highlightLowConfidence
                          ? "px-2 gap-2 bg-accent text-accent-foreground"
                          : "px-2 gap-2"
                      }
                    >
                      <ScanText className="h-4 w-4" aria-hidden="true" />
                      <span className="hidden sm:inline">Confidence</span>
                    </Button>
                  </PopoverTrigger>
                </TooltipTrigger>
                <TooltipContent>Low confidence highlight</TooltipContent>
              </Tooltip>
              <PopoverContent className="w-64" align="end">
                <div className="space-y-3">
                  <div className="text-xs text-muted-foreground">Low confidence threshold</div>
                  <Slider
                    value={[lowConfidenceThreshold ?? 0.4]}
                    min={0}
                    max={1}
                    step={0.05}
                    disabled={lowConfidenceThreshold === null}
                    onValueChange={(value) => {
                      onManualConfidenceChange(value[0] ?? 0.4);
                    }}
                  />
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>
                      {lowConfidenceThreshold === null
                        ? "No scores"
                        : `Now: ${lowConfidenceThreshold.toFixed(2)}`}
                    </span>
                    <Button size="sm" variant="ghost" onClick={onResetConfidenceThreshold}>
                      Auto
                    </Button>
                  </div>
                </div>
              </PopoverContent>
            </Popover>
            <Popover open={spellcheckPopoverOpen} onOpenChange={onSpellcheckPopoverChange}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <PopoverTrigger asChild>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => onSpellcheckPopoverChange(true)}
                      aria-label="Spellcheck settings"
                      data-testid="button-spellcheck"
                      aria-pressed={spellcheckHighlightActive}
                      className={cn(
                        "px-2 gap-2",
                        spellcheckHighlightActive && "bg-accent text-accent-foreground",
                      )}
                    >
                      <SpellCheck className="h-4 w-4" aria-hidden="true" />
                      <span className="hidden sm:inline">Spellcheck</span>
                    </Button>
                  </PopoverTrigger>
                </TooltipTrigger>
                <TooltipContent>Spellcheck settings</TooltipContent>
              </Tooltip>
              <PopoverContent className="w-72" align="end">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="text-sm font-medium">Spellcheck</div>
                    <Button
                      size="sm"
                      variant={spellcheckEnabled ? "secondary" : "outline"}
                      onClick={onToggleSpellcheck}
                    >
                      {spellcheckEnabled ? "On" : "Off"}
                    </Button>
                  </div>
                  <div className="space-y-2">
                    <div className="text-xs text-muted-foreground">Languages</div>
                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        variant={spellcheckLanguages.includes("de") ? "secondary" : "outline"}
                        onClick={() => onSpellcheckLanguageChange(["de"])}
                      >
                        DE
                      </Button>
                      <Button
                        size="sm"
                        variant={spellcheckLanguages.includes("en") ? "secondary" : "outline"}
                        onClick={() => onSpellcheckLanguageChange(["en"])}
                      >
                        EN
                      </Button>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            size="sm"
                            variant={spellcheckCustomEnabled ? "secondary" : "outline"}
                          >
                            Custom
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            onClick={onToggleSpellcheckCustom}
                            className={
                              spellcheckCustomEnabled
                                ? "border border-border font-medium"
                                : "border border-muted-foreground/40 text-muted-foreground"
                            }
                          >
                            {spellcheckCustomEnabled ? (
                              <Check className="h-4 w-4 mr-2" />
                            ) : (
                              <span className="w-4 h-4 mr-2" />
                            )}
                            {spellcheckCustomEnabled ? "Activated" : "Deactivated"}
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={onShowCustomDictionaries}>
                            Manage dictionaries
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                  <Button size="sm" variant="ghost" onClick={onShowSpellcheckDialog}>
                    Manage ignore list
                  </Button>
                  {!spellcheckEnabled && (
                    <div className="text-xs text-muted-foreground">
                      Enable spellcheck to highlight and filter spelling issues.
                    </div>
                  )}
                  {spellcheckDebugEnabled && (
                    <div className="rounded-md border border-dashed px-2 py-1 text-[11px] text-muted-foreground">
                      <div>
                        enabled: {spellcheckEnabled ? "on" : "off"} | custom:{" "}
                        {spellcheckCustomEnabled ? "on" : "off"}
                      </div>
                      <div>
                        languages:{" "}
                        {effectiveSpellcheckLanguages.length > 0
                          ? effectiveSpellcheckLanguages.join(",")
                          : "none"}
                      </div>
                      <div>
                        custom dicts: {spellcheckCustomDictionariesCount} | checkers:{" "}
                        {spellcheckerLanguages.length > 0
                          ? spellcheckerLanguages.join(",")
                          : "none"}
                      </div>
                    </div>
                  )}
                </div>
              </PopoverContent>
            </Popover>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={onShowGlossary}
                  aria-label="Glossary settings"
                  data-testid="button-glossary"
                  aria-pressed={glossaryHighlightActive}
                  className={cn(
                    "px-2 gap-2",
                    glossaryHighlightActive && "bg-accent text-accent-foreground",
                  )}
                >
                  <BookOpenText className="h-4 w-4" aria-hidden="true" />
                  <span className="hidden sm:inline">Glossary</span>
                </Button>
              </TooltipTrigger>
              <TooltipContent>Glossary settings</TooltipContent>
            </Tooltip>
          </div>
        </div>

        <Separator orientation="vertical" className="h-6" />

        <div className="flex items-center gap-2">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                size="sm"
                variant="outline"
                onClick={onShowRevisionDialog}
                disabled={!canCreateRevision}
                data-testid="button-save-revision"
              >
                <BookmarkPlus className="h-4 w-4 mr-2" />
                Save revision
              </Button>
            </TooltipTrigger>
            <TooltipContent>Save a Revision of the current edits</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="default"
                onClick={onShowExport}
                disabled={!transcriptLoaded}
                data-testid="button-export"
              >
                <Download className="h-4 w-4 mr-2" />
                Export
              </Button>
            </TooltipTrigger>
            <TooltipContent>Export transcript</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <span>
                <ThemeToggle />
              </span>
            </TooltipTrigger>
            <TooltipContent>Toggle theme</TooltipContent>
          </Tooltip>
        </div>
      </TooltipProvider>
    </header>
  );
}
