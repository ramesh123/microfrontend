import type { ChartFormParameter, CreateChartPayload } from '../Visualization/API/chartsApi';
import {
  extractColumnName,
  getNestedValue,
  resolveMetricNested,
  isChartFormAuxiliaryParamKey,
  stripChartFormAuxKeysFromParams,
} from './ChartFormulator/utils';

function formValueKeyMatchesChartParams(key: string, params: ChartFormParameter[]): boolean {
  const keys = params.map((p) => p.key);
  if (keys.includes(key)) return true;
  return keys.some((pk) => key.startsWith(`${pk}_`));
}

function parseParamsFromNode(nodePayload: Record<string, any>): Record<string, any> {
  let raw = nodePayload?.chart_data?.params ?? nodePayload?.params ?? {};
  if (typeof raw === 'string') {
    if (raw.includes('{{')) return {};
    try {
      raw = JSON.parse(raw);
    } catch {
      return {};
    }
  }
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    return { ...raw };
  }
  return {};
}

/**
 * Merge saved workflow node params with live ChartConfigurator form values.
 * Used for save-chart (ChartSelector) and workflow node execute so payloads match the current form.
 */
export function buildWorkflowChartParamsFromNodeAndForm(args: {
  nodePayload: Record<string, any>;
  formValues: Record<string, any>;
  formParams: ChartFormParameter[];
}): CreateChartPayload['params'] {
  const { nodePayload, formValues = {}, formParams = [] } = args;
  const base = parseParamsFromNode(nodePayload);
  const params: Record<string, any> = { ...base };

  const viz = String(nodePayload?.visualization_name || '').toLowerCase();
  const isPivotChart =
    viz.includes('pivot') || formParams.some((p) => p.key === 'rows' || p.key === 'columns');
  const formHasXAxisField = formParams.some((p) => p.key === 'x-axis' || p.key === 'X-axis');
  const formHasDimensionsField = formParams.some((p) => p.key === 'dimensions');
  const isSunburstChart = viz.includes('sunburst');

  if (formParams.length && formValues && typeof formValues === 'object') {
    for (const key of Object.keys(formValues)) {
      if (isChartFormAuxiliaryParamKey(key)) continue;
      if (!formValueKeyMatchesChartParams(key, formParams)) continue;
      const structural = new Set([
        'metric',
        'metrics',
        'mtric',
        'dimensions',
        'x-axis',
        'X-axis',
        'rows',
        'columns',
        'filters',
        'hierarchy',
        'apply_metrics_on',
      ]);
      if (structural.has(key)) continue;
      const v = formValues[key];
      if (v !== undefined && v !== null) {
        params[key] = v;
      }
    }
  }

  params.source = (formValues.source ?? params.source ?? base.source ?? '') as string;
  params.limit =
    formValues.limit != null && formValues.limit !== ''
      ? Number(formValues.limit)
      : (params.limit ?? base.limit ?? undefined);
  params.is_drilldown = false;

  if (isPivotChart) {
    const hasRows =
      formValues.rows &&
      ((Array.isArray(formValues.rows) && formValues.rows.length > 0) ||
        (!Array.isArray(formValues.rows) && formValues.rows));
    if (hasRows) {
      const rowsValue = formValues.rows;
      const rowsArr = Array.isArray(rowsValue) ? rowsValue : rowsValue ? [rowsValue] : [];
      params.rows = rowsArr.map((col: any) => extractColumnName(col)).filter(Boolean) as string[];
    }
    const hasCols =
      formValues.columns &&
      ((Array.isArray(formValues.columns) && formValues.columns.length > 0) ||
        (!Array.isArray(formValues.columns) && formValues.columns));
    if (hasCols) {
      const columnsValue = formValues.columns;
      const columnsArr = Array.isArray(columnsValue) ? columnsValue : columnsValue ? [columnsValue] : [];
      params.columns = columnsArr.map((col: any) => extractColumnName(col)).filter(Boolean) as string[];
    }
    if (formValues.apply_metrics_on != null) {
      params.apply_metrics_on = formValues.apply_metrics_on || 'columns';
    }
    if (formValues.filters && Array.isArray(formValues.filters) && formValues.filters.length > 0) {
      params.filters = formValues.filters
        .map((col: any, idx: number) => {
          const colName = extractColumnName(col);
          if (!colName) return null;
          const operator = getNestedValue(formValues, 'filters', 'operator', idx) || '=';
          const value = getNestedValue(formValues, 'filters', 'value', idx);
          return { columns: colName, operator, value };
        })
        .filter((f: any) => f && f.columns && f.value !== undefined);
    } else if (formValues.filters !== undefined) {
      params.filters = [];
    }
  }

  if (formValues.metric || formValues.metrics || formValues.mtric) {
    const metricValue = formValues.metric || formValues.metrics || formValues.mtric;
    const metricColumns = Array.isArray(metricValue) ? metricValue : metricValue ? [metricValue] : [];
    if (metricColumns.length > 0) {
      params.metrics = metricColumns
        .map((col: any, idx: number) => {
          const colName = extractColumnName(col);
          if (!colName) return null;
          const operation = (resolveMetricNested(formValues, formParams, 'operation', idx, col) as string) || '';
          const alias = resolveMetricNested(formValues, formParams, 'alias', idx, col) as string | null;
          return {
            columns: colName,
            operation,
            ...(alias && { alias }),
          };
        })
        .filter((m: any) => m && m.columns);
    }
  }

  const xAxisFromForm = formValues['x-axis'] ?? formValues['X-axis'];
  if (!isPivotChart && formHasXAxisField && xAxisFromForm) {
    const xAxisValue = xAxisFromForm;
    const xAxisCol = Array.isArray(xAxisValue) ? xAxisValue[0] : xAxisValue;
    const xAxisColName = extractColumnName(xAxisCol);
    const alias =
      getNestedValue(formValues, 'x-axis', 'alias') ||
      getNestedValue(formValues, 'x-axis', 'label') ||
      getNestedValue(formValues, 'X-axis', 'alias') ||
      getNestedValue(formValues, 'X-axis', 'label');
    if (xAxisColName) {
      const xObj: any = { columns: xAxisColName };
      if (alias) xObj.alias = alias;
      params['X-axis'] = [xObj];
    }
  }

  if (!isPivotChart && formHasDimensionsField && formValues.dimensions) {
    const dimValue = formValues.dimensions;
    const dimColumns = Array.isArray(dimValue) ? dimValue : dimValue ? [dimValue] : [];
    params.dimensions = dimColumns
      .map((col: any, idx: number) => {
        const colName = extractColumnName(col);
        if (!colName) return null;
        const alias = getNestedValue(formValues, 'dimensions', 'alias', idx);
        return {
          columns: colName,
          ...(alias && { alias }),
        };
      })
      .filter((d: any) => d && d.columns);
  }

  if (!isPivotChart && isSunburstChart && formValues.hierarchy) {
    const hierarchyValue = formValues.hierarchy;
    const hierarchyColumns = Array.isArray(hierarchyValue)
      ? hierarchyValue
      : hierarchyValue
        ? [hierarchyValue]
        : [];
    params.dimensions = hierarchyColumns
      .map((col: any) => {
        const colName = extractColumnName(col);
        return colName ? { columns: colName } : null;
      })
      .filter((h: any) => h);
  }

  if (params.dimensions && Array.isArray(params.dimensions)) {
    const seen = new Set<string>();
    params.dimensions = params.dimensions.filter((d: any) => {
      const key = String(d.columns || '').toLowerCase();
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  delete params.group_by;

  if (!isPivotChart && formValues.filters) {
    const filterValue = formValues.filters;
    const filterColumns = Array.isArray(filterValue) ? filterValue : filterValue ? [filterValue] : [];
    params.filters = filterColumns
      .map((col: any, idx: number) => {
        const colName = extractColumnName(col);
        if (!colName) return null;
        const operator = getNestedValue(formValues, 'filters', 'operator', idx) || '=';
        const value = getNestedValue(formValues, 'filters', 'value', idx);
        return {
          columns: colName,
          operator,
          value,
        };
      })
      .filter((f: any) => f && f.columns && f.value);
  }

  const cleaned = stripChartFormAuxKeysFromParams(params) as Record<string, any>;
  // API type requires `source` (workflow charts often use empty string — upstream data via node_id).
  return {
    ...cleaned,
    source: String(cleaned.source ?? ''),
  } as CreateChartPayload['params'];
}
