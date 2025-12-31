/**
 * Confidence Settings
 *
 * Configuration UI for confidence highlighting including:
 * - Enable/disable confidence highlighting
 * - Manual confidence threshold slider
 * - Auto-threshold reset
 */

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { useTranscriptStore } from "@/lib/store";

export function ConfidenceSettings() {
  // Store state
  const highlightLowConfidence = useTranscriptStore((s) => s.highlightLowConfidence);
  const setHighlightLowConfidence = useTranscriptStore((s) => s.setHighlightLowConfidence);
  const manualConfidenceThreshold = useTranscriptStore((s) => s.manualConfidenceThreshold);
  const setManualConfidenceThreshold = useTranscriptStore((s) => s.setManualConfidenceThreshold);

  const handleResetThreshold = () => {
    setManualConfidenceThreshold(null);
  };

  const displayThreshold = manualConfidenceThreshold ?? 0.4;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Confidence Highlighting</CardTitle>
          <CardDescription>
            Highlight words with low transcription confidence to help identify potential errors.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="confidence-enabled">Enable Confidence Highlighting</Label>
              <p className="text-xs text-muted-foreground">
                Highlights words below the confidence threshold
              </p>
            </div>
            <Switch
              id="confidence-enabled"
              checked={highlightLowConfidence}
              onCheckedChange={setHighlightLowConfidence}
            />
          </div>

          <Separator />

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label htmlFor="confidence-threshold">Confidence Threshold</Label>
              <span className="text-sm font-mono" aria-live="polite">
                {manualConfidenceThreshold === null
                  ? "Auto"
                  : `${(manualConfidenceThreshold * 100).toFixed(0)}%`}
              </span>
            </div>
            <Slider
              id="confidence-threshold"
              aria-label="Confidence threshold"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={Math.round(displayThreshold * 100)}
              aria-valuetext={
                manualConfidenceThreshold === null
                  ? "Auto"
                  : `${(manualConfidenceThreshold * 100).toFixed(0)} percent`
              }
              value={[displayThreshold]}
              min={0}
              max={1}
              step={0.05}
              disabled={!highlightLowConfidence}
              onValueChange={(value) => {
                setManualConfidenceThreshold(value[0] ?? 0.4);
              }}
            />
            <div className="flex items-center justify-between">
              <p className="text-xs text-muted-foreground">
                Words with confidence below this threshold will be highlighted.
              </p>
              <Button
                size="sm"
                variant="outline"
                onClick={handleResetThreshold}
                disabled={manualConfidenceThreshold === null}
              >
                Reset to Auto
              </Button>
            </div>
          </div>

          {manualConfidenceThreshold === null && (
            <p className="text-xs text-muted-foreground bg-muted/50 p-2 rounded">
              <strong>Auto mode:</strong> The threshold is automatically calculated based on the
              confidence distribution in the current transcript (10th percentile, max 40%).
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
