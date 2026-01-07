import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";

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
      <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Scope
      </h3>
      <div className="text-sm text-foreground">
        {isFiltered ? "Filtered" : "All"}: {scopedSegmentCount} segment
        {scopedSegmentCount === 1 ? "" : "s"}
      </div>
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Checkbox
          id={checkboxId}
          checked={excludeConfirmed}
          onCheckedChange={(value) => onExcludeConfirmedChange(Boolean(value))}
        />
        <Label htmlFor={checkboxId} className="text-sm text-muted-foreground">
          Exclude confirmed
        </Label>
      </div>
    </section>
  );
}
