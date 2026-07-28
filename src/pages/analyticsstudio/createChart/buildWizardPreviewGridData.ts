import type { ReactNode } from "react";

export interface WizardPreviewGridInput {
  chartData?: Array<{
    category: string;
    value: number;
    originalData?: Record<string, unknown>;
  }>;
  rawResponse?: Record<string, unknown> | null;
}

export interface WizardPreviewTableColumn {
  key: string;
  header: ReactNode;
  align?: "left" | "center" | "right";
  sortable?: boolean;
  filterable?: boolean;
  shrink?: boolean;
}

function normalizeGridRow(row: unknown): Record<string, unknown> {
  if (row && typeof row === "object" && !Array.isArray(row)) {
    const record = row as Record<string, unknown>;
    if (
      record.originalData &&
      typeof record.originalData === "object" &&
      !Array.isArray(record.originalData)
    ) {
      return record.originalData as Record<string, unknown>;
    }
    return record;
  }
  return { value: row };
}

function flattenPivotRawData(rawData: Record<string, unknown>, rawResponse?: Record<string, unknown> | null) {
  const rowDims = Array.isArray(rawResponse?.rows)
    ? rawResponse.rows
    : rawResponse?.rows && typeof rawResponse.rows === "object"
      ? Object.values(rawResponse.rows)
      : [];

  const norm =
    Object.keys(rawData).length === 1 &&
    rawData[Object.keys(rawData)[0]] &&
    typeof rawData[Object.keys(rawData)[0]] === "object"
      ? (rawData[Object.keys(rawData)[0]] as Record<string, Record<string, unknown>>)
      : (rawData as Record<string, Record<string, unknown>>);

  const rowDimSet = new Set(rowDims as string[]);
  const metricKeys = Object.keys(norm).filter((key) => !rowDimSet.has(key));
  const firstDim = rowDims[0];
  const rowIndexSource = norm[String(firstDim)] ?? norm[metricKeys[0]];
  if (!rowIndexSource || typeof rowIndexSource !== "object") return [];

  const rowIndices = Object.keys(rowIndexSource).sort((a, b) => Number(a) - Number(b));
  const out: Record<string, unknown>[] = [];

  for (const idx of rowIndices) {
    const row: Record<string, unknown> = {};
    for (const dim of rowDims) {
      row[String(dim)] = norm[String(dim)]?.[idx];
    }
    for (const key of metricKeys) {
      row[key] = norm[key]?.[idx];
    }
    out.push(row);
  }

  return out;
}

/** Full row-level preview data — mirrors analytics DataPreviewDialog row extraction. */
export function buildWizardPreviewRows({
  chartData,
  rawResponse,
}: WizardPreviewGridInput): Record<string, unknown>[] {
  const rawData = rawResponse?.data;

  if (Array.isArray(rawData) && rawData.length > 0) {
    return rawData.map((row) => normalizeGridRow(row));
  }

  if (rawData && typeof rawData === "object" && !Array.isArray(rawData)) {
    try {
      const flattened = flattenPivotRawData(rawData as Record<string, unknown>, rawResponse);
      if (flattened.length > 0) return flattened;
    } catch {
      return [];
    }
  }

  if (!Array.isArray(chartData) || chartData.length === 0) return [];
  return chartData.map((row) => normalizeGridRow(row));
}

export function wizardPreviewHasTableData(input: WizardPreviewGridInput): boolean {
  return buildWizardPreviewRows(input).length > 0;
}

export function buildWizardPreviewTableColumns(
  rows: Record<string, unknown>[],
  rawResponse?: Record<string, unknown> | null,
): WizardPreviewTableColumn[] {
  const first = rows[0] ?? {};
  const keysFromRows = Object.keys(first).filter((key) => key !== "originalData");
  const keysFromRawColumns = Array.isArray(rawResponse?.columns)
    ? rawResponse.columns.map((column) => String(column))
    : [];

  const keys = keysFromRawColumns.length > 0 ? keysFromRawColumns : keysFromRows;

  return keys.map((key) => ({
    key,
    header: key,
    sortable: true,
    filterable: false,
    align: "left",
    shrink: true,
  }));
}
