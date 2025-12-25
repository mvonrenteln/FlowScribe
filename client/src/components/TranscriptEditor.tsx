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
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useHotkeys } from "react-hotkeys-hook";
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
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Slider } from "@/components/ui/slider";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { loadAudioHandle, queryAudioHandlePermission } from "@/lib/audioHandleStorage";
import { buildFileReference, type FileReference } from "@/lib/fileReference";
import { normalizeToken, similarityScore } from "@/lib/fuzzy";
import {
  getSpellcheckSuggestions,
  type LoadedSpellchecker,
  loadSpellcheckers,
} from "@/lib/spellcheck";
import { useTranscriptStore } from "@/lib/store";
import { cn } from "@/lib/utils";
import { CustomDictionariesDialog } from "./CustomDictionariesDialog";
import { ExportDialog } from "./ExportDialog";
import { FileUpload } from "./FileUpload";
import { GlossaryDialog } from "./GlossaryDialog";
import { KeyboardShortcuts } from "./KeyboardShortcuts";
import { PlaybackControls } from "./PlaybackControls";
import { SpeakerSidebar } from "./SpeakerSidebar";
import { SpellcheckDialog } from "./SpellcheckDialog";
import { ThemeToggle } from "./ThemeToggle";
import { TranscriptSegment } from "./TranscriptSegment";
import { WaveformPlayer } from "./WaveformPlayer";

