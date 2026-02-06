import { AlertCircle, Loader2 } from "lucide-react";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
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
  isCancelling?: boolean;
  processedCount: number;
  totalToProcess: number;
  progressUnitLabel?: string;
  error?: string | null;
  startAction: BatchAction;
  stopAction: BatchAction;
  cancellingLabel?: string;
  secondaryAction?: BatchAction;
  children?: ReactNode;
}

export function AIBatchControlSection({
  isProcessing,
  isCancelling = false,
  processedCount,
  totalToProcess,
  progressUnitLabel,
  error,
  startAction,
  stopAction,
  cancellingLabel,
  secondaryAction,
  children,
}: AIBatchControlSectionProps) {
  const { t } = useTranslation();
  const resolvedUnitLabel = progressUnitLabel ?? t("aiBatch.units.segments");
  const resolvedCancellingLabel = cancellingLabel ?? t("aiBatch.control.cancelling");
  const progressPercent =
    totalToProcess > 0 ? Math.round((processedCount / totalToProcess) * 100) : 0;

  return (
    <section className="space-y-3">
      {isProcessing && (
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span>{t("aiBatch.control.processing")}</span>
            <span>
              {t("aiBatch.control.progress", {
                processed: processedCount,
                total: totalToProcess,
                unit: resolvedUnitLabel,
              })}
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
            disabled={isCancelling}
          >
            {isCancelling ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : stopAction.icon}
            {isCancelling ? resolvedCancellingLabel : stopAction.label}
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
