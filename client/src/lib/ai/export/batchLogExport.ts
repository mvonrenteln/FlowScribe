import type { BatchLogRow } from "@/components/shared/BatchLog/BatchLog";
import type { AIRevisionBatchLogEntry } from "@/lib/store/types";

export type BatchLogExportFeatureType =
  | "speaker-classification"
  | "segment-merge"
  | "chapter-detection"
  | "revision";

export interface BatchLogExportRow {
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

export interface RevisionLogExportRow {
  segmentId: string;
  status: string;
  loggedAt: number;
  durationMs?: number;
  error?: string;
  errorCode?: string;
  requestPayload: undefined;
  responsePayload?: string;
}

export interface BatchLogExport<TRow> {
  exportedAt: string;
  featureType: BatchLogExportFeatureType;
  batches: TRow[];
}

export function mapBatchLogRowToExport(row: BatchLogRow): BatchLogExportRow {
  return {
    id: row.id,
    batchLabel: row.batchLabel,
    expected: row.expected,
    returned: row.returned,
    durationMs: row.durationMs,
    used: row.used,
    ignored: row.ignored,
    suggestions: row.suggestions,
    unchanged: row.unchanged,
    skipped: row.skipped,
    processed: row.processed,
    issues: row.issues,
    loggedAt: row.loggedAt,
    requestPayload: row.requestPayload,
    responsePayload: row.responsePayload,
  };
}

export function mapRevisionLogEntryToExport(entry: AIRevisionBatchLogEntry): RevisionLogExportRow {
  return {
    segmentId: entry.segmentId,
    status: entry.status,
    loggedAt: entry.loggedAt,
    durationMs: entry.durationMs,
    error: entry.error,
    errorCode: entry.errorCode,
    requestPayload: undefined,
    responsePayload: entry.responsePayload,
  };
}

export function buildBatchLogExport<TRow>(
  featureType: BatchLogExportFeatureType,
  rows: TRow[],
): BatchLogExport<TRow> {
  return {
    exportedAt: new Date().toISOString(),
    featureType,
    batches: rows,
  };
}

export function downloadAsJson(data: unknown, filename: string): void {
  const json = JSON.stringify(data, null, 2);
  const blob = new Blob([json], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  try {
    const a = document.createElement("a");
    a.href = url;
    a.download = `${filename}.json`;
    a.click();
  } finally {
    URL.revokeObjectURL(url);
  }
}

export function exportBatchLog(
  featureType: BatchLogExportFeatureType,
  rows: BatchLogRow[],
  filename: string,
): void {
  const payload = buildBatchLogExport(featureType, rows.map(mapBatchLogRowToExport));
  downloadAsJson(payload, filename);
}

export function exportRevisionBatchLog(rows: AIRevisionBatchLogEntry[], filename: string): void {
  const payload = buildBatchLogExport("revision", rows.map(mapRevisionLogEntryToExport));
  downloadAsJson(payload, filename);
}
