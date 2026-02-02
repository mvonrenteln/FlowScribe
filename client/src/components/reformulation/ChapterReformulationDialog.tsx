/**
 * Chapter Reformulation Dialog
 *
 * Dialog for selecting a reformulation prompt and starting chapter reformulation.
 */

import { Loader2, Sparkles } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
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
import { useStore } from "@/lib/store";

interface ChapterReformulationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  chapterId: string;
  onStartReformulation: () => void;
}

export function ChapterReformulationDialog({
  open,
  onOpenChange,
  chapterId,
  onStartReformulation,
}: ChapterReformulationDialogProps) {
  const prompts = useStore((s) => s.reformulationPrompts);
  const quickAccessIds = useStore((s) => s.reformulationConfig.quickAccessPromptIds);
  const defaultPromptId = useStore((s) => s.reformulationConfig.defaultPromptId);
  const reformulationConfig = useStore((s) => s.reformulationConfig);
  const startReformulation = useStore((s) => s.startReformulation);
  const isProcessing = useStore((s) => s.reformulationInProgress);
  const processingChapterId = useStore((s) => s.reformulationChapterId);
  const updateReformulationConfig = useStore((s) => s.updateReformulationConfig);

  // Local state
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
    () => reformulationConfig.selectedProviderId ?? defaultProvider?.id,
  );
  const [selectedModel, setSelectedModel] = useState<string | undefined>(
    () => reformulationConfig.selectedModel ?? defaultModel,
  );

  // Update model when provider changes
  useEffect(() => {
    if (!selectedProvider) return;
    const provider = settings.aiProviders.find((p) => p.id === selectedProvider);
    if (!provider) return;

    const firstModel = provider.model ?? provider.availableModels?.[0];
    setSelectedModel(firstModel);
  }, [selectedProvider, settings.aiProviders]);

  // Get quick access prompts
  const quickAccessPrompts = prompts.filter((p) => quickAccessIds.includes(p.id));
  const otherPrompts = prompts.filter((p) => !quickAccessIds.includes(p.id));
  const allSelectablePrompts = [...quickAccessPrompts, ...otherPrompts];

  const isProcessingThis = isProcessing && processingChapterId === chapterId;

  const handleStart = useCallback(async () => {
    if (!selectedPromptId) return;

    // Update config with selections
    updateReformulationConfig({
      selectedProviderId: selectedProvider,
      selectedModel,
    });

    // Start reformulation
    await startReformulation(chapterId, selectedPromptId);

    // Notify parent and trigger view
    onStartReformulation();
    onOpenChange(false);
  }, [
    selectedPromptId,
    selectedProvider,
    selectedModel,
    chapterId,
    updateReformulationConfig,
    startReformulation,
    onStartReformulation,
    onOpenChange,
  ]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5" />
            Kapitel umformulieren
          </DialogTitle>
          <DialogDescription>
            Wähle einen Prompt und starte die Umformulierung des Kapitels.
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
                {quickAccessPrompts.map((prompt) => (
                  <Button
                    key={prompt.id}
                    variant={selectedPromptId === prompt.id ? "default" : "outline"}
                    className="justify-start text-left h-auto py-2"
                    onClick={() => setSelectedPromptId(prompt.id)}
                  >
                    <div>
                      <div className="font-medium">{prompt.name}</div>
                      <div className="text-xs text-muted-foreground line-clamp-1">
                        {prompt.instructions.split("\n")[0]}
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
                  {allSelectablePrompts.map((prompt) => (
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
                    (settings.aiProviders.find((p) => p.id === selectedProvider)?.model && (
                      <SelectItem
                        value={settings.aiProviders.find((p) => p.id === selectedProvider)!.model!}
                      >
                        {settings.aiProviders.find((p) => p.id === selectedProvider)!.model}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isProcessingThis}>
            Abbrechen
          </Button>
          <Button onClick={handleStart} disabled={isProcessingThis || !selectedPromptId}>
            {isProcessingThis ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Umformuliere...
              </>
            ) : (
              <>
                <Sparkles className="mr-2 h-4 w-4" />
                Starten
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
