import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useHotkeys } from "react-hotkeys-hook";
import { loadAudioHandle, queryAudioHandlePermission } from "@/lib/audioHandleStorage";
import { buildFileReference, type FileReference } from "@/lib/fileReference";
import { normalizeToken, similarityScore } from "@/lib/fuzzy";
import {
  getSpellcheckMatch,
  type LoadedSpellchecker,
  loadSpellcheckers,
  normalizeSpellcheckTerm,
} from "@/lib/spellcheck";
import { type Segment, type SpellcheckLanguage, useTranscriptStore } from "@/lib/store";
import { parseTranscriptData } from "@/lib/transcriptParsing";
import { wordLeadingRegex, wordTrailingRegex } from "@/lib/wordBoundaries";

interface SpellcheckMatchMeta {
  suggestions: string[];
  partIndex?: number;
}

interface LexiconMatchMeta {
  term: string;
  score: number;
  partIndex?: number;
}

interface EmptyStateMessage {
  title: string;
  description: string;
}

const buildSegmentHandlers = (
  filteredSegments: Segment[],
  mergeSegments: (id1: string, id2: string) => string | null,
  setSelectedSegmentId: (id: string | null) => void,
  handleSeek: (time: number) => void,
  handleSplitSegment: (segmentId: string, wordIndex: number) => void,
  updateSegmentText: (id: string, text: string) => void,
  updateSegmentSpeaker: (id: string, speaker: string) => void,
  confirmSegment: (id: string) => void,
  toggleSegmentBookmark: (id: string) => void,
  addLexiconFalsePositive: (term: string, value: string) => void,
  deleteSegment: (id: string) => void,
) => {
  return filteredSegments.map((segment, index) => {
    const onMergeWithPrevious =
      index > 0
        ? () => {
            const mergedId = mergeSegments(filteredSegments[index - 1].id, segment.id);
            if (mergedId) {
              setSelectedSegmentId(mergedId);
            }
          }
        : undefined;

    const onMergeWithNext =
      index < filteredSegments.length - 1
        ? () => {
            const mergedId = mergeSegments(segment.id, filteredSegments[index + 1].id);
            if (mergedId) {
              setSelectedSegmentId(mergedId);
            }
          }
        : undefined;

    return {
      onSelect: () => {
        setSelectedSegmentId(segment.id);
        handleSeek(segment.start);
      },
      onTextChange: (text: string) => updateSegmentText(segment.id, text),
      onSpeakerChange: (speaker: string) => updateSegmentSpeaker(segment.id, speaker),
      onSplit: (wordIndex: number) => handleSplitSegment(segment.id, wordIndex),
      onConfirm: () => confirmSegment(segment.id),
      onToggleBookmark: () => toggleSegmentBookmark(segment.id),
      onIgnoreLexiconMatch: (term: string, value: string) => addLexiconFalsePositive(term, value),
      onMergeWithPrevious,
      onMergeWithNext,
      onDelete: () => deleteSegment(segment.id),
    };
  });
};

