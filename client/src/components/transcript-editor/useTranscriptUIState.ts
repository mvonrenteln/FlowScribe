import { useCallback, useState } from "react";
import type { SettingsSection } from "@/components/settings/SettingsNav";

export interface ChapterEditTarget {
  chapterId: string;
  anchorSegmentId: string;
}

export const useTranscriptUIState = () => {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [showExport, setShowExport] = useState(false);
  const [showLexicon, setShowLexicon] = useState(false);
  const [showSpellcheckDialog, setShowSpellcheckDialog] = useState(false);
  const [showRevisionDialog, setShowRevisionDialog] = useState(false);
  const [showAISegmentMerge, setShowAISegmentMerge] = useState(false);
  const [showAICommandPanel, setShowAICommandPanel] = useState(false);
  const [showChaptersOutline, setShowChaptersOutline] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [settingsInitialSection, setSettingsInitialSection] = useState<SettingsSection | undefined>(
    undefined,
  );
  const [confidencePopoverOpen, setConfidencePopoverOpen] = useState(false);
  const [spellcheckPopoverOpen, setSpellcheckPopoverOpen] = useState(false);
  const [editRequestId, setEditRequestId] = useState<string | null>(null);
  const [chapterEditTarget, setChapterEditTarget] = useState<ChapterEditTarget | null>(null);

  const toggleSidebar = useCallback(() => {
    setSidebarOpen((current) => !current);
  }, []);

  const handleClearEditRequest = useCallback(() => setEditRequestId(null), []);

  return {
    sidebarOpen,
    toggleSidebar,
    showShortcuts,
    setShowShortcuts,
    showExport,
    setShowExport,
    showLexicon,
    setShowLexicon,
    showSpellcheckDialog,
    setShowSpellcheckDialog,
    showRevisionDialog,
    setShowRevisionDialog,
    showAISegmentMerge,
    setShowAISegmentMerge,
    showAICommandPanel,
    setShowAICommandPanel,
    showChaptersOutline,
    setShowChaptersOutline,
    showSettings,
    setShowSettings,
    settingsInitialSection,
    setSettingsInitialSection,
    confidencePopoverOpen,
    setConfidencePopoverOpen,
    spellcheckPopoverOpen,
    setSpellcheckPopoverOpen,
    editRequestId,
    setEditRequestId,
    handleClearEditRequest,
    chapterEditTarget,
    setChapterEditTarget,
  };
};

export type TranscriptUIState = ReturnType<typeof useTranscriptUIState>;
