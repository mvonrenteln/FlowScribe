import { useTranslation } from "react-i18next";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface ScopeSectionProps {
  scopedSegmentCount: number;
  isFiltered: boolean;
  excludeConfirmed: boolean;
  onExcludeConfirmedChange: (value: boolean) => void;
  id: string;
}

export function ScopeSection({
  scopedSegmentCount,
  isFiltered,
  excludeConfirmed,
  onExcludeConfirmedChange,
  id,
}: ScopeSectionProps) {
  const { t } = useTranslation();
  const checkboxId = `${id}-exclude-confirmed`;
  const scopeLabel = isFiltered ? t("aiBatch.scope.filtered") : t("aiBatch.scope.all");
  const countLabel =
    scopedSegmentCount === 1
      ? t("aiBatch.scope.count", { count: scopedSegmentCount, label: scopeLabel })
      : t("aiBatch.scope.count_plural", { count: scopedSegmentCount, label: scopeLabel });

  return (
    <section className="space-y-3">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {t("aiBatch.scope.title")}
      </h3>
      <div className="text-sm text-foreground">{countLabel}</div>
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="flex items-center gap-2">
                <Checkbox
                  id={checkboxId}
                  checked={excludeConfirmed}
                  onCheckedChange={(value) => onExcludeConfirmedChange(Boolean(value))}
                />
                <Label
                  htmlFor={checkboxId}
                  className="text-sm text-muted-foreground cursor-pointer"
                >
                  {t("aiBatch.scope.excludeConfirmed")}
                </Label>
              </div>
            </TooltipTrigger>
            <TooltipContent>
              <p>{t("aiBatch.scope.excludeConfirmedHelp")}</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>
    </section>
  );
}
