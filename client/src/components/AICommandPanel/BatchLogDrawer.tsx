import { useRef } from "react";
import { useTranslation } from "react-i18next";
import BatchLog, { type BatchLogRow } from "@/components/shared/BatchLog/BatchLog";
import { Button } from "@/components/ui/button";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer";

interface BatchLogDrawerProps {
  rows: BatchLogRow[];
  total?: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: string;
  description?: string;
  triggerLabel?: string;
}

export function BatchLogDrawer({
  rows,
  total,
  open,
  onOpenChange,
  title,
  description,
  triggerLabel,
}: BatchLogDrawerProps) {
  const { t } = useTranslation();
  const logDrawerRef = useRef<HTMLDivElement>(null);
  const hasRows = rows.length > 0;
  const resolvedTitle = title ?? t("aiBatch.batchLog.title");
  const resolvedDescription = description ?? t("aiBatch.batchLog.description");
  const resolvedTriggerLabel = triggerLabel ?? t("aiBatch.batchLog.title");

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerTrigger asChild>
        <Button variant="ghost" size="sm" disabled={!hasRows}>
          {resolvedTriggerLabel} ({rows.length})
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
          <DrawerTitle>{resolvedTitle}</DrawerTitle>
          <DrawerDescription className="sr-only">{resolvedDescription}</DrawerDescription>
        </DrawerHeader>
        <div className="px-6 pb-6 flex-1 overflow-hidden">
          <div className="h-full overflow-auto">
            <BatchLog rows={rows} total={total} />
          </div>
        </div>
      </DrawerContent>
    </Drawer>
  );
}
