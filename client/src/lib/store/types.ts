import type { FileReference } from "@/lib/fileReference";

export interface SearchMatch {
  segmentId: string;
  startIndex: number;
  endIndex: number;
  text: string;
}

export interface Word {
  word: string;
  start: number;
  end: number;
  speaker?: string;
  score?: number;
}

export interface Segment {
  id: string;
  speaker: string;
  start: number;
  end: number;
  text: string;
  words: Word[];
  confirmed?: boolean;
  bookmarked?: boolean;
}

export interface Speaker {
  id: string;
  name: string;
  color: string;
}

export interface LexiconEntry {
  term: string;
  variants: string[];
  falsePositives: string[];
}

export type SpellcheckLanguage = "de" | "en";

export interface SpellcheckCustomDictionary {
  id: string;
  name: string;
  aff: string;
  dic: string;
}

export interface HistoryState {
  segments: Segment[];
  speakers: Speaker[];
  selectedSegmentId: string | null;
}

export interface PersistedSession {
  audioRef: FileReference | null;
  transcriptRef: FileReference | null;
  segments: Segment[];
  speakers: Speaker[];
  selectedSegmentId: string | null;
  currentTime: number;
  isWhisperXFormat: boolean;
  updatedAt?: number;
  kind?: SessionKind;
  label?: string | null;
  baseSessionKey?: string | null;
}

export interface PersistedSessionsState {
  sessions: Record<string, PersistedSession>;
  activeSessionKey: string | null;
}

export interface PersistedGlobalState {
  lexiconEntries?: LexiconEntry[];
  lexiconTerms?: string[];
  lexiconThreshold?: number;
  lexiconHighlightUnderline?: boolean;
  lexiconHighlightBackground?: boolean;
  spellcheckEnabled?: boolean;
  spellcheckLanguages?: SpellcheckLanguage[];
  spellcheckIgnoreWords?: string[];
  spellcheckCustomEnabled?: boolean;
  aiSpeakerConfig?: AISpeakerConfig;
  // Confidence highlighting
  highlightLowConfidence?: boolean;
  manualConfidenceThreshold?: number | null;
  // AI Revision config
  aiRevisionConfig?: AIRevisionConfig;
}

export interface RecentSessionSummary {
  key: string;
  audioName?: string;
  transcriptName?: string;
  updatedAt?: number;
  kind: SessionKind;
  label?: string | null;
  baseSessionKey?: string | null;
}

export interface InitialStoreState {
  audioFile: File | null;
  audioUrl: string | null;
  audioRef: FileReference | null;
  transcriptRef: FileReference | null;
  sessionKey: string;
  sessionKind: SessionKind;
  sessionLabel: string | null;
  baseSessionKey: string | null;
  recentSessions: RecentSessionSummary[];
  segments: Segment[];
  speakers: Speaker[];
  selectedSegmentId: string | null;
  currentTime: number;
  isPlaying: boolean;
  duration: number;
  seekRequestTime: number | null;
  history: HistoryState[];
  historyIndex: number;
  isWhisperXFormat: boolean;
  lexiconEntries: LexiconEntry[];
  lexiconThreshold: number;
  lexiconHighlightUnderline: boolean;
  lexiconHighlightBackground: boolean;
  spellcheckEnabled: boolean;
  spellcheckLanguages: SpellcheckLanguage[];
  spellcheckIgnoreWords: string[];
  spellcheckCustomDictionaries: SpellcheckCustomDictionary[];
  spellcheckCustomDictionariesLoaded: boolean;
  spellcheckCustomEnabled: boolean;
  // AI Speaker state
  aiSpeakerSuggestions: AISpeakerSuggestion[];
  aiSpeakerIsProcessing: boolean;
  aiSpeakerProcessedCount: number;
  aiSpeakerTotalToProcess: number;
  aiSpeakerConfig: AISpeakerConfig;
  aiSpeakerError: string | null;
  aiSpeakerAbortController: AbortController | null;
  aiSpeakerBatchInsights: AISpeakerBatchInsight[];
  aiSpeakerDiscrepancyNotice: string | null;
  aiSpeakerBatchLog: AISpeakerBatchInsight[];
  // Confidence highlighting
  highlightLowConfidence: boolean;
  manualConfidenceThreshold: number | null;
  // AI Revision state
  aiRevisionSuggestions: AIRevisionSuggestion[];
  aiRevisionIsProcessing: boolean;
  aiRevisionCurrentSegmentId: string | null;
  aiRevisionProcessedCount: number;
  aiRevisionTotalToProcess: number;
  aiRevisionConfig: AIRevisionConfig;
  aiRevisionError: string | null;
  aiRevisionAbortController: AbortController | null;
  aiRevisionLastResult: {
    segmentId: string;
    status: "success" | "no-changes" | "error";
    message?: string;
    timestamp: number;
  } | null;
}

