import React, { useMemo } from 'react';
import { ChartType, Config } from './ChartConfigurator';
import { PieChart } from './charts/pie';
import { RadiusPieChart } from './charts/variableRadiusPie';
import {
  isPieDonutOrRadiusPieChart,
  isRadiusPieChart,
  isDonutChartType,
  normalizePieLikeChartRows,
  extractDashboardChartResponseRows,
  pickBestPieLikeChartRows,
} from '../chartVizTypes';
import { BarChart } from './charts/bar';
import { LineChart } from './charts/line';
import { AreaChart } from './charts/area';
import { GaugeChart } from './charts/gauge';
import { FunnelChart } from './charts/funnel';
import { SunburstChart, type SunburstChartInput } from './charts/sunburst';
import {
  BigNumberChart,
  BigNumberStreamChart,
  isBigNumberVisualization,
  resolveBigNumberChartData,
  transformBigNumberChartData,
} from './charts/bigNumber';
import { BigNumberFormulatorPreviewFrame } from './charts/bigNumber/components/BigNumberFormulatorPreviewFrame';
import { resolveBigNumberLayoutMode } from './charts/bigNumber/utils/bigNumberMultiMetricData';
import type { BigNumberResponsiveLayoutMode } from './charts/bigNumber/utils/bigNumberResponsiveScale';
import { TableChart } from './charts/table';
import { PivotChart } from './charts/pivot';
import { normalizeChartMetrics, type ChartMetricParam } from './charts/chartAxisTitleUtils';

interface AmChartProps {
  chart: ChartType | null;
  data: any[];
  config: Config;
  onChartInteraction?: (field: string, value: any, originalData?: any, eventDimensionFields?: string[], eventDrillFilters?: Array<{ column: string; value: any }>) => void;
  showLegend?: boolean;
  rawResponse?: { x_axis?: string; data?: Array<Record<string, any>>; columns?: string[]; metrics?: ChartMetricParam[] } | null;
  /** Chart params from create/saved chart API (metrics alias/columns for y-axis title). */
  chartParams?: { metrics?: unknown; metric?: unknown; mtric?: unknown } | null;
  customizationOptions?: any;
  /** Dashboard: use saved chart customization only (no live window panel overrides) */
  useSavedCustomizationOnly?: boolean;
  /** Formulator: render Big Number as a compact card instead of filling the preview pane */
  previewMode?: 'compact' | 'full';
}

/** Transform API raw response (rows + columns) into [{ category, value, originalData }] for pie/funnel when parent chartData is empty (e.g. view mode). */
function transformRawResponseToCategoryValue(
  rawResponse: { data?: Array<Record<string, any>>; columns?: string[]; x_axis?: string; metrics?: ChartMetricParam[] } | null | undefined,
  chartHint?: string,
): Array<{ category: string; value: number; originalData: any }> {
  if (!rawResponse) return [];

  const rows = extractDashboardChartResponseRows(rawResponse);
  if (rows.length === 0) return [];

  if (isBigNumberVisualization(chartHint)) {
    return transformBigNumberChartData(rows, {
      columns: rawResponse.columns,
      x_axis: rawResponse.x_axis,
      metrics: rawResponse.metrics,
    });
  }

  if (isPieDonutOrRadiusPieChart(chartHint)) {
    return normalizePieLikeChartRows(rows, rawResponse.columns);
  }

  const apiColumns = rawResponse.columns || (rows[0] ? Object.keys(rows[0]) : []);
  const isAggregatedColumn = (key: string) => key.includes('(') && key.includes(')');
  const respXAxis = rawResponse.x_axis || null;

  return rows
    .map((item: any, index: number) => {
      const keys = Object.keys(item);
      const aggregatedKey = keys.find((k) => isAggregatedColumn(k) && typeof item[k] === 'number' && !isNaN(item[k]));
      let valueKey = aggregatedKey ?? keys.find((k) => respXAxis !== k && typeof item[k] === 'number' && !isNaN(item[k]));
      const dimensionKeys = apiColumns.filter(
        (k) => !isAggregatedColumn(k) && k !== 'value' && k !== valueKey
      );
      let category: string;
      if (dimensionKeys.length > 0) {
        category = dimensionKeys
          .map((k) => (item[k] == null ? '—' : String(item[k]).trim()))
          .filter((v) => v !== '')
          .join(', ') || (respXAxis && item[respXAxis] != null ? String(item[respXAxis]) : `Item ${index + 1}`);
      } else if (respXAxis && item[respXAxis] != null) {
        category = String(item[respXAxis]);
      } else if (valueKey) {
        category = valueKey.replace(/\(.*\)/, '').trim() || `Value ${index + 1}`;
      } else {
        category = `Item ${index + 1}`;
      }
      const value = valueKey ? Number(item[valueKey]) : NaN;
      if (!valueKey || isNaN(value)) return null;
      return { category, value, originalData: item };
    })
    .filter((item): item is { category: string; value: number; originalData: any } => item !== null);
}

