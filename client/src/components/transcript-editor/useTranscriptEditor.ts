import { useCallback, useEffect, useMemo, useRef } from "react";
import { toast } from "@/hooks/use-toast";
import { type SpellcheckLanguage, useTranscriptStore } from "@/lib/store";
import { getEmptyStateMessage, useFiltersAndLexicon } from "./useFiltersAndLexicon";
import { useSearchAndReplace } from "./useSearchAndReplace";
import { useSegmentSelection } from "./useSegmentSelection";
import { useSpellcheck } from "./useSpellcheck";
import { useTranscriptInitialization } from "./useTranscriptInitialization";
import { useTranscriptPlayback } from "./useTranscriptPlayback";
import { useTranscriptUIState } from "./useTranscriptUIState";

export const useTranscriptEditor = () => {
  const transcriptActions = useMemo(() => {
    const state = useTranscriptStore.getState();
    return {
      setAudioFile: state.setAudioFile,
      setAudioUrl: state.setAudioUrl,
      setAudioReference: state.setAudioReference,
      activateSession: state.activateSession,
      loadTranscript: state.loadTranscript,
      createRevision: state.createRevision,
      deleteSession: state.deleteSession,
      setSelectedSegmentId: state.setSelectedSegmentId,
      mergeSegments: state.mergeSegments,
      toggleSegmentBookmark: state.toggleSegmentBookmark,
      confirmSegment: state.confirmSegment,
      deleteSegment: state.deleteSegment,
      splitSegment: state.splitSegment,
      updateSegmentText: state.updateSegmentText,
      updateSegmentsTexts: state.updateSegmentsTexts,
      updateSegmentSpeaker: state.updateSegmentSpeaker,
      updateSegmentTiming: state.updateSegmentTiming,
      addSpeaker: state.addSpeaker,
      mergeSpeakers: state.mergeSpeakers,
      renameSpeaker: state.renameSpeaker,
      addTag: state.addTag,
      renameTag: state.renameTag,
      removeTag: state.removeTag,
      toggleTagOnSegment: state.toggleTagOnSegment,
      undo: state.undo,
      redo: state.redo,
      canUndo: state.canUndo,
      canRedo: state.canRedo,
      setCurrentTime: state.setCurrentTime,
      setIsPlaying: state.setIsPlaying,
      setDuration: state.setDuration,
      requestSeek: state.requestSeek,
      clearSeekRequest: state.clearSeekRequest,
      addLexiconFalsePositive: state.addLexiconFalsePositive,
      addLexiconEntry: state.addLexiconEntry,
      addSpellcheckIgnoreWord: state.addSpellcheckIgnoreWord,
      setSpellcheckEnabled: state.setSpellcheckEnabled,
      setSpellcheckLanguages: state.setSpellcheckLanguages,
      setSpellcheckCustomEnabled: state.setSpellcheckCustomEnabled,
      loadSpellcheckCustomDictionaries: state.loadSpellcheckCustomDictionaries,
    };
  }, []);

  const audioFile = useTranscriptStore((state) => state.audioFile);
  const audioUrl = useTranscriptStore((state) => state.audioUrl);
  const transcriptRef = useTranscriptStore((state) => state.transcriptRef);
  const sessionKey = useTranscriptStore((state) => state.sessionKey);
  const sessionKind = useTranscriptStore((state) => state.sessionKind);
  const sessionLabel = useTranscriptStore((state) => state.sessionLabel);
  const recentSessions = useTranscriptStore((state) => state.recentSessions);
  const isWhisperXFormat = useTranscriptStore((state) => state.isWhisperXFormat);
  const selectedSegmentId = useTranscriptStore((state) => state.selectedSegmentId);
  const segments = useTranscriptStore((state) => state.segments);
  const speakers = useTranscriptStore((state) => state.speakers);
  const tags = useTranscriptStore((state) => state.tags);
  const currentTime = useTranscriptStore((state) => state.currentTime);
  const isPlaying = useTranscriptStore((state) => state.isPlaying);
  const duration = useTranscriptStore((state) => state.duration);
  const lexiconEntries = useTranscriptStore((state) => state.lexiconEntries);
  const lexiconThreshold = useTranscriptStore((state) => state.lexiconThreshold);
  const lexiconHighlightUnderline = useTranscriptStore((state) => state.lexiconHighlightUnderline);
  const lexiconHighlightBackground = useTranscriptStore(
    (state) => state.lexiconHighlightBackground,
  );
  const setLexiconHighlightUnderline = useTranscriptStore(
    (state) => state.setLexiconHighlightUnderline,
  );
  const spellcheckEnabled = useTranscriptStore((state) => state.spellcheckEnabled);
  const spellcheckLanguages = useTranscriptStore((state) => state.spellcheckLanguages);
  const spellcheckIgnoreWords = useTranscriptStore((state) => state.spellcheckIgnoreWords);
  const spellcheckCustomDictionaries = useTranscriptStore(
    (state) => state.spellcheckCustomDictionaries,
  );
  const spellcheckCustomEnabled = useTranscriptStore((state) => state.spellcheckCustomEnabled);
  const highlightLowConfidence = useTranscriptStore((state) => state.highlightLowConfidence);
  const manualConfidenceThreshold = useTranscriptStore((state) => state.manualConfidenceThreshold);
  const setHighlightLowConfidence = useTranscriptStore((state) => state.setHighlightLowConfidence);
  const setManualConfidenceThreshold = useTranscriptStore(
    (state) => state.setManualConfidenceThreshold,
  );
  const toggleHighlightLowConfidence = useTranscriptStore(
    (state) => state.toggleHighlightLowConfidence,
  );

  const {
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
    settingsInitialSection,
    setSettingsInitialSection,
    confidencePopoverOpen,
    setConfidencePopoverOpen,
    spellcheckPopoverOpen,
    setSpellcheckPopoverOpen,
    editRequestId,
    setEditRequestId,
    handleClearEditRequest,
  } = useTranscriptUIState();

  const {
    setAudioFile,
    setAudioUrl,
    setAudioReference,
    activateSession,
    loadTranscript,
    mergeSegments,
    setSelectedSegmentId,
    toggleSegmentBookmark,
    confirmSegment,
    deleteSegment,
    splitSegment,
    updateSegmentText,
    updateSegmentsTexts,
    updateSegmentSpeaker,
    updateSegmentTiming,
    addSpeaker,
    mergeSpeakers,
    renameSpeaker,
    addTag,
    renameTag,
    removeTag,
    toggleTagOnSegment,
    undo,
    redo,
    canUndo,
    canRedo,
    createRevision,
    setCurrentTime,
    setIsPlaying,
    setDuration,
    requestSeek,
    clearSeekRequest,
    loadSpellcheckCustomDictionaries,
    addSpellcheckIgnoreWord,
    addLexiconFalsePositive,
    addLexiconEntry,
    setSpellcheckEnabled,
    setSpellcheckLanguages,
    setSpellcheckCustomEnabled,
  } = transcriptActions;

  const { handleAudioUpload, handleTranscriptUpload, handleWaveReady, isWaveReady } =
    useTranscriptInitialization({
      audioFile,
      audioUrl,
      setAudioFile,
      setAudioUrl,
      setAudioReference,
      loadTranscript,
    });

  const canUndoChecked = canUndo();
  const canRedoChecked = canRedo();
  const canCreateRevision = segments.length > 0;
  const waveSegmentsRef = useRef<typeof segments>(segments);

  const waveformSegments = useMemo(() => {
    const prev = waveSegmentsRef.current;

    // Fast path: Check if length or IDs changed
    if (segments.length !== prev.length) {
      waveSegmentsRef.current = segments;
      return segments;
    }

    // Check if any waveform-relevant property changed
    let hasWaveformChange = false;
    for (let i = 0; i < segments.length; i += 1) {
      const seg = segments[i];
      const prevSeg = prev[i];
      if (
        !prevSeg ||
        seg.id !== prevSeg.id ||
        seg.start !== prevSeg.start ||
        seg.end !== prevSeg.end ||
        seg.speaker !== prevSeg.speaker
      ) {
        hasWaveformChange = true;
        break;
      }
    }

    // If no waveform-relevant changes, return previous array to prevent re-render
    if (!hasWaveformChange) {
      return prev;
    }

    // Something changed, update the ref and return new segments
    waveSegmentsRef.current = segments;
    return segments;
  }, [segments]);

  const isTranscriptEditing = useCallback(
    () => document.body?.dataset.transcriptEditing === "true",
    [],
  );

  const {
    effectiveSpellcheckLanguages,
    spellcheckDebugEnabled,
    spellcheckers,
    spellcheckMatchesBySegment,
    spellcheckMatchCount,
    spellcheckMatchLimitReached,
  } = useSpellcheck({
    audioUrl,
    isWaveReady,
    spellcheckEnabled,
    spellcheckLanguages,
    spellcheckCustomEnabled,
    spellcheckCustomDictionaries,
    loadSpellcheckCustomDictionaries,
    segments,
    spellcheckIgnoreWords,
    lexiconEntries,
  });

  const {
    filterSpeakerId,
    setFilterSpeakerId,
    filterLowConfidence,
    setFilterLowConfidence,
    filterBookmarked,
    setFilterBookmarked,
    filterLexicon,
    setFilterLexicon,
    filterLexiconLowScore,
    setFilterLexiconLowScore,
    filterSpellcheck,
    setFilterSpellcheck,
    filterTagIds,
    setFilterTagIds,
    filterNotTagIds,
    setFilterNotTagIds,
    filterNoTags,
    setFilterNoTags,
    activeSpeakerName,
    lowConfidenceThreshold,
    lexiconMatchesBySegment,
    lexiconMatchCount,
    lexiconLowScoreMatchCount,
    showLexiconMatches,
    showSpellcheckMatches,
    effectiveLexiconHighlightUnderline,
    effectiveLexiconHighlightBackground,
    filteredSegments,
    clearFilters,
    searchQuery,
    setSearchQuery,
    isRegexSearch,
    setIsRegexSearch,
  } = useFiltersAndLexicon({
    segments,
    speakers,
    lexiconEntries,
    lexiconThreshold,
    lexiconHighlightUnderline,
    lexiconHighlightBackground,
    spellcheckEnabled,
    spellcheckMatchesBySegment,
    highlightLowConfidence,
    manualConfidenceThreshold,
    setHighlightLowConfidence,
    setManualConfidenceThreshold,
  });

  // Tag select handler - optimized for performance
  const handleTagSelect = useCallback(
    (tagId: string) => {
      // Three-state toggle: none → normal → NOT → none
      const isNormal = filterTagIds.includes(tagId);
      const isNot = filterNotTagIds.includes(tagId);

      if (!isNormal && !isNot) {
        // State: none → normal
        setFilterTagIds((current) => [...current, tagId]);
      } else if (isNormal) {
        // State: normal → NOT
        // Batch both state updates
        setFilterTagIds((current) => current.filter((id) => id !== tagId));
        setFilterNotTagIds((current) => [...current, tagId]);
      } else {
        // State: NOT → none
        setFilterNotTagIds((current) => current.filter((id) => id !== tagId));
      }
    },
    [filterTagIds, filterNotTagIds, setFilterTagIds, setFilterNotTagIds],
  );

  const {
    replaceQuery,
    setReplaceQuery,
    currentMatchIndex,
    totalMatches,
    currentMatch,
    goToNextMatch,
    goToPrevMatch,
    replaceAll,
    replaceCurrent,
    onMatchClick,
    findMatchIndex,
    allMatches,
  } = useSearchAndReplace(segments, updateSegmentsTexts, searchQuery, isRegexSearch);

  useEffect(() => {
    if (currentMatch) {
      setSelectedSegmentId(currentMatch.segmentId);
    }
  }, [currentMatch, setSelectedSegmentId]);

  const handleRenameSpeaker = useCallback(
    (oldName: string, newName: string) => {
      renameSpeaker(oldName, newName);
    },
    [renameSpeaker],
  );

  const {
    transcriptListRef,
    activeSegmentId,
    activeWordIndex,
    splitWordIndex,
    canSplitAtCurrentWord,
    handleSplitAtCurrentWord,
    segmentHandlers,
    selectPreviousSegment,
    selectNextSegment,
  } = useSegmentSelection({
    segments,
    filteredSegments,
    currentTime,
    isPlaying,
    selectedSegmentId,
    setSelectedSegmentId,
    setCurrentTime,
    setIsPlaying,
    requestSeek,
    clearSeekRequest,
    splitSegment,
    confirmSegment,
    toggleSegmentBookmark,
    deleteSegment,
    updateSegmentText,
    updateSegmentSpeaker,
    mergeSegments,
    addLexiconFalsePositive,
    filterLowConfidence,
    activeSpeakerName,
    lowConfidenceThreshold,
    isTranscriptEditing,
  });

  // AI Revision: Get store functions
  const startSingleRevision = useTranscriptStore((state) => state.startSingleRevision);
  const aiRevisionConfig = useTranscriptStore((state) => state.aiRevisionConfig);

  const handleRunDefaultAIRevision = useCallback(() => {
    if (!selectedSegmentId) return;
    const defaultPromptId = aiRevisionConfig.defaultPromptId;
    if (!defaultPromptId) {
      toast({
        title: "No default prompt",
        description: "Please set a default AI revision prompt in Settings.",
        variant: "destructive",
      });
      return;
    }
    startSingleRevision(selectedSegmentId, defaultPromptId);
  }, [aiRevisionConfig.defaultPromptId, selectedSegmentId, startSingleRevision]);

  const handleOpenAIRevisionMenu = useCallback(() => {
    if (!selectedSegmentId) return;
    const segmentEl = document.querySelector(`[data-segment-id="${selectedSegmentId}"]`);
    if (segmentEl) {
      const aiButton = segmentEl.querySelector('[aria-label*="AI"]') as HTMLButtonElement;
      if (aiButton) {
        aiButton.click();
      }
    }
  }, [selectedSegmentId]);

  const playback = useTranscriptPlayback({
    isTranscriptEditing,
    isPlaying,
    currentTime,
    duration,
    filteredSegments,
    selectedSegmentId,
    segments,
    speakers,
    tags,
    canUndo,
    canRedo,
    undo,
    redo,
    handleSplitAtCurrentWord,
    canSplitAtCurrentWord,
    selectPreviousSegment,
    selectNextSegment,
    mergeSegments,
    toggleSegmentBookmark,
    confirmSegment,
    deleteSegment,
    updateSegmentSpeaker,
    toggleTagOnSegment,
    setSelectedSegmentId,
    setCurrentTime,
    setIsPlaying,
    requestSeek,
    onShowExport: () => setShowExport(true),
    onShowShortcuts: () => setShowShortcuts(true),
    onShowSettings: () => setShowSettings(true),
    onShowGlossary: () => setLexiconHighlightUnderline(!lexiconHighlightUnderline),
    onRunDefaultAIRevision: handleRunDefaultAIRevision,
    onOpenAIRevisionMenu: handleOpenAIRevisionMenu,
    onOpenAISegmentMerge: () => setShowAISegmentMerge(true),
    setEditRequestId,
    onClearSpeakerFilter: () => setFilterSpeakerId(undefined),
    hasAudioSource: Boolean(audioUrl),
  });

  const handleCreateRevision = useCallback(
    (name: string, overwrite?: boolean) => {
      const createdKey = createRevision(name, overwrite);
      if (createdKey) {
        toast({
          title: "Revision saved",
          description: `“${name.trim()}” is now listed in Recent sessions.`,
        });
        setShowRevisionDialog(false);
      }
      return createdKey;
    },
    [createRevision, setShowRevisionDialog],
  );

  const activeSessionDisplayName =
    sessionLabel ?? transcriptRef?.name ?? audioFile?.name ?? "Current session";

  const emptyState = useMemo(
    () =>
      getEmptyStateMessage({
        segments,
        filterSpellcheck,
        filterLowConfidence,
        activeSpeakerName,
      }),
    [activeSpeakerName, filterLowConfidence, filterSpellcheck, segments],
  );

  const waveformProps = useMemo(
    () => ({
      audioUrl,
      segments: waveformSegments,
      speakers,
      currentTime,
      isPlaying,
      playbackRate: playback.playbackRate,
      showSpeakerRegions: isWhisperXFormat,
      onTimeUpdate: setCurrentTime,
      onPlayPause: setIsPlaying,
      onDurationChange: setDuration,
      onSeek: playback.handleWaveformSeek,
      onSegmentBoundaryChange: updateSegmentTiming,
      onReady: handleWaveReady,
    }),
    [
      audioUrl,
      currentTime,
      handleWaveReady,
      isPlaying,
      isWhisperXFormat,
      playback.playbackRate,
      playback.handleWaveformSeek,
      waveformSegments,
      setCurrentTime,
      setDuration,
      setIsPlaying,
      speakers,
      updateSegmentTiming,
    ],
  );

  const toolbarProps = useMemo(
    () => ({
      sidebarOpen,
      onToggleSidebar: toggleSidebar,
      onAudioUpload: handleAudioUpload,
      onTranscriptUpload: handleTranscriptUpload,
      audioFileName: audioFile?.name,
      transcriptFileName: transcriptRef?.name,
      transcriptLoaded: segments.length > 0,
      sessionKind,
      sessionLabel,
      activeSessionKey: sessionKey,
      recentSessions,
      onActivateSession: activateSession,
      onDeleteSession: transcriptActions.deleteSession,
      onShowRevisionDialog: () => setShowRevisionDialog(true),
      canCreateRevision,
      onUndo: undo,
      onRedo: redo,
      canUndo: canUndoChecked,
      canRedo: canRedoChecked,
      onShowShortcuts: () => setShowShortcuts(true),
      onShowExport: () => setShowExport(true),
      aiCommandPanelOpen: showAICommandPanel,
      onToggleAICommandPanel: () => setShowAICommandPanel((current) => !current),
      highlightLowConfidence,
      onToggleHighlightLowConfidence: toggleHighlightLowConfidence,
      confidencePopoverOpen,
      onConfidencePopoverChange: setConfidencePopoverOpen,
      lowConfidenceThreshold,
      onManualConfidenceChange: (value: number) => {
        setManualConfidenceThreshold(value);
        setHighlightLowConfidence(true);
      },
      onResetConfidenceThreshold: () => setManualConfidenceThreshold(null),
      spellcheckPopoverOpen,
      onSpellcheckPopoverChange: setSpellcheckPopoverOpen,
      spellcheckEnabled,
      onToggleSpellcheck: () => setSpellcheckEnabled(!spellcheckEnabled),
      spellcheckLanguages,
      onSpellcheckLanguageChange: (languages: SpellcheckLanguage[]) =>
        setSpellcheckLanguages(languages),
      spellcheckCustomEnabled,
      onToggleSpellcheckCustom: () => setSpellcheckCustomEnabled(!spellcheckCustomEnabled),
      onShowCustomDictionaries: () => setShowSettings(true),
      spellcheckCustomDictionariesCount: spellcheckCustomDictionaries.length,
      onShowSpellcheckDialog: () => setShowSpellcheckDialog(true),
      spellcheckDebugEnabled,
      effectiveSpellcheckLanguages,
      spellcheckerLanguages: spellcheckers.map((checker) => checker.language),
      spellcheckHighlightActive: showSpellcheckMatches,
      glossaryHighlightActive: showLexiconMatches,
      onShowGlossary: () => setLexiconHighlightUnderline(!lexiconHighlightUnderline),
    }),
    [
      sidebarOpen,
      activateSession,
      audioFile?.name,
      canRedoChecked,
      canUndoChecked,
      effectiveSpellcheckLanguages,
      handleAudioUpload,
      handleTranscriptUpload,
      highlightLowConfidence,
      lowConfidenceThreshold,
      recentSessions,
      redo,
      segments.length,
      setHighlightLowConfidence,
      setManualConfidenceThreshold,
      setSpellcheckCustomEnabled,
      setSpellcheckEnabled,
      setSpellcheckLanguages,
      spellcheckCustomDictionaries.length,
      spellcheckCustomEnabled,
      spellcheckDebugEnabled,
      spellcheckEnabled,
      spellcheckLanguages,
      spellcheckers,
      transcriptRef?.name,
      undo,
      toggleSidebar,
      setShowRevisionDialog,
      setShowShortcuts,
      setShowExport,
      confidencePopoverOpen,
      setConfidencePopoverOpen,
      spellcheckPopoverOpen,
      setSpellcheckPopoverOpen,
      setShowSettings,
      setShowSpellcheckDialog,
      showAICommandPanel,
      setShowAICommandPanel,
      showLexiconMatches,
      showSpellcheckMatches,
      sessionKey,
      sessionKind,
      sessionLabel,
      canCreateRevision,
      transcriptActions.deleteSession,
      toggleHighlightLowConfidence,
      lexiconHighlightUnderline,
      setLexiconHighlightUnderline,
    ],
  );

  const filterPanelProps = useMemo(
    () => ({
      speakers,
      segments,
      tags,
      onRenameSpeaker: handleRenameSpeaker,
      onAddSpeaker: addSpeaker,
      onMergeSpeakers: mergeSpeakers,
      selectedSpeakerId: filterSpeakerId,
      onSpeakerSelect: (id: string) =>
        setFilterSpeakerId((current) => (current === id ? undefined : id)),
      onAddTag: addTag,
      onRenameTag: renameTag,
      onDeleteTag: removeTag,
      selectedTagIds: filterTagIds,
      selectedNotTagIds: filterNotTagIds,
      onTagSelect: handleTagSelect,
      noTagsFilterActive: filterNoTags,
      onToggleNoTagsFilter: () => setFilterNoTags((current) => !current),
      onClearFilters: clearFilters,
      lowConfidenceFilterActive: filterLowConfidence,
      onToggleLowConfidenceFilter: () => setFilterLowConfidence((current) => !current),
      lowConfidenceThreshold,
      onLowConfidenceThresholdChange: (value: number | null) => {
        setManualConfidenceThreshold(value);
        if (value !== null) {
          setHighlightLowConfidence(true);
        }
      },
      bookmarkFilterActive: filterBookmarked,
      onToggleBookmarkFilter: () => setFilterBookmarked((current) => !current),
      lexiconFilterActive: filterLexicon,
      onToggleLexiconFilter: () => setFilterLexicon((current) => !current),
      lexiconMatchCount,
      lexiconLowScoreMatchCount,
      lexiconLowScoreFilterActive: filterLexiconLowScore,
      onToggleLexiconLowScoreFilter: () => setFilterLexiconLowScore((current) => !current),
      spellcheckMatchCount,
      spellcheckFilterActive: filterSpellcheck,
      onToggleSpellcheckFilter: () => setFilterSpellcheck((current) => !current),
      spellcheckEnabled,
      spellcheckMatchLimitReached,
      searchQuery,
      onSearchQueryChange: setSearchQuery,
      isRegexSearch,
      onToggleRegexSearch: () => setIsRegexSearch((current) => !current),
      replaceQuery,
      onReplaceQueryChange: setReplaceQuery,
      currentMatchIndex,
      totalMatches,
      goToNextMatch,
      goToPrevMatch,
      onReplaceCurrent: replaceCurrent,
      onReplaceAll: replaceAll,
    }),
    [
      addSpeaker,
      addTag,
      renameTag,
      removeTag,
      clearFilters,
      filterBookmarked,
      filterLexicon,
      filterLexiconLowScore,
      filterLowConfidence,
      filterSpeakerId,
      filterSpellcheck,
      filterTagIds,
      filterNotTagIds,
      filterNoTags,
      handleRenameSpeaker,
      handleTagSelect,
      lexiconLowScoreMatchCount,
      lexiconMatchCount,
      lowConfidenceThreshold,
      mergeSpeakers,
      segments,
      setFilterBookmarked,
      setFilterLexicon,
      setFilterLexiconLowScore,
      setFilterLowConfidence,
      setFilterSpeakerId,
      setFilterSpellcheck,
      setFilterNoTags,
      setHighlightLowConfidence,
      setManualConfidenceThreshold,
      spellcheckEnabled,
      spellcheckMatchCount,
      spellcheckMatchLimitReached,
      speakers,
      tags,
      searchQuery,
      setSearchQuery,
      isRegexSearch,
      setIsRegexSearch,
      replaceQuery,
      setReplaceQuery,
      currentMatchIndex,
      totalMatches,
      goToNextMatch,
      goToPrevMatch,
      replaceCurrent,
      replaceAll,
    ],
  );

  const transcriptListProps = useMemo(
    () => ({
      containerRef: transcriptListRef,
      filteredSegments,
      speakers,
      activeSegmentId,
      selectedSegmentId,
      activeWordIndex,
      splitWordIndex,
      showLexiconMatches,
      lexiconHighlightUnderline: effectiveLexiconHighlightUnderline,
      lexiconHighlightBackground: effectiveLexiconHighlightBackground,
      lexiconMatchesBySegment,
      showSpellcheckMatches,
      spellcheckMatchesBySegment,
      highlightLowConfidence,
      lowConfidenceThreshold,
      editRequestId,
      onClearEditRequest: handleClearEditRequest,
      segmentHandlers,
      onSeek: playback.handleSeekInternal,
      onIgnoreSpellcheckMatch: addSpellcheckIgnoreWord,
      onAddSpellcheckToGlossary: addLexiconEntry,
      emptyState,
      searchQuery,
      isRegexSearch,
      currentMatch,
      replaceQuery,
      onReplaceCurrent: replaceCurrent,
      onMatchClick,
      findMatchIndex,
      allMatches,
    }),
    [
      activeSegmentId,
      activeWordIndex,
      addLexiconEntry,
      addSpellcheckIgnoreWord,
      effectiveLexiconHighlightBackground,
      effectiveLexiconHighlightUnderline,
      emptyState,
      filteredSegments,
      highlightLowConfidence,
      lexiconMatchesBySegment,
      lowConfidenceThreshold,
      selectedSegmentId,
      segmentHandlers,
      showLexiconMatches,
      showSpellcheckMatches,
      speakers,
      spellcheckMatchesBySegment,
      splitWordIndex,
      transcriptListRef,
      playback.handleSeekInternal,
      searchQuery,
      isRegexSearch,
      currentMatch,
      replaceQuery,
      replaceCurrent,
      onMatchClick,
      findMatchIndex,
      allMatches,
      editRequestId,
      handleClearEditRequest,
    ],
  );

  // Separate export dialog props to avoid re-renders when segments/tags change
  const exportDialogData = useMemo(
    () => ({
      segments,
      filteredSegments,
      tags,
      audioFileName: audioFile?.name,
    }),
    [segments, filteredSegments, tags, audioFile?.name],
  );

  const dialogProps = useMemo(
    () => ({
      showShortcuts,
      onShortcutsChange: setShowShortcuts,
      showExport,
      onExportChange: setShowExport,
      ...exportDialogData,
      showLexicon,
      onLexiconChange: setShowLexicon,
      showSpellcheckDialog,
      onSpellcheckDialogChange: setShowSpellcheckDialog,
      showRevisionDialog,
      onRevisionDialogChange: setShowRevisionDialog,
      onCreateRevision: handleCreateRevision,
      canCreateRevision,
      activeSessionName: activeSessionDisplayName,
      activeSessionKind: sessionKind,
      existingRevisionNames: recentSessions
        .filter(
          (s) =>
            s.kind === "revision" &&
            (s.baseSessionKey === sessionKey ||
              s.key === sessionKey ||
              s.baseSessionKey === useTranscriptStore.getState().baseSessionKey),
        )
        .map((s) => s.label)
        .filter((l): l is string => l !== null),
      defaultRevisionName:
        sessionKind === "revision"
          ? (sessionLabel ?? undefined)
          : (recentSessions
              .filter((s) => s.kind === "revision" && s.baseSessionKey === sessionKey)
              .sort((a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0))[0]?.label ?? undefined),
      showAISegmentMerge,
      onAISegmentMergeChange: setShowAISegmentMerge,
      showSettings,
      onSettingsChange: setShowSettings,
      onOpenSettings: () => setShowSettings(true),
      settingsInitialSection,
      setSettingsInitialSection,
    }),
    [
      activeSessionDisplayName,
      canCreateRevision,
      exportDialogData,
      handleCreateRevision,
      sessionKind,
      recentSessions,
      sessionKey,
      sessionLabel,
      showShortcuts,
      showExport,
      showLexicon,
      showSpellcheckDialog,
      showRevisionDialog,
      showAISegmentMerge,
      showSettings,
      setShowShortcuts,
      setShowExport,
      setShowLexicon,
      setShowSpellcheckDialog,
      setShowRevisionDialog,
      setShowAISegmentMerge,
      setShowSettings,
      settingsInitialSection,
      setSettingsInitialSection,
    ],
  );

  const aiCommandPanelProps = useMemo(
    () => ({
      open: showAICommandPanel,
      onOpenChange: setShowAICommandPanel,
      filteredSegmentIds: filteredSegments.map((segment) => segment.id),
      onOpenSettings: () => setShowSettings(true),
    }),
    [filteredSegments, setShowAICommandPanel, setShowSettings, showAICommandPanel],
  );

  return {
    sidebarOpen,
    toolbarProps,
    filterPanelProps,
    playbackPaneProps: {
      waveformProps,
      playbackControlsProps: playback.playbackControlsProps,
    },
    transcriptListProps,
    dialogProps,
    aiCommandPanelProps,
  };
};

export type TranscriptEditorState = ReturnType<typeof useTranscriptEditor>;
