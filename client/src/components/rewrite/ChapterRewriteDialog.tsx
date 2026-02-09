/**
 * Chapter Rewrite Dialog
 *
 * Dialog for selecting a rewrite prompt and starting chapter rewrite.
 */

import { Loader2, Sparkles } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { initializeSettings } from "@/lib/settings/settingsStorage";
import { useTranscriptStore } from "@/lib/store";
import type { AIPrompt } from "@/lib/store/types";

interface ChapterRewriteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  chapterId: string;
  onStartRewrite: () => void;
}

export function ChapterRewriteDialog({
  open,
  onOpenChange,
  chapterId,
  onStartRewrite,
}: ChapterRewriteDialogProps) {
  const chapterDetectionConfig = useTranscriptStore((s) => s.aiChapterDetectionConfig);
  const chapter = useTranscriptStore((s) => s.chapters.find((item) => item.id === chapterId));
  const prompts = useMemo(
    () =>
      chapterDetectionConfig.prompts.filter(
        (prompt) => prompt.type === "chapter-detect" && prompt.operation === "rewrite",
      ),
    [chapterDetectionConfig.prompts],
  );
  const startRewrite = useTranscriptStore((s) => s.startRewrite);
  const isProcessing = useTranscriptStore((s) => s.rewriteInProgress);
  const processingChapterId = useTranscriptStore((s) => s.rewriteChapterId);
  const updateRewriteConfig = useTranscriptStore((s) => s.updateRewriteConfig);

  // Local state
  const defaultPromptId = useMemo(() => {
    if (
      chapter?.rewritePromptId &&
      prompts.some((prompt) => prompt.id === chapter.rewritePromptId)
    ) {
      return chapter.rewritePromptId;
    }
    return prompts[0]?.id ?? "";
  }, [chapter?.rewritePromptId, prompts]);
  const [selectedPromptId, setSelectedPromptId] = useState<string>(defaultPromptId);
  const [settings] = useState(() => initializeSettings());

  // Provider/Model selection
  const defaultProviderId =
    settings.defaultAIProviderId ?? settings.aiProviders.find((p) => p.isDefault)?.id;
  const defaultProvider =
    settings.aiProviders.find((p) => p.id === defaultProviderId) ?? settings.aiProviders[0];
  const defaultModel = defaultProvider
    ? (defaultProvider.model ?? defaultProvider.availableModels?.[0])
    : undefined;

  const [selectedProvider, setSelectedProvider] = useState<string | undefined>(
    () => chapterDetectionConfig.selectedProviderId ?? defaultProvider?.id,
  );
  const [selectedModel, setSelectedModel] = useState<string | undefined>(
    () => chapterDetectionConfig.selectedModel ?? defaultModel,
  );

  useEffect(() => {
    if (open) return;
    document.body.style.pointerEvents = "";
    document.documentElement.style.pointerEvents = "";
  }, [open]);

  // Update model when provider changes
  useEffect(() => {
    if (!selectedProvider) return;
    const provider = settings.aiProviders.find((p) => p.id === selectedProvider);
    if (!provider) return;

    const firstModel = provider.model ?? provider.availableModels?.[0];
    setSelectedModel(firstModel);
  }, [selectedProvider, settings.aiProviders]);

  // Get quick access prompts
  const quickAccessPrompts = prompts.filter((prompt) => prompt.quickAccess);
  const otherPrompts = prompts.filter((prompt) => !prompt.quickAccess);
  const allSelectablePrompts = [...quickAccessPrompts, ...otherPrompts];

  useEffect(() => {
    if (!open) return;
    const promptIsValid = selectedPromptId
      ? prompts.some((prompt) => prompt.id === selectedPromptId)
      : false;
    if ((!selectedPromptId || !promptIsValid) && defaultPromptId) {
      setSelectedPromptId(defaultPromptId);
    }
  }, [open, selectedPromptId, defaultPromptId, prompts]);

  const isProcessingThis = isProcessing && processingChapterId === chapterId;

  const handleStart = useCallback(() => {
    if (!selectedPromptId) return;

    // Update config with selections
    updateRewriteConfig({
      selectedProviderId: selectedProvider,
      selectedModel,
    });

    // Start rewrite to set processing state
    startRewrite(chapterId, selectedPromptId);

    // Close dialog and open view - parent component handles the transition
    onStartRewrite();
    onOpenChange(false);
  }, [
    selectedPromptId,
    selectedProvider,
    selectedModel,
    chapterId,
    updateRewriteConfig,
    startRewrite,
    onStartRewrite,
    onOpenChange,
  ]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5" />
            Rewrite Chapter
          </DialogTitle>
          <DialogDescription>
            Select a prompt and start reformulating the chapter.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Quick Access Prompts */}
          {quickAccessPrompts.length > 0 && (
            <div className="space-y-2">
              <Label className="text-xs font-semibold uppercase text-muted-foreground">
                Quick Access
              </Label>
              <div className="grid gap-2">
                {quickAccessPrompts.map((prompt: AIPrompt) => (
                  <Button
                    key={prompt.id}
                    variant={selectedPromptId === prompt.id ? "default" : "outline"}
                    className="justify-start text-left h-auto py-2"
                    onClick={() => setSelectedPromptId(prompt.id)}
                  >
                    <div>
                      <div className="font-medium">{prompt.name}</div>
                      <div className="text-xs text-muted-foreground line-clamp-1">
                        {prompt.userPromptTemplate?.split("\n")[0] ?? ""}
                      </div>
                    </div>
                  </Button>
                ))}
              </div>
            </div>
          )}

          {/* All Prompts Dropdown */}
          {allSelectablePrompts.length > 0 && (
            <div className="space-y-2">
              <Label htmlFor="prompt-select" className="text-sm">
                Prompt
              </Label>
              <Select value={selectedPromptId} onValueChange={setSelectedPromptId}>
                <SelectTrigger id="prompt-select">
                  <SelectValue placeholder="Prompt auswählen" />
                </SelectTrigger>
                <SelectContent>
                  {allSelectablePrompts.map((prompt: AIPrompt) => (
                    <SelectItem key={prompt.id} value={prompt.id}>
                      {prompt.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Provider Selection */}
          <div className="space-y-2">
            <Label htmlFor="provider-select" className="text-sm">
              Provider
            </Label>
            <Select value={selectedProvider} onValueChange={setSelectedProvider}>
              <SelectTrigger id="provider-select">
                <SelectValue placeholder="Provider auswählen" />
              </SelectTrigger>
              <SelectContent>
                {settings.aiProviders.map((provider) => (
                  <SelectItem key={provider.id} value={provider.id}>
                    {provider.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Model Selection */}
          {selectedProvider && (
            <div className="space-y-2">
              <Label htmlFor="model-select" className="text-sm">
                Modell
              </Label>
              <Select value={selectedModel} onValueChange={setSelectedModel}>
                <SelectTrigger id="model-select">
                  <SelectValue placeholder="Modell auswählen" />
                </SelectTrigger>
                <SelectContent>
                  {settings.aiProviders
                    .find((p) => p.id === selectedProvider)
                    ?.availableModels?.map((model) => (
                      <SelectItem key={model} value={model}>
                        {model}
                      </SelectItem>
                    )) ??
                    (() => {
                      const provider = settings.aiProviders.find((p) => p.id === selectedProvider);
                      return (
                        provider?.model && (
                          <SelectItem value={provider.model}>{provider.model}</SelectItem>
                        )
                      );
                    })()}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isProcessingThis}>
            Cancel
          </Button>
          <Button onClick={handleStart} disabled={isProcessingThis || !selectedPromptId}>
            {isProcessingThis ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Processing...
              </>
            ) : (
              <>
                <Sparkles className="mr-2 h-4 w-4" />
                Start
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
