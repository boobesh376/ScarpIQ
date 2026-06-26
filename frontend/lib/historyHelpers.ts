/**
 * historyHelpers.ts
 * Reusable utilities for the History page.
 * No external libraries — pure TypeScript.
 */

import type { AnalysisRecord } from "./api";

// ─── Export Utilities ─────────────────────────────────────────────────────────

/**
 * Columns to export (in order), with display labels.
 */
const EXPORT_COLUMNS: { key: keyof AnalysisRecord; label: string }[] = [
  { key: "id",               label: "ID" },
  { key: "created_at",       label: "Date" },
  { key: "material",         label: "Material" },
  { key: "category",         label: "Category" },
  { key: "subtype",          label: "Subtype" },
  { key: "condition",        label: "Condition" },
  { key: "cleanliness",      label: "Cleanliness" },
  { key: "weight",           label: "Weight (kg)" },
  { key: "final_price",      label: "Final Price (₹)" },
  { key: "confidence_level", label: "Confidence" },
  { key: "summary",          label: "Summary" },
  { key: "is_pinned",        label: "Pinned" },
];

/**
 * Triggers a browser file download with the given content.
 */
function triggerDownload(content: string, filename: string, mimeType: string): void {
  const blob = new Blob([content], { type: mimeType });
  const url  = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href     = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Export filtered analysis records as a JSON file.
 */
export function exportToJSON(records: AnalysisRecord[], filename = "scrapiq-history.json"): void {
  const content = JSON.stringify(records, null, 2);
  triggerDownload(content, filename, "application/json");
}

/**
 * Escape a CSV cell value — wraps in quotes and escapes internal quotes.
 */
function csvCell(value: unknown): string {
  if (value === null || value === undefined) return "";
  const str = String(value);
  // Wrap in quotes if contains comma, newline, or quote
  if (str.includes(",") || str.includes("\n") || str.includes('"')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/**
 * Export filtered analysis records as a CSV file.
 */
export function exportToCSV(records: AnalysisRecord[], filename = "scrapiq-history.csv"): void {
  const header = EXPORT_COLUMNS.map((c) => csvCell(c.label)).join(",");
  const rows   = records.map((r) =>
    EXPORT_COLUMNS.map((c) => csvCell(r[c.key])).join(",")
  );
  const content = [header, ...rows].join("\n");
  triggerDownload(content, filename, "text/csv;charset=utf-8;");
}

// ─── Filename with Date Stamp ─────────────────────────────────────────────────

/**
 * Returns a date-stamped filename, e.g. "scrapiq-history-2026-05-09.json"
 */
export function timestampedFilename(ext: "json" | "csv"): string {
  const date = new Date().toISOString().slice(0, 10);
  return `scrapiq-history-${date}.${ext}`;
}