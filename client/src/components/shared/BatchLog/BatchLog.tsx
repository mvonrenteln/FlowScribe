import React from "react";
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

export type BatchLogSortKey = "batch" | "time" | "expected";

interface BatchLogProps {
  rows: BatchLogRow[];
  sortBy?: BatchLogSortKey;
  compact?: boolean;
}

const formatDuration = (durationMs?: number) =>
  durationMs ? `${(durationMs / 1000).toFixed(2)}s` : "—";

const formatNumber = (value?: number) => (typeof value === "number" ? value : "—");

export function BatchLog({ rows, sortBy = "batch", compact = false }: BatchLogProps) {
  const sorted = React.useMemo(() => {
    const copy = [...rows];
    switch (sortBy) {
      case "time":
        return copy.sort((a, b) => (b.loggedAt ?? 0) - (a.loggedAt ?? 0));
      case "expected":
        return copy.sort((a, b) => (b.expected ?? 0) - (a.expected ?? 0));
      case "batch":
      default:
        return copy.sort((a, b) => (Number(a.batchLabel) || 0) - (Number(b.batchLabel) || 0));
    }
  }, [rows, sortBy]);

  return (
    <div className={compact ? "text-sm" : ""}>
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
          {sorted.map((row) => (
            <TableRow key={row.id} data-testid={`batchrow-${row.id}`}>
              <TableCell>{row.batchLabel}</TableCell>
              <TableCell>{formatNumber(row.expected)}</TableCell>
              <TableCell>
                <span>
                  {formatNumber(row.returned)}
                  {row.ignored && row.ignored > 0 && (
                    <span className="ml-2 text-[11px] text-muted-foreground">(+{row.ignored})</span>
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
  );
}

export default BatchLog;