export const useTranscriptEditor = () => {
  const {
    audioFile,
    audioUrl,
    transcriptRef,
    segments,
    speakers,
    selectedSegmentId,
    currentTime,
    isPlaying,
    duration,
    isWhisperXFormat,
    lexiconEntries,
    lexiconThreshold,
    lexiconHighlightUnderline,
    lexiconHighlightBackground,
    spellcheckEnabled,
    spellcheckLanguages,
    spellcheckIgnoreWords,
    spellcheckCustomDictionaries,
    spellcheckCustomEnabled,
    recentSessions,
    setAudioFile,
    setAudioUrl,
    setAudioReference,
    activateSession,
    loadTranscript,
    setSelectedSegmentId,
    setCurrentTime,
    setIsPlaying,
    setDuration,
    requestSeek,
    clearSeekRequest,
    updateSegmentText,
    updateSegmentSpeaker,
    confirmSegment,
    toggleSegmentBookmark,
    splitSegment,
    mergeSegments,
    updateSegmentTiming,
    deleteSegment,
    addLexiconFalsePositive,
    addLexiconEntry,
    setSpellcheckEnabled,
    setSpellcheckLanguages,
    addSpellcheckIgnoreWord,
    setSpellcheckCustomEnabled,
    renameSpeaker,
    addSpeaker,
    mergeSpeakers,
    undo,
    redo,
    canUndo,
    canRedo,
    loadSpellcheckCustomDictionaries,
  } = useTranscriptStore();

  const [showShortcuts, setShowShortcuts] = useState(false);
  const [showExport, setShowExport] = useState(false);
  const [showLexicon, setShowLexicon] = useState(false);
  const [showSpellcheckDialog, setShowSpellcheckDialog] = useState(false);
  const [showCustomDictionariesDialog, setShowCustomDictionariesDialog] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [filterSpeakerId, setFilterSpeakerId] = useState<string | undefined>();
  const [highlightLowConfidence, setHighlightLowConfidence] = useState(true);
  const [manualConfidenceThreshold, setManualConfidenceThreshold] = useState<number | null>(null);
  const [confidencePopoverOpen, setConfidencePopoverOpen] = useState(false);
  const [filterLowConfidence, setFilterLowConfidence] = useState(false);
  const [filterBookmarked, setFilterBookmarked] = useState(false);
  const [filterLexicon, setFilterLexicon] = useState(false);
  const [filterLexiconLowScore, setFilterLexiconLowScore] = useState(false);
  const [filterSpellcheck, setFilterSpellcheck] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [editRequestId, setEditRequestId] = useState<string | null>(null);
  const [spellcheckPopoverOpen, setSpellcheckPopoverOpen] = useState(false);
  const transcriptListRef = useRef<HTMLDivElement>(null);
  const restoreAttemptedRef = useRef(false);
  const [spellcheckers, setSpellcheckers] = useState<LoadedSpellchecker[]>([]);
  const [spellcheckMatchesBySegment, setSpellcheckMatchesBySegment] = useState<
    Map<string, Map<number, SpellcheckMatchMeta>>
  >(new Map());
  const [spellcheckMatchLimitReached, setSpellcheckMatchLimitReached] = useState(false);
  const [isWaveReady, setIsWaveReady] = useState(!audioUrl);
  const spellcheckRunIdRef = useRef(0);

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

  const effectiveSpellcheckLanguages = useMemo(() => spellcheckLanguages, [spellcheckLanguages]);

  const spellcheckDebugEnabled = useMemo(() => {
    if (typeof window === "undefined") return false;
    try {
      return window.localStorage.getItem("spellcheckDebug") === "1";
    } catch {
      return false;
    }
  }, []);

  useEffect(() => {
    setIsWaveReady(!audioUrl);
  }, [audioUrl]);

  const handleWaveReady = useCallback(() => {
    setIsWaveReady(true);
  }, []);

  type IdleHandle = {
    id: number | ReturnType<typeof setTimeout>;
    type: "idle" | "timeout";
  };

  const scheduleIdle = useCallback((callback: () => void): IdleHandle => {
    const requestIdle = (
      globalThis as typeof globalThis & {
        requestIdleCallback?: (cb: () => void) => number;
      }
    ).requestIdleCallback;
    if (requestIdle) {
      return { id: requestIdle(callback), type: "idle" };
    }
    return { id: globalThis.setTimeout(callback, 0), type: "timeout" };
  }, []);

  const cancelIdle = useCallback((handle: IdleHandle | null) => {
    if (!handle) return;
    if (
      handle.type === "idle" &&
      (
        globalThis as typeof globalThis & {
          cancelIdleCallback?: (id: number) => void;
        }
      ).cancelIdleCallback
    ) {
      (
        globalThis as typeof globalThis & {
          cancelIdleCallback?: (id: number) => void;
        }
      ).cancelIdleCallback?.(handle.id as number);
      return;
    }
    globalThis.clearTimeout(handle.id);
  }, []);

  useEffect(() => {
    let isMounted = true;
    let scheduled: IdleHandle | null = null;
    if (audioUrl && !isWaveReady) {
      return () => {
        isMounted = false;
        cancelIdle(scheduled);
      };
    }
    if (
      !spellcheckEnabled ||
      (effectiveSpellcheckLanguages.length === 0 && !spellcheckCustomEnabled)
    ) {
      setSpellcheckers([]);
      return () => {
        isMounted = false;
        cancelIdle(scheduled);
      };
    }

    scheduled = scheduleIdle(() => {
      loadSpellcheckers(
        effectiveSpellcheckLanguages,
        spellcheckCustomEnabled ? spellcheckCustomDictionaries : [],
      )
        .then((loaded) => {
          if (isMounted) {
            setSpellcheckers(loaded);
          }
        })
        .catch((err) => {
          console.error("Failed to load spellcheck dictionaries:", err);
        });
    });

    return () => {
      isMounted = false;
      cancelIdle(scheduled);
    };
  }, [
    audioUrl,
    cancelIdle,
    isWaveReady,
    scheduleIdle,
    spellcheckCustomDictionaries,
    spellcheckCustomEnabled,
    spellcheckEnabled,
    effectiveSpellcheckLanguages,
  ]);

  useEffect(() => {
    if (!spellcheckEnabled && filterSpellcheck) {
      setFilterSpellcheck(false);
    }
  }, [filterSpellcheck, spellcheckEnabled]);

  useEffect(() => {
    loadSpellcheckCustomDictionaries();
  }, [loadSpellcheckCustomDictionaries]);

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

  const autoConfidenceThreshold = useMemo(() => {
    const scores = segments
      .flatMap((segment) => segment.words)
      .map((word) => word.score)
      .filter((score): score is number => typeof score === "number");
    if (scores.length === 0) return null;
    scores.sort((a, b) => a - b);
    const index = Math.floor(scores.length * 0.1);
    const percentile = scores[Math.min(index, scores.length - 1)];
    return Math.min(0.4, percentile);
  }, [segments]);

  const lowConfidenceThreshold = manualConfidenceThreshold ?? autoConfidenceThreshold;

  const lexiconEntriesNormalized = useMemo(
    () =>
      lexiconEntries
        .map((entry) => ({
          term: entry.term,
          normalized: normalizeToken(entry.term),
          raw: entry.term.trim().toLowerCase(),
          variants: entry.variants
            .map((variant) => ({
              value: variant,
              normalized: normalizeToken(variant),
              raw: variant.trim().toLowerCase(),
            }))
            .filter((variant) => variant.normalized.length > 0),
          falsePositives: (entry.falsePositives ?? [])
            .map((value) => ({
              value,
              normalized: normalizeToken(value),
            }))
            .filter((value) => value.normalized.length > 0),
        }))
        .filter((entry) => entry.normalized.length > 0),
    [lexiconEntries],
  );

  const lexiconMatchesBySegment = useMemo(() => {
    if (lexiconEntriesNormalized.length === 0)
      return new Map<string, Map<number, LexiconMatchMeta>>();
    const matches = new Map<string, Map<number, LexiconMatchMeta>>();
    segments.forEach((segment) => {
      const wordMatches = new Map<number, LexiconMatchMeta>();
      segment.words.forEach((word, index) => {
        const leading = word.word.match(wordLeadingRegex)?.[0] ?? "";
        const trailing = word.word.match(wordTrailingRegex)?.[0] ?? "";
        const core = word.word.slice(leading.length, word.word.length - trailing.length);
        if (!core) return;
        const parts = core.includes("-") ? core.split("-").filter(Boolean) : [core];
        if (parts.length === 0) return;
        let bestScore = 0;
        let bestTerm = "";
        let bestPartIndex: number | undefined;
        parts.forEach((part, partIndex) => {
          const normalizedPart = normalizeToken(part);
          const rawPart = part.trim().toLowerCase();
          if (!normalizedPart) return;
          lexiconEntriesNormalized.forEach((entry) => {
            const rawTerm = entry.raw;
            const isExactTermMatch = rawPart === rawTerm;
            if (
              entry.falsePositives.some(
                (value) =>
                  value.normalized === normalizedPart ||
                  value.value.trim().toLowerCase() === rawPart,
              )
            ) {
              return;
            }
            let bestFalsePositiveScore = 0;
            entry.falsePositives.forEach((value) => {
              const score = similarityScore(normalizedPart, value.normalized);
              if (score > bestFalsePositiveScore) {
                bestFalsePositiveScore = score;
              }
            });
            if (bestFalsePositiveScore >= lexiconThreshold) {
              return;
            }
            const score = similarityScore(normalizedPart, entry.normalized);
            const adjustedScore = score === 1 && !isExactTermMatch ? 0.99 : score;
            if (adjustedScore > bestScore) {
              bestScore = adjustedScore;
              bestTerm = entry.term;
              bestPartIndex = parts.length > 1 ? partIndex : undefined;
            }
            const hasVariantMatch = entry.variants.some((variant) => variant.raw === rawPart);
            if (hasVariantMatch && !isExactTermMatch && 0.99 > bestScore) {
              bestScore = 0.99;
              bestTerm = entry.term;
              bestPartIndex = parts.length > 1 ? partIndex : undefined;
            }
          });
        });
        if (bestScore >= lexiconThreshold) {
          wordMatches.set(index, { term: bestTerm, score: bestScore, partIndex: bestPartIndex });
        }
      });
      if (wordMatches.size > 0) {
        matches.set(segment.id, wordMatches);
      }
    });
    return matches;
  }, [lexiconEntriesNormalized, lexiconThreshold, segments]);

  const spellcheckLanguageKey = useMemo(() => {
    const languageKey = effectiveSpellcheckLanguages.slice().sort().join(",");
    const customKey = spellcheckCustomDictionaries
      .map((dictionary) => dictionary.id)
      .sort()
      .join("|");
    const enabledKey = spellcheckCustomEnabled ? "custom:on" : "custom:off";
    return `${languageKey}|${enabledKey}|${customKey}`;
  }, [effectiveSpellcheckLanguages, spellcheckCustomDictionaries, spellcheckCustomEnabled]);

  useEffect(() => {
    const SPELLCHECK_MATCH_LIMIT = 1000;
    const runId = spellcheckRunIdRef.current + 1;
    spellcheckRunIdRef.current = runId;
    setSpellcheckMatchLimitReached(false);

    if (!spellcheckEnabled || spellcheckers.length === 0 || segments.length === 0) {
      setSpellcheckMatchesBySegment(new Map());
      return;
    }

    const ignored = new Set(spellcheckIgnoreWords);
    lexiconEntries.forEach((entry) => {
      const term = normalizeSpellcheckTerm(entry.term);
      if (term) {
        ignored.add(term);
      }
      (entry.variants ?? []).forEach((variant) => {
        const normalized = normalizeSpellcheckTerm(variant);
        if (normalized) {
          ignored.add(normalized);
        }
      });
    });
    const matches = new Map<string, Map<number, SpellcheckMatchMeta>>();
    let matchCount = 0;
    let segmentIndex = 0;
    let wordIndex = 0;
    let processedSinceUpdate = 0;
    let cancelled = false;

    const scheduleIdleCheck = (callback: (deadline?: { timeRemaining: () => number }) => void) => {
      const requestIdle = (
        globalThis as typeof globalThis & {
          requestIdleCallback?: (
            cb: (deadline?: { timeRemaining: () => number }) => void,
          ) => number;
        }
      ).requestIdleCallback;
      if (requestIdle) {
        return requestIdle(callback);
      }
      return globalThis.setTimeout(() => callback(), 0);
    };

    const processChunk = (deadline?: { timeRemaining: () => number }) => {
      if (cancelled || spellcheckRunIdRef.current !== runId) return;
      let timeRemaining = deadline?.timeRemaining?.() ?? 0;
      let iterations = 0;

      while (segmentIndex < segments.length && (iterations < 120 || timeRemaining > 4)) {
        const segment = segments[segmentIndex];
        const words = segment.words;
        const wordMatches = matches.get(segment.id) ?? new Map<number, SpellcheckMatchMeta>();

        while (wordIndex < words.length) {
          const word = words[wordIndex];
          const match = getSpellcheckMatch(
            word.word,
            spellcheckers,
            spellcheckLanguageKey,
            ignored,
          );
          if (match) {
            wordMatches.set(wordIndex, match);
            matchCount += 1;
            if (matchCount >= SPELLCHECK_MATCH_LIMIT) {
              if (wordMatches.size > 0) {
                matches.set(segment.id, wordMatches);
              }
              setSpellcheckMatchesBySegment(new Map(matches));
              setSpellcheckMatchLimitReached(true);
              return;
            }
          }
          wordIndex += 1;
          iterations += 1;
          processedSinceUpdate += 1;
          timeRemaining = deadline?.timeRemaining?.() ?? 0;
          if (iterations >= 120 && timeRemaining <= 4) break;
        }

        if (wordMatches.size > 0) {
          matches.set(segment.id, wordMatches);
        }

        if (wordIndex >= words.length) {
          segmentIndex += 1;
          wordIndex = 0;
        } else {
          break;
        }
      }

      if (processedSinceUpdate >= 240 || segmentIndex >= segments.length) {
        setSpellcheckMatchesBySegment(new Map(matches));
        processedSinceUpdate = 0;
      }

      if (segmentIndex < segments.length) {
        scheduleIdleCheck(processChunk);
      } else if (matches.size === 0) {
        setSpellcheckMatchesBySegment(new Map());
      }
    };

    scheduleIdleCheck(processChunk);

    return () => {
      cancelled = true;
    };
  }, [
    lexiconEntries,
    segments,
    spellcheckEnabled,
    spellcheckIgnoreWords,
    spellcheckLanguageKey,
    spellcheckers,
  ]);

  const lexiconHighlightEnabled = lexiconHighlightUnderline || lexiconHighlightBackground;
  const forceLexiconHighlight = filterLexicon || filterLexiconLowScore;
  const effectiveLexiconHighlightUnderline = forceLexiconHighlight
    ? true
    : lexiconHighlightUnderline;
  const effectiveLexiconHighlightBackground = forceLexiconHighlight
    ? true
    : lexiconHighlightBackground;
  const showLexiconMatches =
    lexiconEntriesNormalized.length > 0 &&
    (filterLexicon || filterLexiconLowScore || lexiconHighlightEnabled);
  const showSpellcheckMatches =
    (spellcheckEnabled || filterSpellcheck) && !(filterLexicon || filterLexiconLowScore);

  const { lexiconMatchCount, lexiconLowScoreMatchCount } = useMemo(() => {
    let totalMatches = 0;
    let lowScoreMatches = 0;
    lexiconMatchesBySegment.forEach((matches) => {
      totalMatches += matches.size;
      matches.forEach((match) => {
        if (match.score < 1) lowScoreMatches += 1;
      });
    });
    return { lexiconMatchCount: totalMatches, lexiconLowScoreMatchCount: lowScoreMatches };
  }, [lexiconMatchesBySegment]);

  const spellcheckMatchCount = useMemo(() => {
    const SPELLCHECK_MATCH_LIMIT = 1000;
    let totalMatches = 0;
    spellcheckMatchesBySegment.forEach((matches) => {
      totalMatches += matches.size;
    });
    return Math.min(totalMatches, SPELLCHECK_MATCH_LIMIT);
  }, [spellcheckMatchesBySegment]);

  const activeSpeakerName = filterSpeakerId
    ? speakers.find((speaker) => speaker.id === filterSpeakerId)?.name
    : undefined;

  const filteredSegments = useMemo(() => {
    return segments.filter((segment) => {
      if (activeSpeakerName && segment.speaker !== activeSpeakerName) {
        return false;
      }
      if (filterLowConfidence) {
        if (lowConfidenceThreshold === null) return false;
        const hasLowScore = segment.words.some(
          (word) => typeof word.score === "number" && word.score <= lowConfidenceThreshold,
        );
        if (!hasLowScore) return false;
      }
      if (filterBookmarked && !segment.bookmarked) {
        return false;
      }
      if (filterLexicon) {
        if (!lexiconMatchesBySegment.has(segment.id)) return false;
      }
      if (filterLexiconLowScore) {
        const matches = lexiconMatchesBySegment.get(segment.id);
        if (!matches) return false;
        const hasLowMatch = Array.from(matches.values()).some((match) => match.score < 1);
        if (!hasLowMatch) return false;
      }
      if (filterSpellcheck) {
        if (!spellcheckMatchesBySegment.has(segment.id)) return false;
      }
      return true;
    });
  }, [
    activeSpeakerName,
    filterBookmarked,
    filterLexicon,
    filterLexiconLowScore,
    filterLowConfidence,
    filterSpellcheck,
    lexiconMatchesBySegment,
    lowConfidenceThreshold,
    segments,
    spellcheckMatchesBySegment,
  ]);

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

  useEffect(() => {
    const handleGlobalSpace = (event: KeyboardEvent) => {
      if (isTranscriptEditing()) return;
      if (event.key !== " ") return;
      const target = event.target as HTMLElement | null;
      if (target) {
        const tagName = target.tagName;
        const isFormElement = tagName === "INPUT" || tagName === "TEXTAREA" || tagName === "SELECT";
        if (isFormElement || target.isContentEditable) return;
      }
      event.preventDefault();
      handlePlayPause();
    };

    window.addEventListener("keydown", handleGlobalSpace, { capture: true });
    return () => window.removeEventListener("keydown", handleGlobalSpace, { capture: true });
  }, [handlePlayPause, isTranscriptEditing]);

  useHotkeys(
    "j",
    () => {
      if (isTranscriptEditing()) return;
      handleSkipBack();
    },
    { enableOnFormTags: false },
  );

  useHotkeys(
    "l",
    () => {
      if (isTranscriptEditing()) return;
      handleSkipForward();
    },
    { enableOnFormTags: false },
  );

  useHotkeys(
    "left",
    () => {
      if (isTranscriptEditing()) return;
      handleSeek(Math.max(0, currentTime - 1));
    },
    { enableOnFormTags: false },
  );

  useHotkeys(
    "right",
    () => {
      if (isTranscriptEditing()) return;
      handleSeek(Math.min(duration, currentTime + 1));
    },
    { enableOnFormTags: false },
  );

  useHotkeys(
    "home",
    () => {
      if (isTranscriptEditing()) return;
      handleSeek(0);
    },
    { enableOnFormTags: false },
  );

  useHotkeys(
    "end",
    () => {
      if (isTranscriptEditing()) return;
      handleSeek(duration);
    },
    { enableOnFormTags: false },
  );

  useHotkeys("escape", () => {
    if (isTranscriptEditing()) return;
    setSelectedSegmentId(null);
    setFilterSpeakerId(undefined);
  });

  useHotkeys(
    "mod+z",
    () => {
      if (isTranscriptEditing()) return;
      if (canUndo()) undo();
    },
    { enableOnFormTags: true, enableOnContentEditable: true, preventDefault: true },
  );

  useHotkeys(
    "mod+shift+z",
    () => {
      if (isTranscriptEditing()) return;
      if (canRedo()) redo();
    },
    { enableOnFormTags: true, enableOnContentEditable: true, preventDefault: true },
  );

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (isTranscriptEditing()) return;
      const target = event.target as HTMLElement | null;
      if (!target) return;
      const isEditable = target.isContentEditable;
      const tagName = target.tagName;
      const isFormElement = tagName === "INPUT" || tagName === "TEXTAREA" || tagName === "SELECT";

      if (isEditable || isFormElement) return;
      if (event.ctrlKey || event.metaKey || event.altKey || event.shiftKey) return;

      if (event.key.toLowerCase() === "z") {
        if (canUndo()) {
          event.preventDefault();
          undo();
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [canUndo, isTranscriptEditing, undo]);

  useHotkeys("mod+e", () => {
    if (isTranscriptEditing()) return;
    setShowExport(true);
  });

  useHotkeys("shift+/", () => {
    if (isTranscriptEditing()) return;
    setShowShortcuts(true);
  });

  useHotkeys(
    "enter",
    () => {
      if (isTranscriptEditing()) return;
      if (!selectedSegmentId) return;
      const segment = segments.find((s) => s.id === selectedSegmentId);
      if (!segment) return;
      requestSeek(segment.start);
      setIsPlaying(true);
    },
    { enableOnFormTags: false, enableOnContentEditable: false, preventDefault: true },
  );

  useHotkeys(
    "e",
    () => {
      if (isTranscriptEditing()) return;
      if (selectedSegmentId) {
        setEditRequestId(selectedSegmentId);
      }
    },
    { enableOnFormTags: false, enableOnContentEditable: false, preventDefault: true },
  );

  useHotkeys(
    "p",
    () => {
      if (isTranscriptEditing()) return;
      if (selectedSegmentId) {
        const index = getSelectedSegmentIndex();
        if (index > 0) {
          const mergedId = mergeSegments(segments[index - 1].id, selectedSegmentId);
          if (mergedId) {
            setSelectedSegmentId(mergedId);
          }
        }
      }
    },
    { enableOnFormTags: false, enableOnContentEditable: false, preventDefault: true },
  );

  useHotkeys(
    "m",
    () => {
      if (isTranscriptEditing()) return;
      if (selectedSegmentId) {
        const index = getSelectedSegmentIndex();
        if (index < segments.length - 1) {
          const mergedId = mergeSegments(selectedSegmentId, segments[index + 1].id);
          if (mergedId) {
            setSelectedSegmentId(mergedId);
          }
        }
      }
    },
    { enableOnFormTags: false, enableOnContentEditable: false, preventDefault: true },
  );

  useHotkeys(
    "b",
    () => {
      if (isTranscriptEditing()) return;
      if (selectedSegmentId) {
        toggleSegmentBookmark(selectedSegmentId);
      }
    },
    { enableOnFormTags: false, enableOnContentEditable: false, preventDefault: true },
  );

  useHotkeys(
    "c",
    () => {
      if (isTranscriptEditing()) return;
      if (selectedSegmentId) {
        confirmSegment(selectedSegmentId);
      }
    },
    { enableOnFormTags: false, enableOnContentEditable: false, preventDefault: true },
  );

  useHotkeys(
    "delete",
    () => {
      if (isTranscriptEditing()) return;
      if (selectedSegmentId) {
        deleteSegment(selectedSegmentId);
        setSelectedSegmentId(null);
      }
    },
    { enableOnFormTags: false },
  );

  useHotkeys(
    "1,2,3,4,5,6,7,8,9",
    (event) => {
      if (isTranscriptEditing()) return;
      const speakerIndex = Number(event.key) - 1;
      if (!Number.isInteger(speakerIndex)) return;
      if (selectedSegmentId && speakers[speakerIndex]) {
        updateSegmentSpeaker(selectedSegmentId, speakers[speakerIndex].name);
      }
    },
    { enableOnFormTags: false },
  );

  const activeSegment = segments.find((s) => currentTime >= s.start && currentTime <= s.end);
  const isActiveSegmentVisible = useMemo(() => {
    if (!activeSegment) return false;
    if (!activeSpeakerName) return true;
    return filteredSegments.some((segment) => segment.id === activeSegment.id);
  }, [activeSegment, activeSpeakerName, filteredSegments]);

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

  useHotkeys(
    "s",
    () => {
      if (isTranscriptEditing()) return;
      handleSplitAtCurrentWord();
    },
    {
      enableOnFormTags: false,
      enableOnContentEditable: false,
      preventDefault: true,
    },
  );

  const activeSegmentId = activeSegment?.id ?? null;
  const activeWordIndex = useMemo(() => {
    if (!activeSegment) return -1;
    return activeSegment.words.findIndex((w) => currentTime >= w.start && currentTime <= w.end);
  }, [activeSegment, currentTime]);

  useEffect(() => {
    if (isTranscriptEditing()) return;
    if (!activeSegment || !isActiveSegmentVisible) return;
    if (activeSegment.id !== selectedSegmentId) {
      setSelectedSegmentId(activeSegment.id);
    }
  }, [
    activeSegment,
    isActiveSegmentVisible,
    isTranscriptEditing,
    selectedSegmentId,
    setSelectedSegmentId,
  ]);

  useEffect(() => {
    if (isTranscriptEditing()) return;
    if (!activeSegment) return;
    const container = transcriptListRef.current;
    if (!container) return;
    const target = container.querySelector<HTMLElement>(`[data-segment-id="${activeSegment.id}"]`);
    if (!target) return;
    requestAnimationFrame(() => {
      target.scrollIntoView({ block: "center", behavior: "smooth" });
    });
  }, [activeSegment, isTranscriptEditing]);

  useEffect(() => {
    if (isTranscriptEditing()) return;
    if (!selectedSegmentId || isPlaying) return;
    const container = transcriptListRef.current;
    if (!container) return;
    const target = container.querySelector<HTMLElement>(`[data-segment-id="${selectedSegmentId}"]`);
    if (!target) return;
    requestAnimationFrame(() => {
      target.scrollIntoView({ block: "center", behavior: "smooth" });
    });
  }, [selectedSegmentId, isPlaying, isTranscriptEditing]);

  useEffect(() => {
    const handleGlobalArrowNav = (event: KeyboardEvent) => {
      if (isTranscriptEditing()) return;
      if (event.key !== "ArrowUp" && event.key !== "ArrowDown") return;
      const target = event.target as HTMLElement | null;
      if (target) {
        const tagName = target.tagName;
        const isFormElement = tagName === "INPUT" || tagName === "TEXTAREA" || tagName === "SELECT";
        if (isFormElement || target.isContentEditable) return;
      }
      event.preventDefault();
      if (event.key === "ArrowUp") {
        selectPreviousSegment();
      } else {
        selectNextSegment();
      }
    };

    window.addEventListener("keydown", handleGlobalArrowNav, { capture: true });
    return () => window.removeEventListener("keydown", handleGlobalArrowNav, { capture: true });
  }, [selectNextSegment, selectPreviousSegment, isTranscriptEditing]);

  useEffect(() => {
    if (!filterLowConfidence || !isPlaying) return;
    if (lowConfidenceThreshold === null) return;
    if (filteredSegments.length === 0) return;
    const activeFiltered = filteredSegments.find(
      (segment) => currentTime >= segment.start && currentTime <= segment.end,
    );
    if (activeFiltered) return;
    const nextSegment = filteredSegments.find((segment) => segment.start > currentTime);
    if (nextSegment) {
      setSelectedSegmentId(nextSegment.id);
      requestSeek(nextSegment.start);
      return;
    }
    setIsPlaying(false);
  }, [
    currentTime,
    filterLowConfidence,
    filteredSegments,
    isPlaying,
    lowConfidenceThreshold,
    requestSeek,
    setIsPlaying,
    setSelectedSegmentId,
  ]);

  const segmentHandlers = useMemo(
    () =>
      buildSegmentHandlers(
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
      ),
    [
      addLexiconFalsePositive,
      confirmSegment,
      deleteSegment,
      filteredSegments,
      handleSeek,
      handleSplitSegment,
      mergeSegments,
      setSelectedSegmentId,
      toggleSegmentBookmark,
      updateSegmentSpeaker,
      updateSegmentText,
    ],
  );

  const getEmptyState = useCallback((): EmptyStateMessage => {
    if (segments.length === 0) {
      return {
        title: "No transcript loaded",
        description:
          "Upload an audio file and its Whisper or WhisperX JSON transcript to get started.",
      };
    }

    if (filterSpellcheck && activeSpeakerName) {
      return {
        title: "No spelling issues for this speaker",
        description: "Clear filters to see all segments.",
      };
    }

    if (filterSpellcheck) {
      return {
        title: "No spelling issues",
        description: "Clear filters to see all segments.",
      };
    }

    if (filterLowConfidence && activeSpeakerName) {
      return {
        title: "No low-score segments for this speaker",
        description: "Adjust the threshold or clear filters to see more segments.",
      };
    }

    if (filterLowConfidence) {
      return {
        title: "No low-score segments",
        description: "Adjust the threshold or clear filters to see more segments.",
      };
    }

    return {
      title: "No segments for this speaker",
      description: "Click the speaker again to show all segments.",
    };
  }, [activeSpeakerName, filterLowConfidence, filterSpellcheck, segments.length]);

  const waveformProps = {
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
  };

  const playbackControlsProps = {
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
  };

  const toolbarProps = {
    sidebarOpen,
    onToggleSidebar: () => setSidebarOpen((current) => !current),
    onAudioUpload: handleAudioUpload,
    onTranscriptUpload: handleTranscriptUpload,
    audioFileName: audioFile?.name,
    transcriptFileName: transcriptRef?.name,
    transcriptLoaded: segments.length > 0,
    recentSessions,
    onActivateSession: activateSession,
    onUndo: undo,
    onRedo: redo,
    canUndo: canUndo(),
    canRedo: canRedo(),
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
    onShowGlossary: () => setShowLexicon(true),
  };

  const filterPanelProps = {
    speakers,
    segments,
    onRenameSpeaker: handleRenameSpeaker,
    onAddSpeaker: addSpeaker,
    onMergeSpeakers: mergeSpeakers,
    selectedSpeakerId: filterSpeakerId,
    onSpeakerSelect: (id: string) =>
      setFilterSpeakerId((current) => (current === id ? undefined : id)),
    onClearFilters: () => {
      setFilterSpeakerId(undefined);
      setFilterLowConfidence(false);
      setFilterBookmarked(false);
      setFilterLexicon(false);
      setFilterLexiconLowScore(false);
      setFilterSpellcheck(false);
    },
    lowConfidenceFilterActive: filterLowConfidence,
    onToggleLowConfidenceFilter: () => setFilterLowConfidence((current) => !current),
    lowConfidenceThreshold,
    onLowConfidenceThresholdChange: (value: number) => {
      setManualConfidenceThreshold(value);
      setHighlightLowConfidence(true);
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
  };

  const transcriptListProps = {
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
    onClearEditRequest: () => setEditRequestId(null),
    segmentHandlers,
    onSeek: handleSeek,
    onIgnoreSpellcheckMatch: addSpellcheckIgnoreWord,
    onAddSpellcheckToGlossary: addLexiconEntry,
    emptyState: getEmptyState(),
  };

  const dialogProps = {
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
  };

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