export type TranscriptStore = InitialStoreState &
  SessionSlice &
  PlaybackSlice &
  HistorySlice &
  SegmentsSlice &
  SpeakersSlice &
  LexiconSlice &
  SpellcheckSlice &
  AISpeakerSlice &
  ConfidenceSlice &
  AIRevisionSlice;

export interface ConfidenceSlice {
  setHighlightLowConfidence: (enabled: boolean) => void;
  setManualConfidenceThreshold: (threshold: number | null) => void;
  toggleHighlightLowConfidence: () => void;
}

export interface SessionSlice {
  setAudioFile: (file: File | null) => void;
  setAudioUrl: (url: string | null) => void;
  setAudioReference: (reference: FileReference | null) => void;
  setTranscriptReference: (reference: FileReference | null) => void;
  activateSession: (key: string) => void;
  createRevision: (name: string, overwrite?: boolean) => string | null;
  deleteSession: (key: string) => void;
}

export interface PlaybackSlice {
  setCurrentTime: (time: number) => void;
  setIsPlaying: (playing: boolean) => void;
  setDuration: (duration: number) => void;
  requestSeek: (time: number) => void;
  clearSeekRequest: () => void;
}

export interface HistorySlice {
  undo: () => void;
  redo: () => void;
  canUndo: () => boolean;
  canRedo: () => boolean;
}

export interface SegmentsSlice {
  loadTranscript: (data: {
    segments: Segment[];
    speakers?: Speaker[];
    isWhisperXFormat?: boolean;
    reference?: FileReference | null;
  }) => void;
  setSelectedSegmentId: (id: string | null) => void;
  updateSegmentText: (id: string, text: string) => void;
  updateSegmentsTexts: (updates: Array<{ id: string; text: string }>) => void;
  updateSegmentSpeaker: (id: string, speaker: string) => void;
  confirmSegment: (id: string) => void;
  toggleSegmentBookmark: (id: string) => void;
  splitSegment: (id: string, wordIndex: number) => void;
  mergeSegments: (id1: string, id2: string) => string | null;
  updateSegmentTiming: (id: string, start: number, end: number) => void;
  deleteSegment: (id: string) => void;
}

export interface SpeakersSlice {
  renameSpeaker: (oldName: string, newName: string) => void;
  addSpeaker: (name: string) => void;
  mergeSpeakers: (fromName: string, toName: string) => void;
}

export interface LexiconSlice {
  setLexiconEntries: (entries: LexiconEntry[]) => void;
  addLexiconEntry: (term: string, variants?: string[], falsePositives?: string[]) => void;
  removeLexiconEntry: (term: string) => void;
  updateLexiconEntry: (
    previousTerm: string,
    term: string,
    variants?: string[],
    falsePositives?: string[],
  ) => void;
  addLexiconFalsePositive: (term: string, value: string) => void;
  setLexiconThreshold: (value: number) => void;
  setLexiconHighlightUnderline: (value: boolean) => void;
  setLexiconHighlightBackground: (value: boolean) => void;
}

export interface SpellcheckSlice {
  setSpellcheckEnabled: (enabled: boolean) => void;
  setSpellcheckLanguages: (languages: SpellcheckLanguage[]) => void;
  setSpellcheckIgnoreWords: (words: string[]) => void;
  addSpellcheckIgnoreWord: (value: string) => void;
  removeSpellcheckIgnoreWord: (value: string) => void;
  clearSpellcheckIgnoreWords: () => void;
  setSpellcheckCustomEnabled: (enabled: boolean) => void;
  loadSpellcheckCustomDictionaries: () => Promise<void>;
  addSpellcheckCustomDictionary: (
    dictionary: Omit<SpellcheckCustomDictionary, "id">,
  ) => Promise<void>;
  removeSpellcheckCustomDictionary: (id: string) => Promise<void>;
}

// ==================== AI Speaker Suggestion Types ====================

export type AISpeakerSuggestionStatus = "pending" | "accepted" | "rejected";

