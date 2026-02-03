import React from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatDurationMs } from "@/lib/formatting";

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
  skipped?: number;
  processed?: string;
  issues?: string;
  loggedAt: number;
  requestPayload?: string;
  responsePayload?: string;
}

export type BatchLogSortKey = "batch" | "time" | "expected";

interface BatchLogProps {
  rows: BatchLogRow[];
  sortBy?: BatchLogSortKey;
  compact?: boolean;
  total?: number; // optional fixed total to use for Processed calculation
}

const formatDuration = (durationMs?: number) => formatDurationMs(durationMs);

const formatNumber = (value?: number) => (typeof value === "number" ? value : "—");

const PayloadButton = ({ label, payload }: { label: string; payload?: string }) => {
  const content = payload?.length ? payload : "No payload captured for this batch.";
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm">
          View
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>{label}</DialogTitle>
        </DialogHeader>
        <ScrollArea className="h-[60vh]">
          <pre className="whitespace-pre-wrap text-xs text-muted-foreground">{content}</pre>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
};

export function BatchLog({ rows, sortBy = "batch", compact = false, total }: BatchLogProps) {
  const sorted = React.useMemo(() => {
    const copy = [...rows];
    switch (sortBy) {
      case "time":
        return copy.sort((a, b) => (b.loggedAt ?? 0) - (a.loggedAt ?? 0));
      case "expected":
        return copy.sort((a, b) => (b.expected ?? 0) - (a.expected ?? 0));
      default:
        return copy.sort((a, b) => (Number(a.batchLabel) || 0) - (Number(b.batchLabel) || 0));
    }
  }, [rows, sortBy]);

  return (
    <div className={compact ? "text-sm" : ""}>
      <div className="w-full">
        <div className="h-full overflow-auto">
          <Table>
            <TableHeader className="sticky top-0 z-10 bg-background">
              <TableRow>
                <TableHead>Batch</TableHead>
                <TableHead>Skipped</TableHead>
                <TableHead>Expected</TableHead>
                <TableHead>Returned</TableHead>
                <TableHead>Duration</TableHead>
                <TableHead>Suggestions</TableHead>
                <TableHead>Unchanged</TableHead>
                <TableHead>Processed</TableHead>
                <TableHead>Issues</TableHead>
                <TableHead>Request</TableHead>
                <TableHead>Response</TableHead>
                <TableHead>Time</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(() => {
                const fallbackTotal = sorted.reduce(
                  (sum, row) => sum + (row.expected ?? 0) + (row.skipped ?? 0),
                  0,
                );
                const effectiveTotal = typeof total === "number" ? total : fallbackTotal;
                let processedSoFar = 0;

                return sorted.map((row, idx) => {
                  const skipped = row.skipped ?? 0;
                  const returned = row.returned ?? 0;
                  const expected = row.expected ?? 0;
                  processedSoFar += expected + skipped;
                  return (
                    <TableRow key={row.id} data-testid={`batchrow-${row.id}`}>
                      <TableCell>{idx + 1}</TableCell>
                      <TableCell>{formatNumber(skipped)}</TableCell>
                      <TableCell>{formatNumber(row.expected)}</TableCell>
                      <TableCell>{formatNumber(returned)}</TableCell>
                      <TableCell>{formatDuration(row.durationMs)}</TableCell>
                      <TableCell>{formatNumber(row.suggestions)}</TableCell>
                      <TableCell>{formatNumber(row.unchanged)}</TableCell>
                      <TableCell>{`${processedSoFar} / ${effectiveTotal}`}</TableCell>
                      <TableCell>{row.issues ?? "—"}</TableCell>
                      <TableCell>
                        <PayloadButton
                          label={`Batch ${row.batchLabel} Request`}
                          payload={row.requestPayload}
                        />
                      </TableCell>
                      <TableCell>
                        <PayloadButton
                          label={`Batch ${row.batchLabel} Response`}
                          payload={row.responsePayload}
                        />
                      </TableCell>
                      <TableCell>{new Date(row.loggedAt).toLocaleTimeString()}</TableCell>
                    </TableRow>
                  );
                });
              })()}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}

export default BatchLog;
