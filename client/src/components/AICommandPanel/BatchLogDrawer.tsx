import { useRef } from "react";
import BatchLog, { BatchLogRow } from "@/components/shared/BatchLog/BatchLog";
import { Button } from "@/components/ui/button";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer";

export interface BatchLogRow {
  id: string;
  batchLabel: string;
  expected?: number;
  returned?: number;
  durationMs?: number;
  used?: number;
  ignored?: number;
  suggestions?: number;
  unchanged?: number;
  processed?: string;
  issues?: string;
  loggedAt: number;
}

interface BatchLogDrawerProps {
  rows: BatchLogRow[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: string;
  description?: string;
  triggerLabel?: string;
}

const formatDuration = (durationMs?: number) =>
  durationMs ? `${(durationMs / 1000).toFixed(2)}s` : "—";

const formatNumber = (value?: number) => (typeof value === "number" ? value : "—");

export function BatchLogDrawer({
  rows,
  open,
  onOpenChange,
  title = "Batch Log",
  description = "Batch processing summary and issues.",
  triggerLabel = "Batch Log",
}: BatchLogDrawerProps) {
  const logDrawerRef = useRef<HTMLDivElement>(null);
  const hasRows = rows.length > 0;

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerTrigger asChild>
        <Button variant="ghost" size="sm" disabled={!hasRows}>
          {triggerLabel} ({rows.length})
        </Button>
      </DrawerTrigger>
      <DrawerContent
        ref={logDrawerRef}
        className="h-[80vh] sm:h-[40vh] lg:h-[40vh] max-h-[80vh] sm:max-h-[40vh] lg:max-h-[40vh]"
        tabIndex={-1}
        onOpenAutoFocus={(event) => {
          event.preventDefault();
          logDrawerRef.current?.focus();
        }}
      >
        <DrawerHeader>
          <DrawerTitle>{title}</DrawerTitle>
          <DrawerDescription className="sr-only">{description}</DrawerDescription>
        </DrawerHeader>
        <div className="px-6 pb-6 flex-1 overflow-hidden">
          <div className="h-full overflow-auto">
            <BatchLog rows={rows} />
          </div>
        </div>
      </DrawerContent>
    </Drawer>
  );
}
