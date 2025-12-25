import {
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
  Undo2,
} from "lucide-react";
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
  recentSessions,
  onActivateSession,
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
  onShowGlossary,
}: ToolbarProps) {
  return (
    <header className="flex items-center justify-between gap-4 h-14 px-4 border-b bg-card">
      <TooltipProvider delayDuration={200}>
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
          <Separator orientation="vertical" className="h-6" />
          <h1 className="text-sm font-semibold tracking-tight">FlowScribe</h1>
        </div>

        <div className="flex items-center gap-2">
          <FileUpload
            onAudioUpload={onAudioUpload}
            onTranscriptUpload={onTranscriptUpload}
            audioFileName={audioFileName}
            transcriptFileName={transcriptFileName}
            transcriptLoaded={transcriptLoaded}
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
                recentSessions.slice(0, 8).map((session) => (
                  <DropdownMenuItem
                    key={session.key}
                    onClick={() => onActivateSession(session.key)}
                    className="flex flex-col items-start gap-1"
                  >
                    <span className="text-xs text-muted-foreground">
                      {session.audioName || "Unknown audio"}
                    </span>
                    <span className="text-sm">
                      {session.transcriptName || "Untitled transcript"}
                    </span>
                  </DropdownMenuItem>
                ))
              )}
            </DropdownMenuContent>
          </DropdownMenu>
          <Separator orientation="vertical" className="h-6" />
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
          <Separator orientation="vertical" className="h-6" />
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
          <Separator orientation="vertical" className="h-6" />
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
                      highlightLowConfidence ? "px-2 bg-accent text-accent-foreground" : "px-2"
                    }
                  >
                    <ScanText className="h-4 w-4" aria-hidden="true" />
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
                    className="px-2"
                  >
                    <SpellCheck className="h-4 w-4" aria-hidden="true" />
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
                      {spellcheckerLanguages.length > 0 ? spellcheckerLanguages.join(",") : "none"}
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
                className="px-2"
              >
                <BookOpenText className="h-4 w-4" aria-hidden="true" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Glossary settings</TooltipContent>
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