export function TranscriptEditor() {
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
    loadSpellcheckCustomDictionaries,
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
    Map<string, Map<number, { suggestions: string[] }>>
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
      interface WhisperSegment {
        timestamp: [number, number];
        text: string;
      }

      interface WhisperXSegment {
        speaker?: string;
        start: number;
        end: number;
        text: string;
        words?: Array<{ word: string; start: number; end: number }>;
      }

      const checkIsWhisperFormat = (d: unknown): d is WhisperSegment[] => {
        return Array.isArray(d) && d.length > 0 && "timestamp" in d[0];
      };

      const checkIsWhisperXFormat = (d: unknown): d is { segments: WhisperXSegment[] } => {
        return typeof d === "object" && d !== null && "segments" in d;
      };

      let processedSegments: Array<{
        id: string;
        speaker: string;
        start: number;
        end: number;
        text: string;
        words: Array<{ word: string; start: number; end: number }>;
      }> = [];

      let detectedWhisperXFormat = false;

      if (checkIsWhisperFormat(data)) {
        processedSegments = data.map((seg, idx) => {
          const start = seg.timestamp[0];
          const end = seg.timestamp[1];
          const text = seg.text.trim();
          const wordsArray = text.split(/\s+/).filter((w) => w.length > 0);
          const segDuration = end - start;
          const wordDuration =
            wordsArray.length > 0 ? segDuration / wordsArray.length : segDuration;

          return {
            id: `seg-${idx}`,
            speaker: "SPEAKER_00",
            start,
            end,
            text,
            words: wordsArray.map((word, i) => ({
              word,
              start: start + i * wordDuration,
              end: start + (i + 1) * wordDuration,
            })),
          };
        });
        detectedWhisperXFormat = false;
      } else if (checkIsWhisperXFormat(data)) {
        processedSegments = data.segments.map((seg, idx) => ({
          id: `seg-${idx}`,
          speaker: seg.speaker || "SPEAKER_00",
          start: seg.start,
          end: seg.end,
          text: seg.text.trim(),
          words:
            seg.words ||
            seg.text
              .trim()
              .split(/\s+/)
              .filter((w) => w.length > 0)
              .map((word, i, arr) => {
                const segDuration = seg.end - seg.start;
                const wordDuration = arr.length > 0 ? segDuration / arr.length : segDuration;
                return {
                  word,
                  start: seg.start + i * wordDuration,
                  end: seg.start + (i + 1) * wordDuration,
                };
              }),
        }));
        detectedWhisperXFormat = true;
      } else {
        console.error("Unknown transcript format. Expected Whisper or WhisperX format.");
        return;
      }

      if (processedSegments.length > 0) {
        loadTranscript({
          segments: processedSegments,
          isWhisperXFormat: detectedWhisperXFormat,
          reference: reference ?? null,
        });
      }
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
  const scheduleIdle = useCallback((callback: () => void) => {
    const requestIdle = (
      globalThis as typeof globalThis & {
        requestIdleCallback?: (cb: () => void) => number;
      }
    ).requestIdleCallback;
    if (requestIdle) {
      return { id: requestIdle(callback), type: "idle" as const };
    }
    return { id: globalThis.setTimeout(callback, 0), type: "timeout" as const };
  }, []);
  const cancelIdle = useCallback((handle: { id: number; type: "idle" | "timeout" } | null) => {
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
      ).cancelIdleCallback?.(handle.id);
      return;
    }
    globalThis.clearTimeout(handle.id);
  }, []);

  useEffect(() => {
    let isMounted = true;
    let scheduled: { id: number; type: "idle" | "timeout" } | null = null;
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
          variants: entry.variants
            .map((variant) => ({
              value: variant,
              normalized: normalizeToken(variant),
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
      return new Map<string, Map<number, { term: string; score: number }>>();
    const matches = new Map<string, Map<number, { term: string; score: number }>>();
    segments.forEach((segment) => {
      const wordMatches = new Map<number, { term: string; score: number }>();
      segment.words.forEach((word, index) => {
        const normalizedWord = normalizeToken(word.word);
        const rawWord = word.word.trim().toLowerCase();
        if (!normalizedWord) return;
        let bestScore = 0;
        let bestTerm = "";
        lexiconEntriesNormalized.forEach((entry) => {
          if (
            entry.falsePositives.some(
              (value) =>
                value.normalized === normalizedWord || value.value.trim().toLowerCase() === rawWord,
            )
          ) {
            return;
          }
          let bestFalsePositiveScore = 0;
          entry.falsePositives.forEach((value) => {
            const score = similarityScore(normalizedWord, value.normalized);
            if (score > bestFalsePositiveScore) {
              bestFalsePositiveScore = score;
            }
          });
          if (bestFalsePositiveScore >= lexiconThreshold) {
            return;
          }
          const score = similarityScore(normalizedWord, entry.normalized);
          if (score > bestScore) {
            bestScore = score;
            bestTerm = entry.term;
          }
          entry.variants.forEach((variant) => {
            if (variant.normalized === normalizedWord && 1 > bestScore) {
              bestScore = 1;
              bestTerm = entry.term;
            }
          });
        });
        if (bestScore >= lexiconThreshold) {
          wordMatches.set(index, { term: bestTerm, score: bestScore });
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
      const term = entry.term.trim().toLowerCase();
      if (term) {
        ignored.add(term);
      }
      (entry.variants ?? []).forEach((variant) => {
        const normalized = variant.trim().toLowerCase();
        if (normalized) {
          ignored.add(normalized);
        }
      });
    });
    const matches = new Map<string, Map<number, { suggestions: string[] }>>();
    let matchCount = 0;
    let segmentIndex = 0;
    let wordIndex = 0;
    let processedSinceUpdate = 0;
    let cancelled = false;

    const scheduleIdle = (callback: (deadline?: { timeRemaining: () => number }) => void) => {
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
        const wordMatches = matches.get(segment.id) ?? new Map<number, { suggestions: string[] }>();

        while (wordIndex < words.length) {
          const word = words[wordIndex];
          const suggestions = getSpellcheckSuggestions(
            word.word,
            spellcheckers,
            spellcheckLanguageKey,
            ignored,
          );
          if (suggestions !== null) {
            wordMatches.set(wordIndex, { suggestions });
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
        scheduleIdle(processChunk);
      } else if (matches.size === 0) {
        setSpellcheckMatchesBySegment(new Map());
      }
    };

    scheduleIdle(processChunk);

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
  const showSpellcheckMatches = spellcheckEnabled || filterSpellcheck;

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
      filteredSegments.map((segment, index) => {
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
          onIgnoreLexiconMatch: (term: string, value: string) =>
            addLexiconFalsePositive(term, value),
          onMergeWithPrevious,
          onMergeWithNext,
          onDelete: () => deleteSegment(segment.id),
        };
      }),
    [
      filteredSegments,
      handleSeek,
      handleSplitSegment,
      mergeSegments,
      addLexiconFalsePositive,
      setSelectedSegmentId,
      updateSegmentSpeaker,
      updateSegmentText,
      confirmSegment,
      toggleSegmentBookmark,
      deleteSegment,
    ],
  );

  return (
    <div className="flex flex-col h-screen bg-background">
      <header className="flex items-center justify-between gap-4 h-14 px-4 border-b bg-card">
        <TooltipProvider delayDuration={200}>
          <div className="flex items-center gap-2">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => setSidebarOpen(!sidebarOpen)}
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
              onAudioUpload={handleAudioUpload}
              onTranscriptUpload={handleTranscriptUpload}
              audioFileName={audioFile?.name}
              transcriptFileName={transcriptRef?.name}
              transcriptLoaded={segments.length > 0}
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
                      onClick={() => activateSession(session.key)}
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
                  onClick={undo}
                  disabled={!canUndo()}
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
                  onClick={redo}
                  disabled={!canRedo()}
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
                  onClick={() => setShowShortcuts(true)}
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
                  onClick={() => setShowExport(true)}
                  disabled={segments.length === 0}
                  data-testid="button-export"
                >
                  <Download className="h-4 w-4 mr-2" />
                  Export
                </Button>
              </TooltipTrigger>
              <TooltipContent>Export transcript</TooltipContent>
            </Tooltip>
            <Separator orientation="vertical" className="h-6" />
            <Popover open={confidencePopoverOpen} onOpenChange={setConfidencePopoverOpen}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <PopoverTrigger asChild>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        setHighlightLowConfidence((prev) => !prev);
                        setConfidencePopoverOpen(true);
                      }}
                      aria-pressed={highlightLowConfidence}
                      aria-label="Toggle low confidence highlight"
                      data-testid="button-toggle-confidence"
                      className={cn(
                        "px-2",
                        highlightLowConfidence && "bg-accent text-accent-foreground",
                      )}
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
                      setManualConfidenceThreshold(value[0] ?? 0.4);
                      setHighlightLowConfidence(true);
                    }}
                  />
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>
                      {lowConfidenceThreshold === null
                        ? "No scores"
                        : `Now: ${lowConfidenceThreshold.toFixed(2)}`}
                    </span>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setManualConfidenceThreshold(null)}
                    >
                      Auto
                    </Button>
                  </div>
                </div>
              </PopoverContent>
            </Popover>
            <Popover open={spellcheckPopoverOpen} onOpenChange={setSpellcheckPopoverOpen}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <PopoverTrigger asChild>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setSpellcheckPopoverOpen(true)}
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
                      onClick={() => setSpellcheckEnabled(!spellcheckEnabled)}
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
                        onClick={() => setSpellcheckLanguages(["de"])}
                      >
                        DE
                      </Button>
                      <Button
                        size="sm"
                        variant={spellcheckLanguages.includes("en") ? "secondary" : "outline"}
                        onClick={() => setSpellcheckLanguages(["en"])}
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
                            onClick={() => setSpellcheckCustomEnabled(true)}
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
                          <DropdownMenuItem onClick={() => setShowCustomDictionariesDialog(true)}>
                            Manage dictionaries
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                  <Button size="sm" variant="ghost" onClick={() => setShowSpellcheckDialog(true)}>
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
                        custom dicts: {spellcheckCustomDictionaries.length} | checkers:{" "}
                        {spellcheckers.length > 0
                          ? spellcheckers.map((checker) => checker.language).join(",")
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
                  onClick={() => setShowLexicon(true)}
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

      <div className="flex flex-1 overflow-hidden">
        <aside
          className={cn(
            "w-64 border-r bg-sidebar flex-shrink-0 transition-all duration-200",
            !sidebarOpen && "w-0 overflow-hidden border-0",
          )}
        >
          <SpeakerSidebar
            speakers={speakers}
            segments={segments}
            onRenameSpeaker={handleRenameSpeaker}
            onAddSpeaker={addSpeaker}
            onMergeSpeakers={mergeSpeakers}
            onSpeakerSelect={(id) =>
              setFilterSpeakerId((current) => (current === id ? undefined : id))
            }
            onClearFilter={() => {
              setFilterSpeakerId(undefined);
              setFilterLowConfidence(false);
              setFilterBookmarked(false);
              setFilterLexicon(false);
              setFilterLexiconLowScore(false);
              setFilterSpellcheck(false);
            }}
            selectedSpeakerId={filterSpeakerId}
            lowConfidenceFilterActive={filterLowConfidence}
            onToggleLowConfidenceFilter={() => setFilterLowConfidence((current) => !current)}
            lowConfidenceThreshold={lowConfidenceThreshold}
            onLowConfidenceThresholdChange={(value) => {
              setManualConfidenceThreshold(value);
              setHighlightLowConfidence(true);
            }}
            bookmarkFilterActive={filterBookmarked}
            onToggleBookmarkFilter={() => setFilterBookmarked((current) => !current)}
            lexiconFilterActive={filterLexicon}
            onToggleLexiconFilter={() => setFilterLexicon((current) => !current)}
            lexiconMatchCount={lexiconMatchCount}
            lexiconLowScoreMatchCount={lexiconLowScoreMatchCount}
            lexiconLowScoreFilterActive={filterLexiconLowScore}
            onToggleLexiconLowScoreFilter={() => setFilterLexiconLowScore((current) => !current)}
            spellcheckMatchCount={spellcheckMatchCount}
            spellcheckFilterActive={filterSpellcheck}
            onToggleSpellcheckFilter={() => setFilterSpellcheck((current) => !current)}
            spellcheckEnabled={spellcheckEnabled}
            spellcheckMatchLimitReached={spellcheckMatchLimitReached}
          />
        </aside>

        <main className="flex-1 flex flex-col overflow-hidden">
          <div className="p-4 space-y-4 border-b bg-card">
            <WaveformPlayer
              audioUrl={audioUrl}
              segments={segments}
              speakers={speakers}
              currentTime={currentTime}
              isPlaying={isPlaying}
              playbackRate={playbackRate}
              showSpeakerRegions={isWhisperXFormat}
              onTimeUpdate={setCurrentTime}
              onPlayPause={setIsPlaying}
              onDurationChange={setDuration}
              onSeek={setCurrentTime}
              onSegmentBoundaryChange={updateSegmentTiming}
              onReady={handleWaveReady}
            />

            <PlaybackControls
              isPlaying={isPlaying}
              currentTime={currentTime}
              duration={duration}
              playbackRate={playbackRate}
              onPlaybackRateChange={setPlaybackRate}
              onPlayPause={handlePlayPause}
              onSeek={handleSeek}
              onSkipBack={handleSkipBack}
              onSkipForward={handleSkipForward}
              onSplitAtCurrentWord={handleSplitAtCurrentWord}
              canSplitAtCurrentWord={canSplitAtCurrentWord}
              disabled={!audioUrl}
            />
          </div>

          <ScrollArea className="flex-1">
            <div ref={transcriptListRef} className="max-w-4xl mx-auto p-4 space-y-2">
              {filteredSegments.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  {segments.length === 0 ? (
                    <>
                      <p className="text-lg font-medium mb-2">No transcript loaded</p>
                      <p className="text-sm">
                        Upload an audio file and its Whisper or WhisperX JSON transcript to get
                        started.
                      </p>
                    </>
                  ) : filterSpellcheck && activeSpeakerName ? (
                    <>
                      <p className="text-lg font-medium mb-2">
                        No spelling issues for this speaker
                      </p>
                      <p className="text-sm">Clear filters to see all segments.</p>
                    </>
                  ) : filterSpellcheck ? (
                    <>
                      <p className="text-lg font-medium mb-2">No spelling issues</p>
                      <p className="text-sm">Clear filters to see all segments.</p>
                    </>
                  ) : filterLowConfidence && activeSpeakerName ? (
                    <>
                      <p className="text-lg font-medium mb-2">
                        No low-score segments for this speaker
                      </p>
                      <p className="text-sm">
                        Adjust the threshold or clear filters to see more segments.
                      </p>
                    </>
                  ) : filterLowConfidence ? (
                    <>
                      <p className="text-lg font-medium mb-2">No low-score segments</p>
                      <p className="text-sm">
                        Adjust the threshold or clear filters to see more segments.
                      </p>
                    </>
                  ) : (
                    <>
                      <p className="text-lg font-medium mb-2">No segments for this speaker</p>
                      <p className="text-sm">Click the speaker again to show all segments.</p>
                    </>
                  )}
                </div>
              ) : (
                filteredSegments.map((segment, index) => {
                  const handlers = segmentHandlers[index];
                  const resolvedSplitWordIndex =
                    activeSegmentId === segment.id ? splitWordIndex : null;
                  return (
                    <TranscriptSegment
                      key={segment.id}
                      segment={segment}
                      speakers={speakers}
                      isSelected={segment.id === selectedSegmentId}
                      isActive={activeSegmentId === segment.id}
                      activeWordIndex={activeSegmentId === segment.id ? activeWordIndex : undefined}
                      splitWordIndex={resolvedSplitWordIndex ?? undefined}
                      highlightLowConfidence={highlightLowConfidence}
                      lowConfidenceThreshold={lowConfidenceThreshold}
                      lexiconMatches={lexiconMatchesBySegment.get(segment.id)}
                      showLexiconMatches={showLexiconMatches}
                      lexiconHighlightUnderline={effectiveLexiconHighlightUnderline}
                      lexiconHighlightBackground={effectiveLexiconHighlightBackground}
                      spellcheckMatches={spellcheckMatchesBySegment.get(segment.id)}
                      showSpellcheckMatches={showSpellcheckMatches}
                      editRequested={editRequestId === segment.id}
                      onEditRequestHandled={
                        editRequestId === segment.id ? () => setEditRequestId(null) : undefined
                      }
                      onSelect={handlers.onSelect}
                      onTextChange={handlers.onTextChange}
                      onSpeakerChange={handlers.onSpeakerChange}
                      onSplit={handlers.onSplit}
                      onConfirm={handlers.onConfirm}
                      onToggleBookmark={handlers.onToggleBookmark}
                      onIgnoreLexiconMatch={handlers.onIgnoreLexiconMatch}
                      onIgnoreSpellcheckMatch={(value) => addSpellcheckIgnoreWord(value)}
                      onMergeWithPrevious={handlers.onMergeWithPrevious}
                      onMergeWithNext={handlers.onMergeWithNext}
                      onDelete={handlers.onDelete}
                      onSeek={handleSeek}
                    />
                  );
                })
              )}
            </div>
          </ScrollArea>
        </main>
      </div>

      <KeyboardShortcuts open={showShortcuts} onOpenChange={setShowShortcuts} />
      <ExportDialog
        open={showExport}
        onOpenChange={setShowExport}
        segments={segments}
        fileName={audioFile?.name?.replace(/\.[^/.]+$/, "") || "transcript"}
      />
      <GlossaryDialog open={showLexicon} onOpenChange={setShowLexicon} />
      <SpellcheckDialog open={showSpellcheckDialog} onOpenChange={setShowSpellcheckDialog} />
      <CustomDictionariesDialog
        open={showCustomDictionariesDialog}
        onOpenChange={setShowCustomDictionariesDialog}
      />
    </div>
  );
}
