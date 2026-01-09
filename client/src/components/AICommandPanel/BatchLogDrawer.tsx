import { useRef } from "react";
import { Button } from "@/components/ui/button";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

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
        className="max-h-[70vh]"
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
        <div className="px-6 pb-6 overflow-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Batch</TableHead>
                <TableHead>Expected</TableHead>
                <TableHead>Returned</TableHead>
                <TableHead>Duration</TableHead>
                <TableHead>Used</TableHead>
                <TableHead>Ignored</TableHead>
                <TableHead>Suggestions</TableHead>
                <TableHead>Unchanged</TableHead>
                <TableHead>Processed</TableHead>
                <TableHead>Issues</TableHead>
                <TableHead>Time</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={row.id}>
                  <TableCell>{row.batchLabel}</TableCell>
                  <TableCell>{formatNumber(row.expected)}</TableCell>
                  <TableCell>
                    <span>
                      {formatNumber(row.returned)}
                      {row.ignored && row.ignored > 0 && (
                        <span className="ml-2 text-[11px] text-muted-foreground">
                          (+{row.ignored})
                        </span>
                      )}
                    </span>
                  </TableCell>
                  <TableCell>{formatDuration(row.durationMs)}</TableCell>
                  <TableCell>{formatNumber(row.used)}</TableCell>
                  <TableCell>{formatNumber(row.ignored)}</TableCell>
                  <TableCell>{formatNumber(row.suggestions)}</TableCell>
                  <TableCell>{formatNumber(row.unchanged)}</TableCell>
                  <TableCell>{row.processed ?? "—"}</TableCell>
                  <TableCell>{row.issues ?? "—"}</TableCell>
                  <TableCell>{new Date(row.loggedAt).toLocaleTimeString()}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </DrawerContent>
    </Drawer>
  );
}
