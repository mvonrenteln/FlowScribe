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
  const checkboxId = `${id}-exclude-confirmed`;

  return (
    <section className="space-y-3">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Scope</h3>
      <div className="text-sm text-foreground">
        {isFiltered ? "Filtered" : "All"}: {scopedSegmentCount} segment
        {scopedSegmentCount === 1 ? "" : "s"}
      </div>
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
                  Exclude confirmed
                </Label>
              </div>
            </TooltipTrigger>
            <TooltipContent>
              <p>Skip segments that are already marked as confirmed</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>
    </section>
  );
}