export interface AISpeakerSuggestion {
  segmentId: string;
  currentSpeaker: string;
  suggestedSpeaker: string;
  status: AISpeakerSuggestionStatus;
  confidence?: number;
  reason?: string;
  isNewSpeaker?: boolean;
}

export interface AISpeakerBatchIssue {
  level: "warn" | "error";
  message: string;
  context?: Record<string, unknown>;
}

export interface AISpeakerBatchInsight {
  batchIndex: number;
  batchSize: number;
  rawItemCount: number;
  unchangedAssignments: number;
  loggedAt: number;
  suggestionCount: number;
  processedTotal: number;
  totalExpected: number;
  issues: AISpeakerBatchIssue[];
  fatal: boolean;
  rawResponsePreview?: string;
  ignoredCount?: number;
  batchDurationMs?: number;
  elapsedMs?: number;
}

export type PromptType = "speaker" | "text";

export interface AIPrompt {
  id: string;
  name: string;
  type: PromptType;
  systemPrompt: string;
  userPromptTemplate: string;
  isBuiltIn: boolean;
  isDefault?: boolean;
  quickAccess: boolean;
}

export interface AIPromptExport {
  version: 1;
  prompts: Omit<AIPrompt, "id">[];
}

export interface AISpeakerConfig {
  /** @deprecated Use selectedProviderId with settings providers instead */
  ollamaUrl: string;
  /** @deprecated Use selectedProviderId with settings providers instead */
  model: string;
  batchSize: number;
  prompts: AIPrompt[];
  activePromptId: string;
  /** ID of the selected AI provider from settings */
  selectedProviderId?: string;
  /** Selected model (overrides provider default if set) */
  selectedModel?: string;
}

// Note: AI Speaker state is stored in InitialStoreState with aiSpeaker* prefix
// This slice only provides actions that work with that state
export interface AISpeakerSlice {
  startAnalysis: (selectedSpeakers: string[], excludeConfirmed: boolean) => void;
  cancelAnalysis: () => void;
  addSuggestions: (suggestions: AISpeakerSuggestion[]) => void;
  acceptSuggestion: (segmentId: string) => void;
  rejectSuggestion: (segmentId: string) => void;
  clearSuggestions: () => void;
  updateConfig: (config: Partial<AISpeakerConfig>) => void;
  addPrompt: (prompt: Omit<AIPrompt, "id">) => void;
  updatePrompt: (id: string, updates: Partial<AIPrompt>) => void;
  deletePrompt: (id: string) => void;
  setActivePrompt: (id: string) => void;
  setProcessingProgress: (processed: number, total: number) => void;
  setError: (error: string | null) => void;
  setBatchInsights: (insights: AISpeakerBatchInsight[]) => void;
  setDiscrepancyNotice: (notice: string | null) => void;
  setBatchLog: (entries: AISpeakerBatchInsight[]) => void;
}

export type SessionKind = "current" | "revision";

// ==================== AI Revision Types ====================

export type AIRevisionSuggestionStatus = "pending" | "accepted" | "rejected";

export interface TextChange {
  type: "insert" | "delete" | "replace";
  position: number;
  length?: number;
  oldText?: string;
  newText?: string;
}

export interface AIRevisionSuggestion {
  segmentId: string;
  promptId: string;
  originalText: string;
  revisedText: string;
  status: AIRevisionSuggestionStatus;
  changes: TextChange[];
  changeSummary?: string;
  reasoning?: string;
}

export interface AIRevisionConfig {
  prompts: AIPrompt[];
  defaultPromptId: string | null;
  quickAccessPromptIds: string[];
}

export interface AIRevisionSlice {
  // State is in InitialStoreState with aiRevision* prefix
  // Actions
  startSingleRevision: (segmentId: string, promptId: string) => void;
  startBatchRevision: (segmentIds: string[], promptId: string) => void;
  cancelRevision: () => void;
  acceptRevision: (segmentId: string) => void;
  rejectRevision: (segmentId: string) => void;
  acceptAllRevisions: () => void;
  rejectAllRevisions: () => void;
  clearRevisions: () => void;
  // Prompt management
  addRevisionPrompt: (prompt: Omit<AIPrompt, "id">) => void;
  updateRevisionPrompt: (id: string, updates: Partial<AIPrompt>) => void;
  deleteRevisionPrompt: (id: string) => void;
  setDefaultRevisionPrompt: (id: string | null) => void;
  setQuickAccessPrompts: (ids: string[]) => void;
  toggleQuickAccessPrompt: (id: string) => void;
}
