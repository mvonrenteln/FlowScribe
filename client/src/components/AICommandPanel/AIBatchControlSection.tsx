import { AlertCircle } from "lucide-react";
import type { ReactNode } from "react";
import { Button, type ButtonProps } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";

interface BatchAction {
  label: string;
  icon: ReactNode;
  onClick: () => void;
  variant?: ButtonProps["variant"];
  disabled?: boolean;
}

interface AIBatchControlSectionProps {
  isProcessing: boolean;
  processedCount: number;
  totalToProcess: number;
  progressUnitLabel?: string;
  error?: string | null;
  startAction: BatchAction;
  stopAction: BatchAction;
  secondaryAction?: BatchAction;
  children?: ReactNode;
}

export function AIBatchControlSection({
  isProcessing,
  processedCount,
  totalToProcess,
  progressUnitLabel = "segments",
  error,
  startAction,
  stopAction,
  secondaryAction,
  children,
}: AIBatchControlSectionProps) {
  const progressPercent =
    totalToProcess > 0 ? Math.round((processedCount / totalToProcess) * 100) : 0;

  return (
    <section className="space-y-3">
      {isProcessing && (
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span>Processing...</span>
            <span>
              {processedCount} / {totalToProcess} {progressUnitLabel}
            </span>
          </div>
          <Progress value={progressPercent} className="h-2" />
        </div>
      )}

      {error && (
        <div className="flex items-center gap-2 p-2 rounded-md bg-destructive/10 text-destructive text-sm">
          <AlertCircle className="h-4 w-4" />
          {error}
        </div>
      )}

      {children}

      <div className="flex items-center gap-2">
        {isProcessing ? (
          <Button
            onClick={stopAction.onClick}
            variant={stopAction.variant ?? "outline"}
            className="flex-1"
          >
            {stopAction.icon}
            {stopAction.label}
          </Button>
        ) : (
          <Button
            onClick={startAction.onClick}
            variant={startAction.variant ?? "default"}
            disabled={startAction.disabled}
            className="flex-1"
          >
            {startAction.icon}
            {startAction.label}
          </Button>
        )}
        {secondaryAction ? (
          <Button
            onClick={secondaryAction.onClick}
            variant={secondaryAction.variant ?? "outline"}
            disabled={secondaryAction.disabled}
            className="flex-1"
          >
            {secondaryAction.icon}
            {secondaryAction.label}
          </Button>
        ) : null}
      </div>
    </section>
  );
}