function resolvePieLikeChartData(
  rawResponse: AmChartProps['rawResponse'],
  vizHint: string,
  fallbackRows?: any[],
): Array<{ category: string; value: number; originalData: any }> {
  const columns = rawResponse?.columns;
  const candidates: Array<Array<{ category: string; value: number; originalData: any }>> = [];

  const rawRows = rawResponse ? extractDashboardChartResponseRows(rawResponse) : [];
  if (rawRows.length > 0) {
    const fromRaw = normalizePieLikeChartRows(rawRows, columns);
    if (fromRaw.length > 0) candidates.push(fromRaw);
  }

  if (Array.isArray(fallbackRows) && fallbackRows.length > 0) {
    const fromFallback = normalizePieLikeChartRows(fallbackRows, columns);
    if (fromFallback.length > 0) candidates.push(fromFallback);
  }

  if (candidates.length > 0) {
    return pickBestPieLikeChartRows(candidates);
  }

  return transformRawResponseToCategoryValue(rawResponse ?? undefined, vizHint);
}

export function AmChart({
  chart,
  data,
  config,
  onChartInteraction,
  showLegend = false,
  rawResponse,
  chartParams,
  customizationOptions,
  useSavedCustomizationOnly = false,
  previewMode = 'full',
}: AmChartProps) {
  const resolvedMetricsFromSaved = useMemo(() => {
    const fromRaw = normalizeChartMetrics(rawResponse?.metrics);
    if (fromRaw.length) return fromRaw;
    const fromParams = normalizeChartMetrics(
      chartParams?.metrics ?? chartParams?.metric ?? chartParams?.mtric,
    );
    if (fromParams.length) return fromParams;
    const fromCustomization = normalizeChartMetrics(
      (customizationOptions as { params?: { metrics?: unknown } } | undefined)?.params?.metrics,
    );
    if (fromCustomization.length) return fromCustomization;
    return [];
  }, [rawResponse?.metrics, chartParams, customizationOptions]);

  // Read live form metrics every render so y-axis titles update when the user changes metric columns.
  const formMetrics =
    typeof window !== 'undefined'
      ? normalizeChartMetrics(
        (window as any).__chartFormValues?.metrics ??
        (window as any).__chartFormValues?.metric ??
        (window as any).__chartFormValues?.mtric,
      )
      : [];

  const resolvedMetrics = useSavedCustomizationOnly
    ? resolvedMetricsFromSaved
    : formMetrics.length > 0
      ? formMetrics
      : resolvedMetricsFromSaved;

  const effectiveCustomizationOptions = useMemo(() => {
    if (useSavedCustomizationOnly) {
      return customizationOptions || {};
    }
    return customizationOptions || (typeof window !== 'undefined' ? (window as any).__chartCustomizationOptions : undefined);
  }, [customizationOptions, useSavedCustomizationOnly]);

  // Transform data to standard format
  const chartData = useMemo(() => {
    if (!Array.isArray(data) || data.length === 0) return [] as Array<{ category: string; value: number; originalData: any }>;

    const dataArray = data as any[];

    // Check if data is already in the transformed format (has category and value)
    if (dataArray[0] && 'category' in dataArray[0] && 'value' in dataArray[0]) {
      return dataArray as Array<{ category: string; value: number; originalData: any }>;
    }

    // Otherwise, process the data using config (legacy format)
    if (!config.x || !config.operator) return [] as Array<{ category: string; value: number; originalData: any }>;

    const grouped = dataArray.reduce((acc, row) => {
      const key = String(row[config.x!.name]);
      if (!acc[key]) {
        acc[key] = [];
      }
      acc[key].push(row);
      return acc;
    }, {} as Record<string, any[]>);

    return Object.entries(grouped).map(([key, values]: [string, any[]]) => {
      let value = 0;
      const yField = config.y?.name;

      if (config.operator === 'count') {
        value = values.length;
      } else if (config.operator === 'sum' && yField) {
        value = values.reduce((sum, v) => sum + (Number(v[yField]) || 0), 0);
      } else if (config.operator === 'avg' && yField) {
        const sum = values.reduce((sum, v) => sum + (Number(v[yField]) || 0), 0);
        value = sum / values.length;
      } else if (config.operator === 'min' && yField) {
        value = Math.min(...values.map((v) => Number(v[yField]) || 0));
      } else if (config.operator === 'max' && yField) {
        value = Math.max(...values.map((v) => Number(v[yField]) || 0));
      }

      return {
        category: key,
        value: value,
        originalData: values[0],
      };
    });
  }, [data, config]);

  const sunburstChartData = useMemo((): SunburstChartInput => {
    if (
      rawResponse &&
      (rawResponse.columns || (rawResponse as any).dimensions || rawResponse.data)
    ) {
      return {
        data: rawResponse.data || data,
        columns: rawResponse.columns,
        dimensions: (rawResponse as any).dimensions,
        hierarchy: (rawResponse as any).hierarchy,
      };
    }
    return data;
  }, [rawResponse, data]);

  // Determine chart type
  if (!chart) {
    return (
      <div className="flex h-full items-center justify-center text-muted-foreground">
        No chart selected
      </div>
    );
  }

  const chartName = chart.name.toLowerCase();
  const uniqueId =
    (chart as any).uniqueId?.toLowerCase() ||
    (chart as any).unique_id?.toLowerCase() ||
    '';
  const vizHint = uniqueId || chartName;

  const isRadiusPie = isRadiusPieChart(vizHint) || isRadiusPieChart(chartName);
  const isDonutChart =
    !isRadiusPie &&
    isPieDonutOrRadiusPieChart(vizHint) &&
    (isDonutChartType(vizHint) || isDonutChartType(chartName));
  const isPieOrDonutChart =
    !isRadiusPie && isPieDonutOrRadiusPieChart(vizHint);

  if (isRadiusPie) {
    const radiusPieData = resolvePieLikeChartData(rawResponse, vizHint, data);
    return (
      <div className="h-full w-full max-w-full min-h-0 overflow-hidden flex flex-col items-center justify-center pb-0 pt-0 px-2">
        <div className="min-h-0 flex-1 w-full max-w-full overflow-hidden">
          <RadiusPieChart
            data={radiusPieData}
            onChartInteraction={onChartInteraction}
            customizationOptions={effectiveCustomizationOptions}
          />
        </div>
      </div>
    );
  }

  // Determine which chart component to render
  if (isPieOrDonutChart) {
    const pieData = resolvePieLikeChartData(rawResponse, vizHint, data);
    return (
      <div className="h-full w-full max-w-full min-h-0 overflow-hidden flex flex-col items-center justify-center pb-0 pt-0 px-2">
        {chart && (
          <div className="mb-2 flex items-center gap-2 w-full flex-shrink-0">
            {/* {chart.icon && typeof chart.icon !== 'string' && <chart.icon className="h-4 w-4" />}
            <h3 className="text-sm font-semibold">{chart.name}</h3> */}
          </div>
        )}
        <div className="min-h-0 flex-1 w-full max-w-full overflow-hidden">
          <PieChart
            data={pieData}
            isDonut={isDonutChart}
            onChartInteraction={onChartInteraction}
            customizationOptions={effectiveCustomizationOptions}
            useSavedCustomizationOnly={useSavedCustomizationOnly}
          />
        </div>
      </div>
    );
  }

 
  if (chartName.includes('table') || uniqueId === 'table') {
    return (
      <TableChart
        data={Array.isArray(rawResponse?.data) ? rawResponse!.data : chartData}
       config={effectiveCustomizationOptions}
      />
    );
  }
  if (
    chartName.includes('pivot') ||
    uniqueId === 'pivot' ||
    uniqueId === 'pivot_table'
  ) {
    return (
      <PivotChart
        data={chartData}
        rawResponse={rawResponse}
        forceMock={false}
        mockResponse={typeof window !== 'undefined' ? (window as any).__mockPivotResponse : undefined}
        config={effectiveCustomizationOptions}
      />
    );
  }

  if (
    chartName.includes('bar') ||
    chartName.includes('column') ||
    uniqueId === 'bar' ||
    uniqueId === 'column'
  ) {
    const isStacked = chartName.includes('stacked') || uniqueId === 'stacked_bar';
    return (
      <div className="h-full w-full max-w-full min-h-0 overflow-hidden flex flex-col items-center justify-center pb-0 pt-0 px-2">
        {chart && (
          <div className="mb-2 flex items-center gap-2 w-full flex-shrink-0">
            {/* {chart.icon && <chart.icon className="h-4 w-4" />}
            <h3 className="text-sm font-semibold">{chart.name}</h3> */}
          </div>
        )}
        <div className="min-h-0 flex-1 w-full max-w-full overflow-hidden">
          <BarChart
            data={rawResponse || chartData}
            x_axis={rawResponse?.x_axis}
            columns={rawResponse?.columns}
            metrics={resolvedMetrics}
            isStacked={isStacked}
            onChartInteraction={onChartInteraction}
            customizationOptions={effectiveCustomizationOptions}
          />
        </div>
      </div>
    );
  }

  if (
    chartName.includes('line') ||
    uniqueId === 'line'
  ) {
    return (
      <div className="h-full w-full max-w-full min-h-0 overflow-hidden flex flex-col items-center justify-center pb-0 pt-0 px-2">
        {chart && (
          <div className="mb-2 flex items-center gap-2 w-full flex-shrink-0">
            {/* {chart.icon && <chart.icon className="h-4 w-4" />}
            <h3 className="text-sm font-semibold">{chart.name}</h3> */}
          </div>
        )}
        <div className="min-h-0 flex-1 w-full max-w-full overflow-hidden">
          <LineChart
            data={rawResponse?.data || chartData}
            columns={rawResponse?.columns}
            x_axis={rawResponse?.x_axis}
            metrics={resolvedMetrics}
            onChartInteraction={onChartInteraction}
            customizationOptions={effectiveCustomizationOptions}
          />
        </div>
      </div>
    );
  }

  if (
    chartName.includes('area') ||
    uniqueId === 'area'
  ) {
    return (
      <div className="h-full w-full max-w-full min-h-0 overflow-hidden flex flex-col items-center justify-center pb-0 pt-0 px-2">
        {chart && (
          <div className="mb-2 flex items-center gap-2 w-full flex-shrink-0">
            {/* {chart.icon && <chart.icon className="h-4 w-4" />}
            <h3 className="text-sm font-semibold">{chart.name}</h3> */}
          </div>
        )}
        <div className="min-h-0 flex-1 w-full max-w-full overflow-hidden">
          <AreaChart
            data={rawResponse?.data || chartData}
            columns={rawResponse?.columns}
            x_axis={rawResponse?.x_axis}
            metrics={resolvedMetrics}
            onChartInteraction={onChartInteraction}
            customizationOptions={effectiveCustomizationOptions}
          />
        </div>
      </div>
    );
  }

  if (
    chartName.includes('gauge') ||
    uniqueId === 'gauge' ||
    uniqueId === 'gauge_big'
  ) {
    return (
      <div className="h-full w-full max-w-full min-h-0 overflow-hidden flex flex-col items-center justify-center p-0">
        {chart && (
          <div className="mb-0 flex items-center gap-2 w-full flex-shrink-0">
            {/* {chart.icon && <chart.icon className="h-4 w-4" />}
            <h3 className="text-sm font-semibold">{chart.name}</h3> */}
          </div>
        )}
        <div className="flex min-h-0 flex-1 w-full items-center justify-center overflow-hidden px-1 pb-1">
          <GaugeChart
            data={chartData}
            onChartInteraction={onChartInteraction}
            customizationOptions={effectiveCustomizationOptions}
          />
        </div>
      </div>
    );
  }

  if (
    chartName.includes('funnel') ||
    uniqueId === 'funnel'
  ) {
    // View mode: use rawResponse (object with .data/.columns) when chartData is empty so saved chart displays
    const funnelData =
      chartData.length > 0
        ? chartData
        : rawResponse && Array.isArray(rawResponse.data) && rawResponse.data.length > 0
          ? (rawResponse as any)
          : [];
    return (
      <div className="h-full w-full max-w-full min-h-0 overflow-hidden flex flex-col items-center justify-center pb-0 pt-0 px-2">
        {chart && (
          <div className="mb-2 flex items-center gap-2 w-full flex-shrink-0">
            {/* {chart.icon && <chart.icon className="h-4 w-4" />}
            <h3 className="text-sm font-semibold">{chart.name}</h3> */}
          </div>
        )}
        <div className="min-h-0 flex-1 w-full">
          <FunnelChart
            data={funnelData}
            onChartInteraction={onChartInteraction}
            customizationOptions={effectiveCustomizationOptions}
          />
        </div>
      </div>
    );
  }

  if (
    chartName.includes('sunburst') ||
    uniqueId === 'sunburst'
  ) {
    return (
      <div className="h-full w-full max-w-full min-h-0 overflow-hidden flex flex-col items-center justify-center pb-0 pt-0 px-2">
        {chart && (
          <div className="mb-2 flex items-center gap-2 w-full flex-shrink-0">
            {/* {chart.icon && <chart.icon className="h-4 w-4" />}
            <h3 className="text-sm font-semibold">{chart.name}</h3> */}
          </div>
        )}
        <div className="min-h-0 flex-1 w-full max-w-full overflow-hidden">
          <SunburstChart
            data={sunburstChartData}
            onChartInteraction={onChartInteraction}
            customizationOptions={effectiveCustomizationOptions}
          />
        </div>
      </div>
    );
  }

  if (
    chartName.includes('big number stream') ||
    chartName.includes('big_number_stream') ||
    uniqueId === 'big_number_stream'
  ) {
    const streamData =
      chartData.length > 0
        ? chartData
        : transformRawResponseToCategoryValue(rawResponse ?? undefined, uniqueId || chartName);
    const streamConfig = {
      ...config,
      metrics: resolvedMetrics.length > 0 ? resolvedMetrics : (config as { metrics?: ChartMetricParam[] })?.metrics,
    };
    const streamChart = (
      <BigNumberStreamChart
        data={streamData}
        config={streamConfig}
        rawResponse={rawResponse}
        customizationOptions={effectiveCustomizationOptions}
        useSavedCustomizationOnly={useSavedCustomizationOnly}
      />
    );
    if (previewMode === 'compact' && !useSavedCustomizationOnly) {
      return (
        <BigNumberFormulatorPreviewFrame mode="stream">{streamChart}</BigNumberFormulatorPreviewFrame>
      );
    }
    return streamChart;
  }

  if (
    (chartName.includes('number') ||
      chartName.includes('bignumber') ||
      chartName.includes('big number') ||
      uniqueId === 'number' ||
      uniqueId === 'bignumber') &&
    uniqueId !== 'big_number_stream'
  ) {
    const bigNumberConfig = {
      ...config,
      metrics: resolvedMetrics.length > 0 ? resolvedMetrics : (config as { metrics?: ChartMetricParam[] })?.metrics,
    };
    const bigNumberMetrics =
      resolvedMetrics.length > 0
        ? resolvedMetrics
        : (bigNumberConfig.metrics as ChartMetricParam[] | undefined);
    const bigNumberSourceData =
      Array.isArray(data) && data.length > 0 ? data : chartData;
    const bigNumberData = resolveBigNumberChartData(
      bigNumberSourceData as Array<Record<string, any>>,
      {
        rawResponse: rawResponse ?? undefined,
        metrics: bigNumberMetrics,
        chartHint: uniqueId || chartName,
      },
    );
    const layoutPreference = effectiveCustomizationOptions?.layoutMode ?? 'auto';
    const layoutMode = resolveBigNumberLayoutMode(bigNumberData, bigNumberMetrics, layoutPreference);
    const previewLayoutMode: BigNumberResponsiveLayoutMode =
      layoutMode === 'kpi' ? 'kpi' : layoutMode === 'columns' ? 'multi' : 'single';
    const bigNumberChart = (
      <BigNumberChart
        data={bigNumberData}
        config={bigNumberConfig}
        customizationOptions={effectiveCustomizationOptions}
        useSavedCustomizationOnly={useSavedCustomizationOnly}
      />
    );
    if (previewMode === 'compact' && !useSavedCustomizationOnly) {
      return (
        <BigNumberFormulatorPreviewFrame mode={previewLayoutMode}>
          {bigNumberChart}
        </BigNumberFormulatorPreviewFrame>
      );
    }
    return bigNumberChart;
  }

  // Default to pie chart
  return (
    <div className="h-full w-full max-w-full min-h-0 overflow-hidden flex flex-col items-center justify-center pb-0 pt-0 px-2">
      {chart && (
        <div className="mb-2 flex items-center gap-2 w-full flex-shrink-0">
          {/* {chart.icon && <chart.icon className="h-4 w-4" />}
          <h3 className="text-sm font-semibold">{chart.name}</h3> */}
        </div>
      )}
      <div className="flex-1 w-full">
        <PieChart
          data={chartData}
          isDonut={isDonutChart}
          onChartInteraction={onChartInteraction}
        />
      </div>
    </div>
  );
}

