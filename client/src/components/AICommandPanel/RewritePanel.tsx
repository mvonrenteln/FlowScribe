import { Check, Sparkles, StopCircle, XCircle } from "lucide-react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { ChapterRewriteView } from "@/components/rewrite/ChapterRewriteView";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { exportRewriteBatchLog } from "@/lib/ai/export/batchLogExport";
import { useTranscriptStore } from "@/lib/store";
import { buildSegmentIndexMap, sortChaptersByStart } from "@/lib/store/utils/chapters";
import { AIBatchControlSection } from "./AIBatchControlSection";
import { AIConfigurationSection } from "./AIConfigurationSection";
import { AIResultsSection } from "./AIResultsSection";
import { BatchLogDrawer } from "./BatchLogDrawer";
import { useAiSettingsSelection } from "./hooks/useAiSettingsSelection";
import { ResultsList } from "./ResultsList";
import { truncateText } from "./utils/truncateText";

interface RewritePanelProps {
  onOpenSettings: () => void;
}

export function RewritePanel({ onOpenSettings }: Readonly<RewritePanelProps>) {
  const { t } = useTranslation();
  const chapters = useTranscriptStore((s) => s.chapters);
  const segments = useTranscriptStore((s) => s.segments);
  const config = useTranscriptStore((s) => s.aiChapterDetectionConfig);
  const rewriteDraftByChapterId = useTranscriptStore((s) => s.rewriteDraftByChapterId);
  const isProcessing = useTranscriptStore((s) => s.batchRewriteIsProcessing);
  const isCancelling = useTranscriptStore((s) => s.batchRewriteIsCancelling);
  const processedCount = useTranscriptStore((s) => s.batchRewriteProcessedCount);
  const totalCount = useTranscriptStore((s) => s.batchRewriteTotalCount);
  const error = useTranscriptStore((s) => s.batchRewriteError);
  const batchLog = useTranscriptStore((s) => s.batchRewriteLog);
  const startBatchRewrite = useTranscriptStore((s) => s.startBatchRewrite);
  const cancelBatchRewrite = useTranscriptStore((s) => s.cancelBatchRewrite);
  const acceptAllBatchRewrites = useTranscriptStore((s) => s.acceptAllBatchRewrites);
  const rejectAllBatchRewrites = useTranscriptStore((s) => s.rejectAllBatchRewrites);
  const updateChapterDetectionConfig = useTranscriptStore((s) => s.updateChapterDetectionConfig);

  const rewritePrompts = config.prompts.filter(
    (prompt) => prompt.operation === "rewrite" && (prompt.rewriteScope ?? "chapter") === "chapter",
  );
  const [selectedPromptId, setSelectedPromptId] = useState(() => rewritePrompts[0]?.id ?? "");
  const [customInstructions, setCustomInstructions] = useState("");
  const [skipAlreadyRewritten, setSkipAlreadyRewritten] = useState(false);
  const [activeViewChapterId, setActiveViewChapterId] = useState<string | null>(null);
  const [isLogOpen, setIsLogOpen] = useState(false);

  const { settings, selectedProviderId, selectedModel, selectProvider, setSelectedModel } =
    useAiSettingsSelection({
      initialProviderId: config.selectedProviderId ?? "",
      initialModel: config.selectedModel ?? "",
    });

  useEffect(() => {
    if (!selectedPromptId && rewritePrompts[0]) {
      setSelectedPromptId(rewritePrompts[0].id);
    }
  }, [rewritePrompts, selectedPromptId]);

  const indexMap = buildSegmentIndexMap(segments);
  const sortedChapters = sortChaptersByStart(chapters, indexMap);
  const chaptersToProcess = skipAlreadyRewritten
    ? sortedChapters.filter(
        (chapter) => !chapter.rewrittenText && !rewriteDraftByChapterId[chapter.id],
      )
    : sortedChapters;
  const draftsWithChapters = sortedChapters.filter(
    (chapter) => !!rewriteDraftByChapterId[chapter.id],
  );

  const handleStart = () => {
    updateChapterDetectionConfig({
      selectedProviderId: selectedProviderId || undefined,
      selectedModel: selectedModel || undefined,
    });
    startBatchRewrite({
      promptId: selectedPromptId,
      customInstructions: customInstructions.trim() || undefined,
      skipAlreadyRewritten,
    });
  };

  return (
    <div className="space-y-6">
      <section className="space-y-3">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {t("rewriteBatch.scopeTitle")}
        </h3>
        <p className="text-sm text-muted-foreground">
          {chapters.length > 0
            ? t("rewriteBatch.chaptersCount", { count: chaptersToProcess.length })
            : t("rewriteBatch.noChaptersInTranscript")}
        </p>
        <div className="flex items-start gap-2">
          <Checkbox
            id="rewrite-skip-existing"
            checked={skipAlreadyRewritten}
            onCheckedChange={(checked) => setSkipAlreadyRewritten(checked === true)}
            disabled={isProcessing}
          />
          <div className="grid gap-1 leading-none">
            <Label htmlFor="rewrite-skip-existing" className="text-sm">
              {t("rewriteBatch.skipAlreadyRewritten")}
            </Label>
            <p className="text-xs text-muted-foreground">
              {t("rewriteBatch.skipAlreadyRewrittenHelp")}
            </p>
          </div>
        </div>
      </section>

      <AIConfigurationSection
        id="rewrite"
        settings={settings}
        selectedProviderId={selectedProviderId}
        selectedModel={selectedModel}
        isProcessing={isProcessing}
        promptValue={selectedPromptId}
        promptOptions={rewritePrompts}
        showBatchSize={false}
        onProviderChange={(value) => {
          selectProvider(value);
          updateChapterDetectionConfig({
            selectedProviderId: value || undefined,
            selectedModel: undefined,
          });
        }}
        onModelChange={(value) => {
          setSelectedModel(value);
          updateChapterDetectionConfig({ selectedModel: value || undefined });
        }}
        onPromptChange={setSelectedPromptId}
        onOpenSettings={onOpenSettings}
      />

      <section className="space-y-2">
        <Label htmlFor="rewrite-custom-instructions" className="text-xs text-muted-foreground">
          {t("rewriteBatch.customInstructions.label")}
        </Label>
        <Textarea
          id="rewrite-custom-instructions"
          value={customInstructions}
          onChange={(event) => setCustomInstructions(event.target.value)}
          placeholder={t("rewriteBatch.customInstructions.placeholder")}
          disabled={isProcessing}
        />
      </section>

      <AIBatchControlSection
        isProcessing={isProcessing}
        isCancelling={isCancelling}
        processedCount={processedCount}
        totalToProcess={totalCount}
        progressUnitLabel={t("rewriteBatch.units.chapters")}
        error={error}
        startAction={{
          label: t("aiBatch.actions.startBatch"),
          icon: <Sparkles className="mr-2 h-4 w-4" />,
          onClick: handleStart,
          disabled: !selectedPromptId || chaptersToProcess.length === 0,
        }}
        stopAction={{
          label: t("aiBatch.actions.stop"),
          icon: <StopCircle className="mr-2 h-4 w-4" />,
          onClick: cancelBatchRewrite,
          variant: "destructive",
        }}
      >
        {batchLog.length > 0 ? (
          <BatchLogDrawer
            rows={batchLog.map((entry, index) => ({
              id: `${entry.chapterId}-${entry.loggedAt}-${index}`,
              batchLabel: entry.chapterTitle,
              expected: 1,
              returned: entry.status === "done" ? 1 : 0,
              durationMs: entry.durationMs ?? 1,
              suggestions: 0,
              unchanged: 0,
              skipped: entry.status === "skipped" ? 1 : 0,
              processed: t(`rewriteBatch.status.${entry.status}`),
              issues: entry.error ?? t("aiBatch.batchLog.emptyIssue"),
              loggedAt: entry.loggedAt,
            }))}
            featureType="chapter-rewrite"
            open={isLogOpen}
            onOpenChange={setIsLogOpen}
            total={totalCount}
            title={t("rewriteBatch.batchLogTitle")}
            description={t("rewriteBatch.batchLogDescription")}
            triggerLabel={t("rewriteBatch.batchLogTriggerLabel")}
            onExport={() => {
              const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
              exportRewriteBatchLog(batchLog, `batch-log-chapter-rewrite-${timestamp}`);
            }}
          />
        ) : null}
      </AIBatchControlSection>

      {draftsWithChapters.length > 0 ? (
        <AIResultsSection
          title={t("rewriteBatch.results.draftsTitle", { count: draftsWithChapters.length })}
        >
          <ResultsList
            items={draftsWithChapters}
            getKey={(chapter) => chapter.id}
            onActivate={(chapter) => setActiveViewChapterId(chapter.id)}
            getItemTitle={(chapter) => chapter.title}
            renderItem={(chapter) => (
              <>
                <span className="flex-1 truncate text-muted-foreground min-w-0">
                  {truncateText(chapter.title, 40)}
                </span>
                <span className="flex-1 truncate text-muted-foreground min-w-0">
                  {truncateText(rewriteDraftByChapterId[chapter.id]?.text ?? "", 60)}
                </span>
              </>
            )}
          />
          <div className="flex gap-2">
            <Button variant="outline" size="sm" className="flex-1" onClick={rejectAllBatchRewrites}>
              <XCircle className="mr-2 h-4 w-4" />
              {t("aiBatch.actions.rejectAll")}
            </Button>
            <Button size="sm" className="flex-1" onClick={acceptAllBatchRewrites}>
              <Check className="mr-2 h-4 w-4" />
              {t("aiBatch.actions.acceptAll")}
            </Button>
          </div>
        </AIResultsSection>
      ) : null}

      {activeViewChapterId ? (
        <ChapterRewriteView
          chapterId={activeViewChapterId}
          onClose={() => setActiveViewChapterId(null)}
        />
      ) : null}
    </div>
  );
}
