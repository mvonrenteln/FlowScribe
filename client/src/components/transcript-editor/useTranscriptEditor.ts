import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "@/hooks/use-toast";
import { loadAudioHandle, queryAudioHandlePermission } from "@/lib/audioHandleStorage";
import { buildFileReference, type FileReference } from "@/lib/fileReference";
import { type Segment, type SpellcheckLanguage, useTranscriptStore } from "@/lib/store";
import { parseTranscriptData } from "@/lib/transcriptParsing";
import { getEmptyStateMessage, useFiltersAndLexicon } from "./useFiltersAndLexicon";
import { useNavigationHotkeys } from "./useNavigationHotkeys";
import { useScrollAndSelection } from "./useScrollAndSelection";
import { useSearchAndReplace } from "./useSearchAndReplace";
import { useSpellcheck } from "./useSpellcheck";

// buildSegmentHandlers is moved inside useTranscriptEditor as a stable set of callbacks

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
      updateSegmentsTexts: state.updateSegmentsTexts, // Added this action
      updateSegmentSpeaker: state.updateSegmentSpeaker,
      updateSegmentTiming: state.updateSegmentTiming,
      addSpeaker: state.addSpeaker,
      mergeSpeakers: state.mergeSpeakers,
      renameSpeaker: state.renameSpeaker,
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
  const currentTime = useTranscriptStore((state) => state.currentTime);
  const isPlaying = useTranscriptStore((state) => state.isPlaying);
  const duration = useTranscriptStore((state) => state.duration);
  const lexiconEntries = useTranscriptStore((state) => state.lexiconEntries);
  const lexiconThreshold = useTranscriptStore((state) => state.lexiconThreshold);
  const lexiconHighlightUnderline = useTranscriptStore((state) => state.lexiconHighlightUnderline);
  const lexiconHighlightBackground = useTranscriptStore(
    (state) => state.lexiconHighlightBackground,
  );
  const spellcheckEnabled = useTranscriptStore((state) => state.spellcheckEnabled);
  const spellcheckLanguages = useTranscriptStore((state) => state.spellcheckLanguages);
  const spellcheckIgnoreWords = useTranscriptStore((state) => state.spellcheckIgnoreWords);
  const spellcheckCustomDictionaries = useTranscriptStore(
    (state) => state.spellcheckCustomDictionaries,
  );
  const spellcheckCustomEnabled = useTranscriptStore((state) => state.spellcheckCustomEnabled);
  const { setAudioFile, setAudioUrl, setAudioReference, activateSession, loadTranscript } =
    transcriptActions;
  const {
    mergeSegments,
    setSelectedSegmentId,
    toggleSegmentBookmark,
    confirmSegment,
    deleteSegment,
    splitSegment,
    updateSegmentText,
    updateSegmentsTexts, // Destructured the new action
    updateSegmentSpeaker,
    updateSegmentTiming,
    addSpeaker,
    mergeSpeakers,
    renameSpeaker,
    undo,
    redo,
    canUndo,
    canRedo,
    createRevision,
  } = transcriptActions;
  const { setCurrentTime, setIsPlaying, setDuration, requestSeek, clearSeekRequest } =
    transcriptActions;
  const {
    loadSpellcheckCustomDictionaries,
    addSpellcheckIgnoreWord,
    addLexiconFalsePositive,
    addLexiconEntry,
    setSpellcheckEnabled,
    setSpellcheckLanguages,
    setSpellcheckCustomEnabled,
  } = transcriptActions;

  const [showShortcuts, setShowShortcuts] = useState(false);
  const [showExport, setShowExport] = useState(false);
  const [showLexicon, setShowLexicon] = useState(false);
  const [showSpellcheckDialog, setShowSpellcheckDialog] = useState(false);
  const [showCustomDictionariesDialog, setShowCustomDictionariesDialog] = useState(false);
  const [showRevisionDialog, setShowRevisionDialog] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [confidencePopoverOpen, setConfidencePopoverOpen] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [editRequestId, setEditRequestId] = useState<string | null>(null);
  const [spellcheckPopoverOpen, setSpellcheckPopoverOpen] = useState(false);
  const restoreAttemptedRef = useRef(false);
  const [isWaveReady, setIsWaveReady] = useState(!audioUrl);
  const canUndoChecked = canUndo();
  const canRedoChecked = canRedo();
  const canCreateRevision = segments.length > 0;

  const isTranscriptEditing = useCallback(
    () => document.body?.dataset.transcriptEditing === "true",
    [],
  );

  const handleAudioUpload = useCallback(
    (file: File) => {
      setAudioFile(file);
      const url = URL.createObjectURL(file);
      setAudioUrl(url);
      setAudioReference(buildFileReference(file));
    },
    [setAudioFile, setAudioReference, setAudioUrl],
  );

  const handleTranscriptUpload = useCallback(
    (data: unknown, reference?: FileReference | null) => {
      const parsed = parseTranscriptData(data);
      if (!parsed) {
        console.error("Unknown transcript format. Expected Whisper or WhisperX format.");
        return;
      }

      loadTranscript({
        segments: parsed.segments,
        isWhisperXFormat: parsed.isWhisperXFormat,
        reference: reference ?? null,
      });
    },
    [loadTranscript],
  );

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
    [createRevision],
  );

  useEffect(() => {
    if (restoreAttemptedRef.current || audioFile) return;
    restoreAttemptedRef.current = true;
    let isMounted = true;

    loadAudioHandle()
      .then(async (handle) => {
        if (!handle || !isMounted) return;
        const granted = await queryAudioHandlePermission(handle);
        if (!granted || !isMounted) return;
        const file = await handle.getFile();
        if (isMounted) {
          handleAudioUpload(file);
        }
      })
      .catch((err) => {
        console.error("Failed to restore audio handle:", err);
      });

    return () => {
      isMounted = false;
    };
  }, [audioFile, handleAudioUpload]);

  useEffect(() => {
    setIsWaveReady(!audioUrl);
  }, [audioUrl]);

  const handleWaveReady = useCallback(() => {
    setIsWaveReady(true);
  }, []);

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
    highlightLowConfidence,
    setHighlightLowConfidence,
    setManualConfidenceThreshold,
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
  });

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

  // Sync selection and scroll to current match
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

  const handlePlayPause = useCallback(() => {
    setIsPlaying(!isPlaying);
  }, [isPlaying, setIsPlaying]);

  const handleSeek = useCallback(
    (time: number) => {
      setCurrentTime(time);
      requestSeek(time);
    },
    [requestSeek, setCurrentTime],
  );

  const handleSkipBack = useCallback(() => {
    requestSeek(Math.max(0, currentTime - 5));
  }, [currentTime, requestSeek]);

  const handleSkipForward = useCallback(() => {
    requestSeek(Math.min(duration, currentTime + 5));
  }, [currentTime, duration, requestSeek]);

  const getSelectedSegmentIndex = useCallback(() => {
    return filteredSegments.findIndex((s) => s.id === selectedSegmentId);
  }, [filteredSegments, selectedSegmentId]);

  const selectPreviousSegment = useCallback(() => {
    const currentIndex = getSelectedSegmentIndex();
    if (currentIndex > 0) {
      const segment = filteredSegments[currentIndex - 1];
      setSelectedSegmentId(segment.id);
      handleSeek(segment.start);
    } else if (currentIndex === -1 && filteredSegments.length > 0) {
      const segment = filteredSegments[filteredSegments.length - 1];
      setSelectedSegmentId(segment.id);
      handleSeek(segment.start);
    }
  }, [getSelectedSegmentIndex, filteredSegments, setSelectedSegmentId, handleSeek]);

  const selectNextSegment = useCallback(() => {
    const currentIndex = getSelectedSegmentIndex();
    if (currentIndex < filteredSegments.length - 1) {
      const segment = filteredSegments[currentIndex + 1];
      setSelectedSegmentId(segment.id);
      handleSeek(segment.start);
    } else if (currentIndex === -1 && filteredSegments.length > 0) {
      const segment = filteredSegments[0];
      setSelectedSegmentId(segment.id);
      handleSeek(segment.start);
    }
  }, [getSelectedSegmentIndex, filteredSegments, setSelectedSegmentId, handleSeek]);

  const { transcriptListRef, activeSegment } = useScrollAndSelection({
    segments,
    currentTime,
    selectedSegmentId,
    isPlaying,
    isTranscriptEditing,
    activeSpeakerName,
    filteredSegments,
    restrictPlaybackToFiltered: filterLowConfidence,
    lowConfidenceThreshold,
    setSelectedSegmentId,
    requestSeek,
    setIsPlaying,
  });

  const getSplitWordIndex = useCallback(() => {
    if (!activeSegment) return null;
    const { words } = activeSegment;
    if (words.length < 2) return null;
    let index = words.findIndex((word) => currentTime >= word.start && currentTime <= word.end);
    if (index === -1) {
      index = words.findIndex((word) => currentTime < word.start);
      if (index === -1) {
        index = words.length - 1;
      }
    }
    if (index <= 0) {
      return words.length > 1 ? 1 : null;
    }
    if (index >= words.length) return null;
    return index;
  }, [activeSegment, currentTime]);

  const handleSplitSegment = useCallback(
    (segmentId: string, wordIndex: number) => {
      const wasPlaying = isPlaying;
      const resumeTime = currentTime;
      splitSegment(segmentId, wordIndex);
      if (wasPlaying) {
        setCurrentTime(resumeTime);
        clearSeekRequest();
      }
    },
    [clearSeekRequest, currentTime, isPlaying, setCurrentTime, splitSegment],
  );

  const handleSplitAtCurrentWord = useCallback(() => {
    const index = getSplitWordIndex();
    if (index === null || !activeSegment) return;
    handleSplitSegment(activeSegment.id, index);
  }, [activeSegment, getSplitWordIndex, handleSplitSegment]);

  const splitWordIndex = getSplitWordIndex();
  const canSplitAtCurrentWord = splitWordIndex !== null;

  useNavigationHotkeys({
    isTranscriptEditing,
    handleSkipBack,
    handleSkipForward,
    handleSeek,
    duration,
    currentTime,
    handlePlayPause,
    setSelectedSegmentId,
    clearSpeakerFilter: () => setFilterSpeakerId(undefined),
    selectedSegmentId,
    segments,
    speakers,
    updateSegmentSpeaker,
    getSelectedSegmentIndex,
    mergeSegments,
    toggleSegmentBookmark,
    confirmSegment,
    deleteSegment,
    setEditRequestId: (id) => setEditRequestId(id),
    requestSeek,
    setIsPlaying,
    handleSplitAtCurrentWord,
    canUndo,
    canRedo,
    undo,
    redo,
    selectPreviousSegment,
    selectNextSegment,
    onShowExport: () => setShowExport(true),
    onShowShortcuts: () => setShowShortcuts(true),
  });

  const handleClearEditRequest = useCallback(() => setEditRequestId(null), [setEditRequestId]);
  const activeSegmentId = activeSegment?.id ?? null;
  const activeWordIndex = useMemo(() => {
    if (!activeSegment) return -1;
    return activeSegment.words.findIndex((w) => currentTime >= w.start && currentTime <= w.end);
  }, [activeSegment, currentTime]);

  const handlerCacheRef = useRef<Map<string, any>>(new Map());

  const segmentHandlers = useMemo(() => {
    // Clear cache entries for segments that are no longer in segments (optional but good)
    const currentIds = new Set(segments.map((s) => s.id));
    for (const id of Array.from(handlerCacheRef.current.keys())) {
      if (!currentIds.has(id)) {
        handlerCacheRef.current.delete(id);
      }
    }

    const segmentIndexById = new Map(segments.map((segment, idx) => [segment.id, idx]));

    return filteredSegments.map((segment, index) => {
      let handlers = handlerCacheRef.current.get(segment.id);

      const previousSegment = filteredSegments[index - 1];
      const nextSegment = filteredSegments[index + 1];

      const areAdjacent = (idA: string, idB: string) => {
        const indexA = segmentIndexById.get(idA);
        const indexB = segmentIndexById.get(idB);
        if (indexA === undefined || indexB === undefined) return false;
        return Math.abs(indexA - indexB) === 1;
      };

      if (!handlers) {
        handlers = {
          onSelect: () => {
            // Use stable refs/store for values that might change
            const current = useTranscriptStore.getState().segments.find((s) => s.id === segment.id);
            if (current) {
              setSelectedSegmentId(current.id);
              handleSeek(current.start);
            }
          },
          onTextChange: (text: string) => updateSegmentText(segment.id, text),
          onSpeakerChange: (speaker: string) => updateSegmentSpeaker(segment.id, speaker),
          onSplit: (wordIndex: number) => handleSplitSegment(segment.id, wordIndex),
          onConfirm: () => confirmSegment(segment.id),
          onToggleBookmark: () => toggleSegmentBookmark(segment.id),
          onIgnoreLexiconMatch: (term: string, value: string) =>
            addLexiconFalsePositive(term, value),
          onDelete: () => deleteSegment(segment.id),
        };
        handlerCacheRef.current.set(segment.id, handlers);
      }

      // Merge handlers are position-dependent, so we update them every time.
      // But since they are only updated when filteredSegments changes, it's okay.
      handlers.onMergeWithPrevious =
        index > 0 && previousSegment && areAdjacent(previousSegment.id, segment.id)
          ? () => {
              const currentMergedId = mergeSegments(previousSegment.id, segment.id);
              if (currentMergedId) setSelectedSegmentId(currentMergedId);
            }
          : undefined;

      handlers.onMergeWithNext =
        index < filteredSegments.length - 1 &&
        nextSegment &&
        areAdjacent(segment.id, nextSegment.id)
          ? () => {
              const currentMergedId = mergeSegments(segment.id, nextSegment.id);
              if (currentMergedId) setSelectedSegmentId(currentMergedId);
            }
          : undefined;

      return handlers;
    });
  }, [
    filteredSegments,
    mergeSegments,
    setSelectedSegmentId,
    handleSeek,
    handleSplitSegment,
    updateSegmentText,
    updateSegmentSpeaker,
    confirmSegment,
    toggleSegmentBookmark,
    addLexiconFalsePositive,
    deleteSegment,
    segments,
  ]);

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
      segments,
      speakers,
      currentTime,
      isPlaying,
      playbackRate,
      showSpeakerRegions: isWhisperXFormat,
      onTimeUpdate: setCurrentTime,
      onPlayPause: setIsPlaying,
      onDurationChange: setDuration,
      onSeek: setCurrentTime,
      onSegmentBoundaryChange: updateSegmentTiming,
      onReady: handleWaveReady,
    }),
    [
      audioUrl,
      currentTime,
      handleWaveReady,
      isPlaying,
      isWhisperXFormat,
      playbackRate,
      segments,
      setCurrentTime,
      setDuration,
      setIsPlaying,
      speakers,
      updateSegmentTiming,
    ],
  );

  const playbackControlsProps = useMemo(
    () => ({
      isPlaying,
      currentTime,
      duration,
      playbackRate,
      onPlaybackRateChange: setPlaybackRate,
      onPlayPause: handlePlayPause,
      onSeek: handleSeek,
      onSkipBack: handleSkipBack,
      onSkipForward: handleSkipForward,
      onSplitAtCurrentWord: handleSplitAtCurrentWord,
      canSplitAtCurrentWord,
      disabled: !audioUrl,
    }),
    [
      audioUrl,
      canSplitAtCurrentWord,
      currentTime,
      duration,
      handlePlayPause,
      handleSeek,
      handleSkipBack,
      handleSkipForward,
      handleSplitAtCurrentWord,
      isPlaying,
      playbackRate,
    ],
  );

  const activeSessionDisplayName =
    sessionLabel ?? transcriptRef?.name ?? audioFile?.name ?? "Current session";

  const toolbarProps = useMemo(
    () => ({
      sidebarOpen,
      onToggleSidebar: () => setSidebarOpen((current) => !current),
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
      highlightLowConfidence,
      onToggleHighlightLowConfidence: () => setHighlightLowConfidence((current) => !current),
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
      onShowCustomDictionaries: () => setShowCustomDictionariesDialog(true),
      spellcheckCustomDictionariesCount: spellcheckCustomDictionaries.length,
      onShowSpellcheckDialog: () => setShowSpellcheckDialog(true),
      spellcheckDebugEnabled,
      effectiveSpellcheckLanguages,
      spellcheckerLanguages: spellcheckers.map((checker) => checker.language),
      spellcheckHighlightActive: showSpellcheckMatches,
      glossaryHighlightActive: showLexiconMatches,
      onShowGlossary: () => setShowLexicon(true),
    }),
    [
      activateSession,
      audioFile?.name,
      canRedoChecked,
      canUndoChecked,
      confidencePopoverOpen,
      effectiveSpellcheckLanguages,
      handleAudioUpload,
      handleTranscriptUpload,
      highlightLowConfidence,
      lowConfidenceThreshold,
      recentSessions,
      redo,
      segments.length,
      sidebarOpen,
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
      spellcheckPopoverOpen,
      spellcheckers,
      transcriptRef?.name,
      undo,
      showLexiconMatches,
      showSpellcheckMatches,
      sessionKey,
      sessionKind,
      sessionLabel,
      canCreateRevision,
      transcriptActions.deleteSession,
    ],
  );

  const filterPanelProps = useMemo(
    () => ({
      speakers,
      segments,
      onRenameSpeaker: handleRenameSpeaker,
      onAddSpeaker: addSpeaker,
      onMergeSpeakers: mergeSpeakers,
      selectedSpeakerId: filterSpeakerId,
      onSpeakerSelect: (id: string) =>
        setFilterSpeakerId((current) => (current === id ? undefined : id)),
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
      clearFilters,
      filterBookmarked,
      filterLexicon,
      filterLexiconLowScore,
      filterLowConfidence,
      filterSpeakerId,
      filterSpellcheck,
      handleRenameSpeaker,
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
      setHighlightLowConfidence,
      setManualConfidenceThreshold,
      spellcheckEnabled,
      spellcheckMatchCount,
      spellcheckMatchLimitReached,
      speakers,
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
      onSeek: handleSeek,
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
      editRequestId,
      emptyState,
      filteredSegments,
      handleSeek,
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
      searchQuery,
      isRegexSearch,
      currentMatch,
      replaceQuery,
      replaceCurrent,
      onMatchClick,
      findMatchIndex,
      allMatches,
    ],
  );

  const dialogProps = useMemo(
    () => ({
      showShortcuts,
      onShortcutsChange: setShowShortcuts,
      showExport,
      onExportChange: setShowExport,
      segments,
      audioFileName: audioFile?.name,
      showLexicon,
      onLexiconChange: setShowLexicon,
      showSpellcheckDialog,
      onSpellcheckDialogChange: setShowSpellcheckDialog,
      showCustomDictionariesDialog,
      onCustomDictionariesDialogChange: setShowCustomDictionariesDialog,
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
    }),
    [
      audioFile?.name,
      activeSessionDisplayName,
      canCreateRevision,
      handleCreateRevision,
      sessionKind,
      segments,
      showCustomDictionariesDialog,
      showExport,
      showRevisionDialog,
      showLexicon,
      showShortcuts,
      showSpellcheckDialog,
      recentSessions,
      sessionKey,
      sessionLabel,
    ],
  );

  return {
    sidebarOpen,
    toolbarProps,
    filterPanelProps,
    playbackPaneProps: {
      waveformProps,
      playbackControlsProps,
    },
    transcriptListProps,
    dialogProps,
  };
};

export type TranscriptEditorState = ReturnType<typeof useTranscriptEditor>;
