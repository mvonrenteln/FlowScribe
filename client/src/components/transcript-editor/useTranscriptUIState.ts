import { useCallback, useState } from "react";

export const useTranscriptUIState = () => {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [showExport, setShowExport] = useState(false);
  const [showLexicon, setShowLexicon] = useState(false);
  const [showSpellcheckDialog, setShowSpellcheckDialog] = useState(false);
  const [showRevisionDialog, setShowRevisionDialog] = useState(false);
  const [showAISegmentMerge, setShowAISegmentMerge] = useState(false);
  const [showAICommandPanel, setShowAICommandPanel] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [confidencePopoverOpen, setConfidencePopoverOpen] = useState(false);
  const [spellcheckPopoverOpen, setSpellcheckPopoverOpen] = useState(false);
  const [editRequestId, setEditRequestId] = useState<string | null>(null);

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
    showSettings,
    setShowSettings,
    confidencePopoverOpen,
    setConfidencePopoverOpen,
    spellcheckPopoverOpen,
    setSpellcheckPopoverOpen,
    editRequestId,
    setEditRequestId,
    handleClearEditRequest,
  };
};

export type TranscriptUIState = ReturnType<typeof useTranscriptUIState>;
