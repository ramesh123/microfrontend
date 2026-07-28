import {
  isBigNumberVisualization,
  transformBigNumberChartData,
} from "@/pages/charts/components/charts/bigNumber";

export interface WizardChartPreviewData {
  chartData: Array<{ category: string; value: number; originalData: Record<string, unknown> }>;
  rawChartResponse: Record<string, unknown> | null;
}

function flattenPivotResponse(resp: Record<string, unknown>): Record<string, unknown>[] {
  const rows = Array.isArray(resp.rows) ? resp.rows : Object.values(resp.rows || {});
  let norm = resp.data as Record<string, Record<string, unknown>>;
  if (
    norm &&
    Object.keys(norm).length === 1 &&
    norm[Object.keys(norm)[0]] &&
    typeof norm[Object.keys(norm)[0]] === "object"
  ) {
    norm = norm[Object.keys(norm)[0]] as Record<string, Record<string, unknown>>;
  }

  const rowDimSet = new Set(rows as string[]);
  const metricKeys = Object.keys(norm || {}).filter((k) => !rowDimSet.has(k));
  const firstRowDim = (rows as string[])[0];
  const rowIndexSource = norm?.[firstRowDim] ?? (metricKeys[0] ? norm?.[metricKeys[0]] : null);
  const rowIndices =
    rowIndexSource && typeof rowIndexSource === "object"
      ? Object.keys(rowIndexSource).sort((a, b) => Number(a) - Number(b))
      : [];
  const flattened: Record<string, unknown>[] = [];

  for (const idx of rowIndices) {
    const row: Record<string, unknown> = {};
    for (const dim of rows as string[]) {
      const colData = norm?.[dim];
      row[dim] =
        colData && typeof colData === "object" && idx in colData ? colData[idx] : "";
    }
    for (const colKey of metricKeys) {
      const colData = norm?.[colKey];
      row[colKey] =
        colData && typeof colData === "object" && idx in colData ? colData[idx] : null;
    }
    flattened.push(row);
  }

  return flattened.length > 0 ? flattened : [resp];
}

export function parseWizardChartResponse(
  resp: Record<string, unknown>,
  chartHint: string,
  payloadMetrics?: unknown,
): WizardChartPreviewData {
  const isPivotResponse =
    resp.rows &&
    resp.columns &&
    resp.data &&
    typeof resp.data === "object" &&
    !Array.isArray(resp.data);

  if (isPivotResponse) {
    return {
      rawChartResponse: resp,
      chartData: flattenPivotResponse(resp) as WizardChartPreviewData["chartData"],
    };
  }

  let rawChartResponse: Record<string, unknown> | null = null;
  if (resp.columns || resp.dimensions || resp.hierarchy) {
    rawChartResponse = resp;
  }

  const respXAxis = (resp.x_axis || resp.xAxis) as string | null;
  const responseData = Array.isArray(resp.data) ? resp.data : [];
  const responseMetrics = resp.metrics || payloadMetrics;

  if (isBigNumberVisualization(chartHint)) {
    return {
      rawChartResponse: rawChartResponse ?? resp,
      chartData: transformBigNumberChartData(responseData, {
        columns: resp.columns as string[] | undefined,
        x_axis: respXAxis,
        metrics: Array.isArray(responseMetrics) ? responseMetrics : undefined,
      }) as WizardChartPreviewData["chartData"],
    };
  }

  const transformedData = responseData
    .map((item: Record<string, unknown>, index: number) => {
      const keys = Object.keys(item);
      const isAggregatedColumn = (key: string) => key.includes("(") && key.includes(")");

      const aggregatedKey = keys.find((key) => {
        if (!isAggregatedColumn(key)) return false;
        const val = item[key];
        return typeof val === "number" && !Number.isNaN(val);
      });

      let valueKey = aggregatedKey;
      if (!valueKey) {
        valueKey = keys.find((key) => {
          if (respXAxis && key === respXAxis) return false;
          const val = item[key];
          return typeof val === "number" && !Number.isNaN(val);
        });
      }

      const apiColumns = (resp.columns as string[] | undefined) || keys;
      const dimensionKeys = apiColumns.filter(
        (k) => !isAggregatedColumn(k) && k !== "value" && k !== valueKey,
      );

      let category: string;
      if (dimensionKeys.length > 0) {
        category =
          dimensionKeys
            .map((k) => {
              const v = item[k];
              return v === null || v === undefined ? "—" : String(v).trim();
            })
            .filter((v) => v !== "")
            .join(", ") ||
          (respXAxis && item[respXAxis] != null ? String(item[respXAxis]) : `Item ${index + 1}`);
      } else if (respXAxis && item[respXAxis] !== undefined && item[respXAxis] !== null) {
        category = String(item[respXAxis]);
      } else if (valueKey) {
        const baseName = valueKey.replace(/\(.*\)/, "").trim();
        category = baseName || `Value ${index + 1}`;
      } else {
        category = `Item ${index + 1}`;
      }

      const value = valueKey ? Number(item[valueKey]) : Number.NaN;
      if (!valueKey || value === null || Number.isNaN(value)) {
        return null;
      }

      return { category, value, originalData: item };
    })
    .filter(Boolean) as WizardChartPreviewData["chartData"];

  return {
    chartData: transformedData,
    rawChartResponse: rawChartResponse ?? (responseData.length > 0 ? resp : null),
  };
}
