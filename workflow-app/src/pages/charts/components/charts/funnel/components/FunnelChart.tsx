import { useEffect, useRef, useState } from 'react';
import * as am5 from '@amcharts/amcharts5';
import * as am5percent from '@amcharts/amcharts5/percent';
import am5themes_Animated from '@amcharts/amcharts5/themes/Animated';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { formatNumber } from '@/utils/numberFormatters';
import { donutColors as funnelPiePalette } from '@/pages/ExploratoryAnalysis/AgenticSemantics/am5MiniChartConstants';
import { defaultOptions as funnelDefaultOptions } from '../customize/funnelCustomizeTypes';
import { colorSchemes } from '../../pie/customize/pieColorSchemes';
import { useTheme } from '@/context/theme';
import { applyAm5InterfaceTheme, probeAmChartThemeColors } from '../../amChartThemeColors';
import { ChartDomScrollLegend, type ChartDomScrollLegendItem } from '../../ChartDomScrollLegend';

/** Same dimension line builder as in-chart legend (ordered fields, "—" for null). */
function buildFunnelDimensionLegendText(row: any, dimensionFields: string[]): string {
  if (!dimensionFields || dimensionFields.length === 0 || !row) return '';
  const values: string[] = [];
  for (const field of dimensionFields) {
    if (!field) continue;
    const value = row[field];
    const strValue = value === null || value === undefined ? '—' : String(value).trim();
    if (strValue !== '') values.push(strValue);
  }
  return values.join(', ');
}

function formatValueWithCurrencyForLegend(
  value: number,
  numericString: string,
  numberFormat: string,
  optionsRaw: { currencyFormat?: string; currencySymbol?: string }
): string {
  const currencyFormat = optionsRaw.currencyFormat || 'none';
  const currencyOption = optionsRaw.currencySymbol || '(USD)';
  const codeMatch = String(currencyOption).match(/\(([A-Z]{3})\)/);
  const code = codeMatch ? codeMatch[1] : 'USD';
  const symbolMatch = String(currencyOption).match(/^([^\s(]+)/);
  const symbol = symbolMatch ? symbolMatch[1] : '';
  const localeMap: Record<string, string> = {
    USD: 'en-US',
    EUR: 'de-DE',
    GBP: 'en-GB',
    JPY: 'ja-JP',
    CNY: 'zh-CN',
    INR: 'en-IN',
  };
  const locale = localeMap[code] || 'en-US';
  if (currencyFormat === 'none') return numericString;
  if (numberFormat === 'full' && currencyFormat !== 'none') {
    try {
      return new Intl.NumberFormat(locale, {
        style: 'currency',
        currency: code,
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }).format(value);
    } catch {
      /* ignore */
    }
  }
  if (currencyFormat === 'prefix') return `${symbol}${numericString}`;
  if (currencyFormat === 'suffix') return `${numericString} ${symbol}`;
  return numericString;
}

/** Mirrors amCharts funnel `legend.labels` adapter for the DOM scroll legend. */
function formatFunnelDomLegendLine(
  item: any,
  totalValue: number,
  opts: {
    labelContents?: string;
    tooltipContents?: string;
    numberFormat?: string;
    currencyFormat?: string;
    currencySymbol?: string;
  },
  dimensionFields: string[]
): string {
  const labelTpl = opts.labelContents || opts.tooltipContents || 'category_value_percentage';
  const numberFormat = opts.numberFormat || 'adaptive';
  const ctx = item;
  const v = Number(ctx.value) || 0;
  const percentage = totalValue > 0 ? ((v / totalValue) * 100).toFixed(2) : '0.00';
  let namePart = '';
  if (ctx.originalData && dimensionFields.length > 0) {
    namePart = buildFunnelDimensionLegendText(ctx.originalData, dimensionFields);
  }
  if (!namePart && ctx.dimensionText) namePart = ctx.dimensionText;
  if (!namePart) namePart = ctx.category || ctx.name || '';

  const numericPart = formatNumber(v, { format: (numberFormat === 'adaptive' ? 'short' : numberFormat) as 'full' | 'short' | 'both' });
  const formattedValue = formatValueWithCurrencyForLegend(v, numericPart, numberFormat, opts);

  const parts: string[] = [];
  if (labelTpl === 'category_name') {
    parts.push(namePart);
  } else if (labelTpl === 'value') {
    parts.push(formattedValue);
  } else if (labelTpl === 'percentage') {
    parts.push(`${percentage}%`);
  } else {
    if (labelTpl.includes('value')) parts.push(formattedValue);
    if (labelTpl.includes('percentage')) parts.push(`(${percentage}%)`);
    if (labelTpl.includes('category')) parts.push(namePart);
  }
  return parts.join(' ');
}

interface FunnelChartProps {
  data: Array<{ category: string; value: number; originalData: any }>;
  orientation?: 'vertical' | 'horizontal';
  onChartInteraction?: (field: string, value: any) => void;
  customizationOptions?: any;
}

export function FunnelChart({ data, orientation = 'vertical', onChartInteraction, customizationOptions }: FunnelChartProps) {
  const { theme } = useTheme();
  const chartRef = useRef<HTMLDivElement>(null);
  const funnelSliceDispatchedRef = useRef<boolean>(false);
  const rootRef = useRef<am5.Root | null>(null);
  const customizationRef = useRef<any>(null);
  const [legendItems, setLegendItems] = useState<Array<any>>([]);
  const [legendPalette, setLegendPalette] = useState<string[]>([]);
  /** Keeps dimension field order in sync with the chart for DOM legend text. */
  const funnelLegendDimsRef = useRef<string[]>([]);
  const [funnelOrientation, setFunnelOrientation] = useState<'vertical' | 'horizontal'>(orientation);
  const [customVersion, setCustomVersion] = useState(0);

  useEffect(() => {
    // Listen for customization changes (window event) so chart updates in real-time
    const handleCustomizationChange = (e: CustomEvent) => {
      customizationRef.current = e.detail;
      setCustomVersion((v) => v + 1);
    };
    if (typeof window !== 'undefined') {
      window.addEventListener('chartCustomizationChanged', handleCustomizationChange as EventListener);
      if ((window as any).__chartCustomizationOptions) customizationRef.current = (window as any).__chartCustomizationOptions;
    }
    // parent prop-driven customization is handled by a separate effect below
    if (!chartRef.current || !data) return;

    // customizationOptions prop will be merged by the watcher effect below

    // Support callers passing either an array of rows or the full API response
    // { status, message, data: [...rows], columns: [...] }
    let rows: Array<any> = Array.isArray(data) ? data : (data as any).data ?? [];
    const apiColumns: string[] | undefined = !Array.isArray(data) && Array.isArray((data as any).columns) ? (data as any).columns : undefined;

    if (!rows || rows.length === 0) return;

    // Helper: identify dimension fields (non-aggregated, non-numeric) preserving API column order
    // Checks all rows to ensure we catch all dimension fields, even if some have null values
    function identifyDimensionFields(rows: Array<any>, apiColumns?: string[]): string[] {
      if (!rows || rows.length === 0) return [];

      // Get all possible keys - prefer API columns order, otherwise collect from all rows
      let allKeys: string[] = [];
      if (Array.isArray(apiColumns) && apiColumns.length > 0) {
        allKeys = apiColumns;
      } else {
        // Collect all unique keys from all rows to ensure we don't miss any fields
        const keySet = new Set<string>();
        rows.forEach(row => {
          if (row && typeof row === 'object') {
            Object.keys(row).forEach(k => keySet.add(k));
          }
        });
        allKeys = Array.from(keySet);
      }

      const dimensionFields: string[] = [];

      const internalBlacklist = new Set(['category', 'value', 'dimensionText', 'originalData', 'originalRows', 'name']);
      for (const key of allKeys) {
        if (!key) continue;
        if (internalBlacklist.has(String(key))) continue;
        const upperKey = String(key).toUpperCase();
        // Skip aggregated fields (contain aggregation patterns)
        const hasAggregationPattern = /\((SUM|COUNT|AVG|MIN|MAX|STDDEV|VARIANCE)\)/i.test(upperKey) ||
          /^(SUM|COUNT|AVG|MIN|MAX|STDDEV|VARIANCE)\(/i.test(upperKey) ||
          /_(SUM|COUNT|AVG|MIN|MAX|STDDEV|VARIANCE)$/i.test(upperKey) ||
          /(SUM|COUNT|AVG|MIN|MAX|STDDEV|VARIANCE)$/i.test(upperKey);
        if (hasAggregationPattern) continue;
        dimensionFields.push(key);
      }
      return dimensionFields;
    }

    // Helper: identify value fields (aggregated measures only) for summing
    // Only aggregated columns like DC_AMOUNT(SUM) are values; numeric IDs like p_status are dimensions
    function identifyValueFields(rows: Array<any>, apiColumns?: string[], dimensionFields?: string[]): string[] {
      if (!rows || rows.length === 0) return [];
      const sample = rows[0] || {};
      const allKeys = Array.isArray(apiColumns) && apiColumns.length ? apiColumns : Object.keys(sample);
      const valueFields: string[] = [];
      const dimSet = new Set(dimensionFields || []);
      for (const key of allKeys) {
        const upperKey = (key || '').toUpperCase();
        const hasAggregationPattern = /\((SUM|COUNT|AVG|MIN|MAX|STDDEV|VARIANCE)\)/i.test(upperKey) ||
          /^(SUM|COUNT|AVG|MIN|MAX|STDDEV|VARIANCE)\(/i.test(upperKey) ||
          /_(SUM|COUNT|AVG|MIN|MAX|STDDEV|VARIANCE)$/i.test(upperKey) ||
          /(SUM|COUNT|AVG|MIN|MAX|STDDEV|VARIANCE)$/i.test(upperKey);
        if (hasAggregationPattern) {
          valueFields.push(key);
          continue;
        }
        // Fallback: first numeric column that is not a dimension (when no aggregated column)
        if (valueFields.length === 0 && !dimSet.has(key)) {
          const value = sample[key];
          if (typeof value === 'number' && !isNaN(value)) valueFields.push(key);
        }
      }
      return valueFields;
    }

    // Helper: build dimension text from ordered dimension fields - show ALL dimensions, "—" for null
    function buildDimensionText(row: any, dimensionFields: string[]): string {
      if (!dimensionFields || dimensionFields.length === 0 || !row) return '';
      const values: string[] = [];
      for (const field of dimensionFields) {
        if (!field) continue;
        const value = row[field];
        const strValue = value === null || value === undefined ? '—' : String(value).trim();
        if (strValue !== '') values.push(strValue);
      }
      return values.join(', ');
    }

    // Build customization options (defaults <- window <- live ref)
    const windowOpts = (typeof window !== 'undefined' ? (window as any).__chartCustomizationOptions : null) || {};
    const optionsRaw: any = { ...funnelDefaultOptions, ...windowOpts, ...(customizationRef.current || {}) };

    const chartTheme = probeAmChartThemeColors();
    const foregroundColor = chartTheme.cardForeground;

    /** Readable label color on top of arbitrary slice fills (WCAG-style relative luminance). */
    const labelFillOnSliceBackground = (sliceFill: any, fallback: am5.Color): am5.Color => {
      try {
        const c = am5.color(sliceFill);
        let r = Number(c.r);
        let g = Number(c.g);
        let b = Number(c.b);
        if (r <= 1 && g <= 1 && b <= 1) {
          r *= 255;
          g *= 255;
          b *= 255;
        }
        const lin = (v: number) => {
          const x = v / 255;
          return x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4);
        };
        const L = 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
        return L > 0.52 ? am5.color(0x141414) : am5.color(0xffffff);
      } catch {
        return fallback;
      }
    };

    // Create root element
    const root = am5.Root.new(chartRef.current);
    root.setThemes([am5themes_Animated.new(root)]);
    root.autoResize = true;
    rootRef.current = root;

    // Hide amCharts logo
    root._logo?.dispose();
    applyAm5InterfaceTheme(root, chartTheme);

    // Check if data is already preprocessed (has category/value fields)
    // If so, extract raw data from originalData for dimension field identification
    const sample = rows[0];
    let rawRowsForIdentification = rows;
    let actualApiColumns = apiColumns;

    if (sample && Object.prototype.hasOwnProperty.call(sample, 'category') && Object.prototype.hasOwnProperty.call(sample, 'value')) {
      // Data is preprocessed - extract raw data from originalData
      rawRowsForIdentification = rows
        .map((r: any) => r.originalData)
        .filter((r: any) => r && typeof r === 'object');

      // If we have raw data, use it for identification
      if (rawRowsForIdentification.length > 0 && rawRowsForIdentification[0]) {
        // Try to get columns from the first raw row or use provided apiColumns
        if (!actualApiColumns || actualApiColumns.length === 0) {
          actualApiColumns = Object.keys(rawRowsForIdentification[0]);
        }
      }
    }

    // Determine dimension fields from raw data (preserve API column order when provided)
    const dimensionFields = identifyDimensionFields(rawRowsForIdentification, actualApiColumns);
    funnelLegendDimsRef.current = dimensionFields;
    const valueFields = identifyValueFields(rawRowsForIdentification, actualApiColumns, dimensionFields);

    // Simple, deterministic short hash for stable ids
    const shortHash = (s: string) => {
      try {
        let h = 0;
        for (let i = 0; i < s.length; i++) {
          h = (h << 5) - h + s.charCodeAt(i);
          h |= 0;
        }
        return Math.abs(h).toString(36);
      } catch (e) { return String(Math.random()).slice(2, 8); }
    };

    const makeFunnelId = (row: any, idx: number) => {
      try {
        if (!row) return `funnel-${idx}`;
        if (row.__funnelId) return row.__funnelId;
        // Prefer any existing stable id-like keys present on the row
        const candidate = row.id ?? row.ID ?? row.Id ?? row.key ?? null;
        if (candidate) return `funnel-${String(candidate)}`;
        const s = JSON.stringify(row || {});
        return `funnel-${shortHash(s)}-${idx}`;
      } catch (e) { return `funnel-${idx}`; }
    };

    // Normalize rows into series-ready items: { category, value, originalData, dimensionText }
    let seriesItems: Array<any> = [];

    // If rows already have `category` + `value`, use them but still build dimensionText from all dimension fields
    if (sample && Object.prototype.hasOwnProperty.call(sample, 'category') && Object.prototype.hasOwnProperty.call(sample, 'value')) {
      seriesItems = rows.map((r: any, idx: number) => {
        // Build dimension text from the raw originalData, not from the preprocessed row
        const rawData = r.originalData || r;
        const dimText = buildDimensionText(rawData, dimensionFields);
        // Store a copy of the original raw data to ensure all fields are preserved
        const originalDataCopy = rawData && typeof rawData === 'object' ? { ...rawData } : rawData;
        // Keep originalRows for aggregated/grouped series so we can consult
        // underlying rows when some dimension values are missing.
        const originalRows = rawData && typeof rawData === 'object' ? [{ ...rawData }] : [rawData];
        // Use dimensionText for category if available, otherwise fall back to r.category
        return {
          category: dimText || r.category,
          value: Number(r.value) || 0,
          originalData: originalDataCopy,
          originalRows,
          dimensionText: dimText,
          __funnelId: makeFunnelId(originalDataCopy, idx),
        };
      });
    } else {
      // Generic approach: group by all dimension fields and sum value fields
      if (dimensionFields.length > 0 && valueFields.length > 0) {
        // Create a composite key from all dimension values for grouping
        const getGroupKey = (row: any): string => {
          return dimensionFields.map(field => {
            const val = row[field];
            return val !== null && val !== undefined && val !== '' ? String(val) : '';
          }).join('|');
        };

        const groups = new Map<string, { dimensionText: string; value: number; originalRows: any[] }>();

        rows.forEach((r: any) => {
          const groupKey = getGroupKey(r);
          const dimensionText = buildDimensionText(r, dimensionFields);

          // Sum all value fields
          let totalValue = 0;
          for (const valueField of valueFields) {
            const val = Number(r[valueField]) || 0;
            totalValue += val;
          }

          if (!groups.has(groupKey)) {
            groups.set(groupKey, { dimensionText, value: 0, originalRows: [] });
          }
          const g = groups.get(groupKey)!;
          g.value += totalValue;
          g.originalRows.push(r);
        });

        // Build series items from groups
        groups.forEach((g) => {
          // Find the row with the most complete dimension values (fewest nulls)
          let bestRow = g.originalRows[0];
          let maxNonEmptyCount = 0;
          for (const row of g.originalRows) {
            let nonEmptyCount = 0;
            for (const field of dimensionFields) {
              const val = row[field];
              if (val !== null && val !== undefined && val !== '') {
                nonEmptyCount++;
              }
            }
            if (nonEmptyCount > maxNonEmptyCount) {
              maxNonEmptyCount = nonEmptyCount;
              bestRow = row;
            }
          }
          // Build dimension text from the best row (most complete dimensions)
          const dimText = buildDimensionText(bestRow, dimensionFields);
          // Store a copy of the original row data to ensure all fields are preserved
          const originalDataCopy = { ...bestRow };
          // Preserve all original rows for this group so downstream drilldown
          // can inspect them for non-null values when necessary.
          const originalRowsCopy = g.originalRows.map((r) => (r && typeof r === 'object' ? { ...r } : r));
          seriesItems.push({
            category: dimText,
            value: g.value,
            originalData: originalDataCopy,
            originalRows: originalRowsCopy,
            dimensionText: dimText,
            __funnelId: makeFunnelId(originalDataCopy, seriesItems.length),
          });
        });
      } else if (valueFields.length > 0) {
        // If no dimensions, use first value field and create a single category
        const firstValueField = valueFields[0];
        seriesItems = rows.map((r: any, idx: number) => {
          const value = Number(r[firstValueField]) || 0;
          const dimText = buildDimensionText(r, dimensionFields);
          // Store a copy of the original row data to ensure all fields are preserved
          const originalDataCopy = { ...r };
          return {
            category: dimText || String(value),
            value,
            originalData: originalDataCopy,
            originalRows: [{ ...r }],
            dimensionText: dimText,
            __funnelId: makeFunnelId(originalDataCopy, idx),
          };
        });
      } else {
        // Fallback: if we can't identify fields, try to use any numeric field as value
        const numericKeys = Object.keys(sample).filter(k => typeof sample[k] === 'number');
        if (numericKeys.length > 0) {
          const firstNumericKey = numericKeys[0];
          seriesItems = rows.map((r: any, idx: number) => {
            const value = Number(r[firstNumericKey]) || 0;
            const dimText = buildDimensionText(r, dimensionFields);
            // Store a copy of the original row data to ensure all fields are preserved
            const originalDataCopy = { ...r };
            return {
              category: dimText || String(value),
              value,
              originalData: originalDataCopy,
              originalRows: [{ ...r }],
              dimensionText: dimText,
              __funnelId: makeFunnelId(originalDataCopy, idx),
            };
          });
        }
      }
    }

    // Sort data by value descending for funnel effect
    const sortedData = [...seriesItems].sort((a, b) => b.value - a.value);
    // Expose sorted data to DOM legend renderer
    try { setLegendItems(sortedData); } catch (e) { }

    // Stack legend and plot vertically. Funnel orientation is controlled only by
    // FunnelSeries.orientation — do NOT use horizontalLayout here or the legend
    // steals width and the horizontal funnel collapses.
    const chart = root.container.children.push(
      am5percent.SlicedChart.new(root, {
        layout: root.verticalLayout,
        width: am5.percent(100),
        height: am5.percent(100),
      })
    );

    // Create series
    const series = chart.series.push(
      am5percent.FunnelSeries.new(root, {
        // false = labels sit on each slice (inside the block), not in an outer aligned column.
        alignLabels: false,
        orientation: funnelOrientation,
        valueField: 'value',
        categoryField: 'category',
        bottomRatio: 1,
        width: am5.percent(100),
        height: am5.percent(100),
      })
    );

    try {
      series.ticks.template.setAll({ forceHidden: true, visible: false });
    } catch (e) { }

    series.slices.template.setAll({
      cursorOverStyle: 'pointer',
      // remove visible separators between slices by disabling stroke
      stroke: undefined,
      strokeWidth: 0,
      strokeOpacity: 0,
      fillOpacity: 1,
      expandDistance: 0,   // Disable expansion/connector bands
    });

    // Add gap between slices (decreases effective slice height) via transparent links
    series.links.template.setAll({
      height: 8,
      fillOpacity: 0,
      stroke: undefined,
      strokeOpacity: 0,
    });

    // Disable gradients, shadows, filters, and connector effects to create flat solid blocks
    try {
      (series.slices.template as any).adapters.add('fillGradient', (_g: any) => undefined);
      (series.slices.template as any).adapters.add('shadow', (_s: any) => undefined);
      (series.slices.template as any).adapters.add('filter', (_f: any) => undefined);
      // Disable any connector/transition effects
      (series.slices.template as any).adapters.add('sideFace', (_sf: any) => undefined);
    } catch (e) { }

    // Disable sideFace (connector pipes) creation - this removes the theme-colored pipes between slices
    try {
      // Disable sideFace template if it exists
      if ((series.slices.template as any).sideFace) {
        const sideFaceTemplate = (series.slices.template as any).sideFace;
        if (sideFaceTemplate && typeof sideFaceTemplate.set === 'function') {
          sideFaceTemplate.set('fill', undefined);
          sideFaceTemplate.set('fillOpacity', 0);
          sideFaceTemplate.set('visible', false);
        }
      }
    } catch (e) { }


    // Build helpers for number and currency formatting based on customization
    const numberFormat = optionsRaw.numberFormat || 'adaptive';
    const getCurrencyInfo = (): { code: string; locale: string; symbol: string } => {
      const currencyOption = optionsRaw.currencySymbol || '(USD)';
      const codeMatch = String(currencyOption).match(/\(([A-Z]{3})\)/);
      const code = codeMatch ? codeMatch[1] : 'USD';
      const symbolMatch = String(currencyOption).match(/^([^\s(]+)/);
      const symbol = symbolMatch ? symbolMatch[1] : '';
      const localeMap: Record<string, string> = { 'USD': 'en-US', 'EUR': 'de-DE', 'GBP': 'en-GB', 'JPY': 'ja-JP', 'CNY': 'zh-CN', 'INR': 'en-IN' };
      const locale = localeMap[code] || 'en-US';
      return { code, locale, symbol };
    };
    const formatValueWithCurrency = (value: number, numericString: string): string => {
      const currencyFormat = optionsRaw.currencyFormat || 'none';
      const { code, locale, symbol } = getCurrencyInfo();
      if (currencyFormat === 'none') return numericString;
      if (numberFormat === 'full' && currencyFormat !== 'none') {
        try { return new Intl.NumberFormat(locale, { style: 'currency', currency: code, minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value); } catch { }
      }
      if (currencyFormat === 'prefix') return `${symbol}${numericString}`;
      if (currencyFormat === 'suffix') return `${numericString} ${symbol}`;
      return numericString;
    };

    // Tooltip adapter will use optionsRaw.tooltipContents and showTooltipLabels
    // Uses dimensionText consistently for category display
    // Always rebuild from originalData to ensure all dimension fields are included
    series.slices.template.adapters.add('tooltipText', (text, target) => {
      try {
        if (target.dataItem) {
          const dataContext = target.dataItem.dataContext as any;
          if (dataContext && typeof dataContext.value === 'number') {
            const totalValue = sortedData.reduce((s, it) => s + (it.value || 0), 0) || 1;
            const numericPart = formatNumber(dataContext.value, { format: numberFormat === 'adaptive' ? 'short' : numberFormat });
            const formattedValue = formatValueWithCurrency(dataContext.value, numericPart);
            const percentage = ((dataContext.value / totalValue) * 100).toFixed(2);

            const showTooltipLabels = optionsRaw.showTooltipLabels !== undefined ? optionsRaw.showTooltipLabels : true;
            const tpl = optionsRaw.tooltipContents || 'category_value_percentage';
            // If tooltip labels are disabled entirely, return empty string to suppress tooltips
            if (!showTooltipLabels) {
              return '';
            }

            // Always rebuild dimension text from originalData to ensure all dimension fields are included
            let dimensionLabel = '';
            if (dataContext.originalData && dimensionFields && dimensionFields.length > 0) {
              dimensionLabel = buildDimensionText(dataContext.originalData, dimensionFields);
            }
            if (!dimensionLabel && dataContext.dimensionText) {
              dimensionLabel = dataContext.dimensionText;
            }
            if (!dimensionLabel) {
              dimensionLabel = dataContext.category || dataContext.name || '';
            }

            const parts: string[] = [];
            if (tpl.includes('category')) parts.push(dimensionLabel);
            if (tpl.includes('value')) parts.push(formattedValue);
            if (tpl.includes('percentage')) parts.push(`${percentage}%`);
            return parts.join(' ');
          }
        }
      } catch (e) { }
      return text || '';
    });

    series.data.setAll(sortedData);

    // Assign colors deterministically to slices and corresponding legend markers.
    // Use a helper to run after data validation (ensures dataItems/slices exist)
    const assignColors = () => {
      try {
        const cs = (window as any).__appliedFunnelColorSet || (chart.get('colors') as any);
        if (!cs || typeof cs.getIndex !== 'function') return;

        const dataItemsAny: any = series.dataItems;

        // Normalize to an array of data items regardless of amCharts collection implementation
        let itemsArray: any[] = [];
        try {
          if (dataItemsAny && typeof dataItemsAny.each === 'function') {
            dataItemsAny.each((di: any) => itemsArray.push(di));
          } else if (Array.isArray(dataItemsAny)) {
            itemsArray = dataItemsAny;
          } else if (dataItemsAny && typeof dataItemsAny.toArray === 'function') {
            itemsArray = dataItemsAny.toArray();
          }
        } catch (err) {
          itemsArray = [];
        }

        itemsArray.forEach((di: any, index: number) => {
          try {
            const color = cs.getIndex(index);
            const slice = di && di.get && di.get('slice') ? di.get('slice') : di && di.slice ? di.slice : null;
            if (slice) {
              // Apply flat solid fill - no gradients, shadows, or filters
              slice.set('fill', color);
              slice.set('fillOpacity', 1);
              // Remove all visual effects
              try { slice.set('fillGradient', undefined); } catch (e) { }
              try { slice.set('shadow', undefined); } catch (e) { }
              try { slice.set('filter', undefined); } catch (e) { }
              // Remove sideFace (connector pipe) if it exists
              try {
                const sideFace = slice.get('sideFace');
                if (sideFace) {
                  sideFace.set('fill', undefined);
                  sideFace.set('fillOpacity', 0);
                  sideFace.set('visible', false);
                  sideFace.hide();
                }
                slice.set('sideFace', undefined);
              } catch (e) { }
              // Ensure no separator stroke is applied between slices
              slice.set('stroke', undefined);
              slice.set('strokeWidth', 0);
              slice.set('strokeOpacity', 0);
            }

            // Also apply to legend marker if present
            try {
              const legendDataItem = di && di.get && di.get('legendDataItem') ? di.get('legendDataItem') : di && di.legendDataItem ? di.legendDataItem : null;
              if (legendDataItem) {
                const marker = legendDataItem.get('marker');
                if (marker) {
                  marker.set('fill', color);
                  marker.set('stroke', am5.color(0xffffff));
                }
              }
            } catch (e) { }
          } catch (e) { }
        });
      } catch (e) { }
    };

    // Function to remove sideFace (connector pipes) from all slices
    const removeSideFaces = () => {
      try {
        const dataItemsAny: any = series.dataItems;
        let itemsArray: any[] = [];
        try {
          if (dataItemsAny && typeof dataItemsAny.each === 'function') {
            dataItemsAny.each((di: any) => itemsArray.push(di));
          } else if (Array.isArray(dataItemsAny)) {
            itemsArray = dataItemsAny;
          } else if (dataItemsAny && typeof dataItemsAny.toArray === 'function') {
            itemsArray = dataItemsAny.toArray();
          }
        } catch (err) {
          itemsArray = [];
        }

        itemsArray.forEach((di: any) => {
          try {
            const slice = di && di.get && di.get('slice') ? di.get('slice') : di && di.slice ? di.slice : null;
            if (slice) {
              // Remove sideFace element if it exists
              try {
                const sideFace = slice.get('sideFace');
                if (sideFace) {
                  sideFace.set('fill', undefined);
                  sideFace.set('fillOpacity', 0);
                  sideFace.set('visible', false);
                  sideFace.hide();
                  try { sideFace.dispose(); } catch (e) { }
                }
              } catch (e) { }
              // Also try to access sideFace as a property
              try {
                if ((slice as any).sideFace) {
                  const sf = (slice as any).sideFace;
                  if (sf) {
                    sf.set('fill', undefined);
                    sf.set('fillOpacity', 0);
                    sf.set('visible', false);
                    sf.hide();
                    try { sf.dispose(); } catch (e) { }
                  }
                }
              } catch (e) { }
            }
          } catch (e) { }
        });
      } catch (e) { }
    };

    // Run once now and also after data validation; add a small timeout fallback
    try { assignColors(); removeSideFaces(); } catch (e) { }
    try {
      series.events.on('datavalidated', () => {
        try { assignColors(); removeSideFaces(); } catch (e) { }
      });
    } catch (e) { }

    // Build a stable mapping from rendered slice DOM node -> dataContext
    // so pointer/canvas fallbacks can resolve exact slice under the pointer
    const sliceNodeIdMap: Map<string, any> = new Map();
    const buildSliceNodeMapping = () => {
      try {
        sliceNodeIdMap.clear();
        const dataItemsAny: any = series.dataItems;
        let itemsArray: any[] = [];
        try {
          if (dataItemsAny && typeof dataItemsAny.each === 'function') {
            dataItemsAny.each((di: any) => itemsArray.push(di));
          } else if (Array.isArray(dataItemsAny)) {
            itemsArray = dataItemsAny;
          } else if (dataItemsAny && typeof dataItemsAny.toArray === 'function') {
            itemsArray = dataItemsAny.toArray();
          }
        } catch (err) { itemsArray = []; }

        itemsArray.forEach((di: any, index: number) => {
          try {
            const sliceEl = di.get?.('slice') ?? di.slice;
            const node = sliceEl?.get?.('node') ?? sliceEl?.node ?? sliceEl?._node;
            if (node && node instanceof Element) {
              const ctx = di.dataContext || di;
              const idFromCtx = ctx && ctx.__funnelId ? String(ctx.__funnelId) : `funnel-di-${Date.now()}-${index}`;
              try { (node as Element).setAttribute('data-funnel-di', idFromCtx); } catch (e) { }
              sliceNodeIdMap.set(idFromCtx, ctx);
            }
          } catch (e) { }
        });
      } catch (e) { }
    };
    // Also rebuild mapping after visuals are applied
    try { buildSliceNodeMapping(); } catch (e) { }
    setTimeout(() => { try { assignColors(); removeSideFaces(); buildSliceNodeMapping(); } catch (e) { } }, 80);
    setTimeout(() => { try { removeSideFaces(); buildSliceNodeMapping(); } catch (e) { } }, 200);

    // Calculate total for percentage calculation
    const total = sortedData.reduce((sum, item) => sum + (item.value || 0), 0);

    // Fixed palette: resolved from colorScheme
    try {
      const fallback = ['#5470c6', '#91cc75', '#fac858', '#ee6666', '#73c0de', '#3ba272', '#fc8452', '#9a60b4'];
      const resolve = (s: string) => {
        try {
          if (!s) return '';
          if (s.startsWith('--')) {
            const val = getComputedStyle(document.documentElement).getPropertyValue(s);
            return val ? val.trim() : s;
          }
          return s;
        } catch { return s; }
      };
      const colorSchemeKey = optionsRaw.colorScheme || 'agentic-base';
      const activeScheme = colorSchemes.find((s) => s.value === colorSchemeKey) || colorSchemes[0];
      const activeColors = activeScheme ? activeScheme.colors : (Array.isArray(funnelPiePalette) && funnelPiePalette.length ? funnelPiePalette : fallback);
      const pal = activeColors.map(resolve).filter(Boolean);
      const amColors = pal.map((c) => { try { return am5.color(c); } catch { return am5.color(0x888888); } });
      const colorSet = am5.ColorSet.new(root, { colors: amColors as any });
      chart.set('colors', colorSet);
      if (chart.get('colors')) chart.get('colors').set('step', 1);
      // Expose the colorSet globally so adapters can reliably access it
      try { (window as any).__appliedFunnelColorSet = colorSet; } catch (e) { }
      try { setLegendPalette(pal); } catch (e) { }
    } catch (e) { }

    // Add legend
    const legend = chart.children.push(
      am5.Legend.new(root, {
        centerX: am5.p50,
        x: am5.p50,
        marginTop: 28,
        marginBottom: 15,
        layout: root.horizontalLayout,
      })
    );

    legend.data.setAll(series.dataItems);

    // In-chart amCharts legend is always hidden: the React DOM legend below supports Previous/Next scrolling.
    try {
      legend.set('visible', false);
      legend.set('opacity', 0);
      legend.set('marginTop', 0);
      legend.set('marginBottom', 0);
      legend.set('height', 0);
      try {
        legend.set('forceHidden', true);
      } catch (e) { }
    } catch (e) { }

    // Ensure legend label template uses requested font sizing and foreground (applies to newly created labels)
    try {
      legend.labels.template.setAll({ fontSize: 12, fontWeight: '400', fill: foregroundColor });
    } catch (e) { }

    // Ensure legend value labels (separate percentage/value elements) use the same sizing
    try {
      legend.valueLabels.template.setAll({ fontSize: 12, fontWeight: '400', fill: foregroundColor });
    } catch (e) { }

    // Configure series labels based on customization labelContents
    // Uses dimensionText consistently (built from dimension fields in API order)
    // Always rebuild from originalData to ensure all dimension fields are included
    try {
      const showSeriesLabels = optionsRaw.showLabels !== undefined ? optionsRaw.showLabels : true;
      try {
        const fontSize = optionsRaw.fontSize || 12;
        const horizontalFunnel = funnelOrientation === 'horizontal';
        // Horizontal funnel: rotate labels -90° so text runs along slice height (matches reference:
        // centered inside each block, reading bottom-to-top). Vertical funnel: horizontal text.
        series.labels.template.setAll({
          visible: showSeriesLabels,
          fontSize,
          rotation: horizontalFunnel ? -90 : 0,
          centerX: am5.p50,
          centerY: am5.p50,
          textAlign: 'center',
          oversizedBehavior: horizontalFunnel ? ('fit' as 'fit' | 'truncate') : ('truncate' as 'fit' | 'truncate'),
          fill: foregroundColor,
        });
      } catch (e) { }

      try {
        series.labels.template.adapters.add('fill', (_fill: any, target: any) => {
          try {
            const di = target.dataItem as any;
            const slice = di?.get?.('slice');
            let sliceFill = slice?.get?.('fill');
            if (sliceFill == null && di) {
              const idx = typeof di.index === 'number' ? di.index : -1;
              const cs = (chart.get('colors') as any) || (typeof window !== 'undefined' ? (window as any).__appliedFunnelColorSet : null);
              if (idx >= 0 && cs && typeof cs.getIndex === 'function') sliceFill = cs.getIndex(idx);
            }
            return labelFillOnSliceBackground(sliceFill, foregroundColor);
          } catch (e) { }
          return foregroundColor;
        });
      } catch (e) { }

      try {
        series.labels.template.adapters.add('fontSize', (fs: any, target: any) => {
          try {
            const currentWindowOpts = (typeof window !== 'undefined' ? (window as any).__chartCustomizationOptions : null) || {};
            const currentCustomOpts = customizationRef.current || {};
            const currentOptions = { ...funnelDefaultOptions, ...currentWindowOpts, ...currentCustomOpts };
            const base = Number(currentOptions.fontSize) || 12;
            const di = target.dataItem as any;
            const ctx = di?.dataContext;
            if (!ctx || typeof ctx.value !== 'number') return base;
            const share = total > 0 ? Math.min(1, Math.max(0, ctx.value / total)) : 0;
            let out = base;
            const horizF = funnelOrientation === 'horizontal';
            if (horizF) {
              if (share < 0.015) out = Math.max(8, base * 0.78);
              else if (share < 0.04) out = Math.max(9, base * 0.88);
              else if (share < 0.09) out = Math.max(10, base * 0.94);
            } else {
              if (share < 0.015) out = Math.max(7, base * 0.62);
              else if (share < 0.04) out = Math.max(8, base * 0.78);
              else if (share < 0.09) out = Math.max(9, base * 0.88);
            }
            return Math.round(out);
          } catch (e) { }
          return fs;
        });
      } catch (e) { }

      try {
        series.labels.template.adapters.add('maxWidth', (mw: any, target: any) => {
          try {
            const di = target.dataItem as any;
            const ctx = di?.dataContext;
            if (!ctx || typeof ctx.value !== 'number') return mw;
            const share = total > 0 ? Math.min(1, Math.max(0, ctx.value / total)) : 0;
            const horiz = funnelOrientation === 'horizontal';
            // Rotated (-90°) labels: maxWidth is the unrotated line length, which maps to vertical span
            // on screen — use larger caps so "Name: 12.34%" can use slice height like the reference.
            if (horiz) {
              if (share < 0.02) return 160;
              if (share < 0.05) return 220;
              if (share < 0.12) return 280;
              return 340;
            }
            if (share < 0.03) return 90;
            if (share < 0.08) return 140;
            return 220;
          } catch (e) { }
          return mw;
        });
      } catch (e) { }
      // Also ensure per-data-item and slice labels follow the same visibility
      try {
        const dataItemsAny: any = series.dataItems;
        if (dataItemsAny && typeof dataItemsAny.each === 'function') {
          dataItemsAny.each((di: any) => {
            try {
              const lbl = di.get && di.get('label') ? di.get('label') : (di.label || null);
              if (lbl && typeof lbl.set === 'function') lbl.set('visible', showSeriesLabels);
              const slice = di.get && di.get('slice') ? di.get('slice') : (di.slice || null);
              if (slice) {
                const sLbl = slice.get && slice.get('label') ? slice.get('label') : (slice.label || null);
                if (sLbl && typeof sLbl.set === 'function') sLbl.set('visible', showSeriesLabels);
              }
            } catch (e) { }
          });
        }
      } catch (e) { }

      // Add text adapter that reads current options dynamically (will override previous adapters)
      // Make label contents support the same templating tokens as tooltip contents
      series.labels.template.adapters.add('text', (text, target) => {
        try {
          const currentWindowOpts = (typeof window !== 'undefined' ? (window as any).__chartCustomizationOptions : null) || {};
          const currentCustomOpts = customizationRef.current || {};
          const currentOptions = { ...funnelDefaultOptions, ...currentWindowOpts, ...currentCustomOpts };
          // Allow labelContents to mirror tooltipContents tokens
          const labelTpl = currentOptions.labelContents || currentOptions.tooltipContents || 'category_value_percentage';

          const dataItem = (target as any).dataItem;
          if (dataItem && dataItem.dataContext) {
            const ctx = dataItem.dataContext as any;
            const numericPart = formatNumber(ctx.value, { format: numberFormat === 'adaptive' ? 'short' : numberFormat });
            const formattedValue = formatValueWithCurrency(ctx.value, numericPart);
            const percentage = total > 0 ? ((ctx.value / total) * 100).toFixed(2) : '0.00';

            // Rebuild dimension text from originalData to ensure all dimension fields are included
            let dimensionLabel = '';
            if (ctx.originalData && dimensionFields && dimensionFields.length > 0) {
              dimensionLabel = buildDimensionText(ctx.originalData, dimensionFields);
            }
            if (!dimensionLabel && ctx.dimensionText) {
              dimensionLabel = ctx.dimensionText;
            }
            if (!dimensionLabel) {
              dimensionLabel = ctx.category || ctx.name || '';
            }

            const horiz = funnelOrientation === 'horizontal';
            const share = total > 0 ? Math.min(1, Math.max(0, Number(ctx.value) / total)) : 0;

            const truncLabel = (s: string, max: number) =>
              s.length > max ? `${s.slice(0, Math.max(0, max - 1))}…` : s;

            const maxCharsForShare = (cap: number) => {
              const base = horiz ? Math.min(cap, 56) : cap;
              if (share < 0.02) return Math.max(horiz ? 10 : 6, Math.round(base * (horiz ? 0.55 : 0.35)));
              if (share < 0.045) return Math.max(horiz ? 14 : 8, Math.round(base * (horiz ? 0.72 : 0.52)));
              if (share < 0.09) return Math.max(horiz ? 18 : 10, Math.round(base * (horiz ? 0.82 : 0.68)));
              if (share < 0.16) return Math.round(base * (horiz ? 0.92 : 0.86));
              return base;
            };

            const finalizeInside = (raw: string) => {
              const s = String(raw || '').replace(/\s+/g, ' ').trim();
              if (!s) return `${percentage}%`;
              const cap = horiz ? 52 : 72;
              return truncLabel(s, maxCharsForShare(cap));
            };

            if (share < 0.012) return `${percentage}%`;

            // If user prefers Sunburst-style labels (adaptive behavior): show only name for adaptive
            const numberFormatOpt = currentOptions.numberFormat || 'adaptive';
            if (!labelTpl || labelTpl === 'category_name' || numberFormatOpt === 'adaptive') {
              if (numberFormatOpt === 'adaptive') {
                const name = dimensionLabel || ctx.category || ctx.name || '';
                // Reference-style horizontal slice: "Stage: 12.34%" on one line, then rotated with slice.
                if (horiz) return finalizeInside(`${name}: ${percentage}%`);
                return finalizeInside(name || text || '');
              }
              if (labelTpl === 'category_name') {
                return finalizeInside(dimensionLabel || ctx.category || ctx.name || text || '');
              }
            }

            // Otherwise, build using tokens (value, percentage, category)
            const parts: string[] = [];
            if (labelTpl.includes('category')) parts.push(dimensionLabel);
            if (labelTpl.includes('value')) parts.push(formattedValue);
            if (labelTpl.includes('percentage')) parts.push(`${percentage}%`);
            if (horiz && labelTpl.includes('category') && labelTpl.includes('percentage')) {
              const nm = dimensionLabel || ctx.category || '';
              if (labelTpl.includes('value')) {
                return finalizeInside(`${nm}: ${formattedValue} (${percentage}%)`);
              }
              return finalizeInside(`${nm}: ${percentage}%`);
            }
            return finalizeInside(parts.join(' '));
          }
        } catch (e) { }
        return text || '';
      });
      // Force existing labels to refresh so changes to `labelContents` take effect immediately
      const refreshLabels = () => {
        try {
          // Invalidate all labels
          if (series.labels && typeof series.labels.each === 'function') {
            series.labels.each((lbl: any) => {
              try { if (typeof lbl.markDirty === 'function') lbl.markDirty(); } catch (e) { }
              try { if (typeof lbl.invalidate === 'function') lbl.invalidate(); } catch (e) { }
              try { if (typeof lbl.invalidateText === 'function') lbl.invalidateText(); } catch (e) { }
            });
          }
          // Also mark any per-data-item labels or slice labels dirty
          const dataItemsAny: any = series.dataItems;
          try {
            if (dataItemsAny && typeof dataItemsAny.each === 'function') {
              dataItemsAny.each((di: any) => {
                try {
                  const lbl = di.get && di.get('label') ? di.get('label') : (di.label || null);
                  if (lbl) {
                    try { if (typeof lbl.markDirty === 'function') lbl.markDirty(); } catch (e) { }
                    try { if (typeof lbl.invalidate === 'function') lbl.invalidate(); } catch (e) { }
                    try { if (typeof lbl.invalidateText === 'function') lbl.invalidateText(); } catch (e) { }
                  }
                  const slice = di.get && di.get('slice') ? di.get('slice') : (di.slice || null);
                  if (slice) {
                    const sLbl = slice.get && slice.get('label') ? slice.get('label') : (slice.label || null);
                    if (sLbl) {
                      try { if (typeof sLbl.markDirty === 'function') sLbl.markDirty(); } catch (e) { }
                      try { if (typeof sLbl.invalidate === 'function') sLbl.invalidate(); } catch (e) { }
                      try { if (typeof sLbl.invalidateText === 'function') sLbl.invalidateText(); } catch (e) { }
                    }
                  }
                } catch (e) { }
              });
            }
          } catch (e) { }
          // Invalidate series and chart
          try { if (typeof (series as any).invalidateData === 'function') (series as any).invalidateData(); } catch (e) { }
          try { if (chart && typeof (chart as any).invalidateData === 'function') (chart as any).invalidateData(); } catch (e) { }
          try { if (typeof (chart as any).markDirty === 'function') (chart as any).markDirty(); } catch (e) { }
        } catch (e) { }
      };

      // Refresh immediately and after a short delay
      refreshLabels();
      setTimeout(() => refreshLabels(), 50);
      setTimeout(() => refreshLabels(), 150);
    } catch (e) { }

    // Format legend text to show all dimensions
    // Uses dimensionText consistently (built from dimension fields in API order)
    // Always rebuild from originalData to ensure all dimension fields are included
    try {
      const totalValue = total || 0;
      // Legend should follow the same dynamic template tokens as labels/tooltips
      legend.labels.template.adapters.add('text', (text, target) => {
        try {
          const currentWindowOpts = (typeof window !== 'undefined' ? (window as any).__chartCustomizationOptions : null) || {};
          const currentCustomOpts = customizationRef.current || {};
          const currentOptions = { ...funnelDefaultOptions, ...currentWindowOpts, ...currentCustomOpts };
          const labelTpl = currentOptions.labelContents || currentOptions.tooltipContents || 'category_value_percentage';

          const dataItem = target.dataItem;
          if (dataItem && dataItem.dataContext) {
            const ctx = dataItem.dataContext as any;
            const numericPart = formatNumber(ctx.value, { format: numberFormat === 'adaptive' ? 'short' : numberFormat });
            const formattedValue = formatValueWithCurrency(ctx.value, numericPart);
            const percentage = totalValue > 0 ? ((ctx.value / totalValue) * 100).toFixed(2) : '0.00';

            // Rebuild name/dimension from originalData when available
            let namePart = '';
            if (ctx.originalData && dimensionFields && dimensionFields.length > 0) {
              namePart = buildDimensionText(ctx.originalData, dimensionFields);
            }
            if (!namePart && ctx.dimensionText) namePart = ctx.dimensionText;
            if (!namePart) namePart = ctx.category || ctx.name || '';

            const parts: string[] = [];
            if (labelTpl === 'category_name') {
              parts.push(namePart);
            } else if (labelTpl === 'value') {
              parts.push(formattedValue);
            } else if (labelTpl === 'percentage') {
              parts.push(`${percentage}%`);
            } else {
              if (labelTpl.includes('value')) parts.push(formattedValue);
              if (labelTpl.includes('percentage')) parts.push(`(${percentage}%)`);
              if (labelTpl.includes('category')) parts.push(namePart);
            }

            return parts.join(' ');
          }
        } catch (e) { }
        return text || '';
      });
    } catch (e) { }

    // Apply colors from the selected color set to slices and legend markers
    try {
      if ((window as any).__appliedFunnelColorSet) {
        // if global reference exists use it
      }
      // series slice fill adapter
      (series.slices.template as any).adapters.add('fill', (fill: any, target: any) => {
        try {
          const di = (target as any).dataItem;
          const idx = di && typeof di.index === 'number' ? di.index : -1;
          if (typeof idx === 'number' && idx >= 0) {
            const cs = (window as any).__appliedFunnelColorSet || (chart.get('colors') as any);
            if (cs && typeof cs.getIndex === 'function') return cs.getIndex(idx);
          }
        } catch (e) { }
        return fill;
      });
      // Ensure adapters do not introduce separators between slices
      (series.slices.template as any).adapters.add('stroke', (s: any, target: any) => {
        try { return undefined; } catch (e) { }
        return s;
      });
      (series.slices.template as any).adapters.add('strokeWidth', (w: any) => {
        try { return 0; } catch (e) { }
        return w;
      });
      (series.slices.template as any).adapters.add('strokeOpacity', (o: any) => {
        try { return 0; } catch (e) { }
        return o;
      });
      // Disable connector/transition bands and side faces
      (series.slices.template as any).adapters.add('sideFace', (_sf: any) => {
        try {
          return undefined;
        } catch (e) { }
        return _sf;
      });
      // Ensure no gradients
      (series.slices.template as any).adapters.add('fillGradient', (_g: any) => {
        try {
          return undefined;
        } catch (e) { }
        return _g;
      });
      // Ensure no shadows
      (series.slices.template as any).adapters.add('shadow', (_s: any) => {
        try {
          return undefined;
        } catch (e) { }
        return _s;
      });
      // Ensure no filters
      (series.slices.template as any).adapters.add('filter', (_f: any) => {
        try {
          return undefined;
        } catch (e) { }
        return _f;
      });

      // Legend marker should reflect slice fill
      (legend.markers.template as any).adapters.add('fill', (fill: any, target: any) => {
        try {
          const di = target.dataItem;
          if (di && di.dataContext) {
            const slice = di.get('slice');
            if (slice) return slice.get('fill');
          }
        } catch (e) { }
        return fill;
      });
      (legend.markers.template as any).adapters.add('stroke', (s: any, target: any) => {
        try {
          const di = target.dataItem;
          if (di && di.dataContext) {
            const slice = di.get('slice');
            if (slice) return slice.get('stroke');
          }
        } catch (e) { }
        return s;
      });
    } catch (e) { }

    // Ensure all legend labels have consistent, compact font size and foreground color after data is set
    try { legend.labels.template.setAll({ fill: foregroundColor }); } catch (e) { }
    setTimeout(() => {
      legend.labels.each((label) => {
        label.set('fontSize', 12);
        label.set('fontWeight', '400');
        label.set('fill', foregroundColor);
      });
    }, 100);

    // Make legend items interactive
    legend.itemContainers.template.events.on('click', (ev) => {
      const target = ev.target;
      if (target.dataItem && target.dataItem.dataContext) {
        const dataItem = target.dataItem.dataContext as am5.DataItem<any>;
        const slice = dataItem.get('slice');
        if (slice) {
          if (slice.isHidden()) {
            slice.show();
          } else {
            slice.hide();
          }
        }
      }
    });

    // Style legend items (more compact)
    legend.itemContainers.template.setAll({
      paddingTop: 4,
      paddingBottom: 2,
      paddingLeft: 6,
      paddingRight: 6,
      cursorOverStyle: 'pointer',
    });

    // Apply legend orientation and margin from customization
    try {
      const orient = optionsRaw.legendOrientation || 'bottom';
      const isSideLegend = orient === 'left' || orient === 'right';
      if (isSideLegend) {
        legend.set('layout', root.verticalLayout);
        legend.set('x', orient === 'left' ? 0 : am5.p100);
        legend.set('centerX', orient === 'left' ? am5.p0 : am5.p100);
      } else {
        legend.set('layout', root.horizontalLayout);
        legend.set('x', am5.p50);
        legend.set('centerX', am5.p50);
      }
      // Legend is hidden (DOM legend below); do not reserve vertical gap under the funnel.
      legend.set('marginTop', 0);
      legend.set('marginBottom', 0);
    } catch (e) { }

    // Style legend markers (smaller)
    legend.markers.template.setAll({
      width: 8,
      height: 8,
    });

    // Ref so pointerdown fallback does not dispatch when slice click already fired with exact slice

    // Build drilldown payload from slice context (same pattern as PieChart: dynamic, no hardcoding)
    const buildDrilldownDetail = (context: { category?: string; value?: number; originalData?: any; dimensionText?: string } | null): any => {
      if (!context) return null;
      const orig = context.originalData ?? context;
      const categoryVal = context.category;
      const valueVal = context.value;

      const inferColumn = (o: any, cat: any, val: any) => {
        try {
          if (!o || typeof o !== 'object') return null;
          const keys = Object.keys(o).filter((k: string) => k !== 'value' && k !== 'category');
          // positional/token match when dimensionFields are present
          if (Array.isArray(dimensionFields) && dimensionFields.length > 0 && typeof cat === 'string') {
            const tokens = String(cat || '').split(',').map((t) => String(t).trim());
            for (let i = 0; i < dimensionFields.length; i++) {
              const k = dimensionFields[i];
              const token = tokens[i] ?? '';
              const ov = o[k];
              if (ov === null || ov === undefined) {
                if (token === '—' || token === '' || token.toUpperCase() === 'NULL') return k;
              } else {
                if (String(ov) === token) return k;
              }
            }
          }
          for (const k of keys) {
            try { if ((o[k] === null || o[k] === undefined) && String(cat).includes('—')) return k; } catch { }
            try { if (String(o[k]) === String(cat)) return k; } catch { }
          }
          for (const k of keys) {
            try { if (!isNaN(Number(o[k])) && !isNaN(Number(val)) && Number(o[k]) === Number(val)) return k; } catch { }
          }
          return null;
        } catch {
          return null;
        }
      };

      const column = inferColumn(orig, categoryVal, valueVal);

      // Choose field dynamically: inferred column -> first dimension field -> fallback to 'category'
      const chosenField = column || (Array.isArray(dimensionFields) && dimensionFields.length ? dimensionFields[0] : 'category');

      // Pick chosen value: prefer originalData[column] or originalData[chosenField], otherwise use category text
      // Treat null/undefined/empty as missing and fall back to the first non-null dimension value
      let chosenValue: any = undefined;
      try {
        // Prefer inferred column when it has a non-null/undefined/non-empty value
        if (
          column &&
          Object.prototype.hasOwnProperty.call(orig, column) &&
          orig[column] !== null &&
          orig[column] !== undefined &&
          String(orig[column]) !== ''
        ) {
          chosenValue = orig[column];
        } else if (
          chosenField &&
          Object.prototype.hasOwnProperty.call(orig, chosenField) &&
          orig[chosenField] !== null &&
          orig[chosenField] !== undefined &&
          String(orig[chosenField]) !== ''
        ) {
          chosenValue = orig[chosenField];
        } else if (Array.isArray(dimensionFields) && dimensionFields.length > 0) {
          // fallback: pick first non-null dimension value from original data
          for (const f of dimensionFields) {
            try {
              if (Object.prototype.hasOwnProperty.call(orig, f) && orig[f] !== null && orig[f] !== undefined && String(orig[f]) !== '') {
                chosenValue = orig[f];
                break;
              }
            } catch { }
          }
        }
      } catch { }
      // If still not found, consult any preserved originalRows (grouped series) for a non-null value
      try {
        if ((chosenValue === undefined || chosenValue === null) && Array.isArray((orig as any)?.originalRows)) {
          const rowsArr = (orig as any).originalRows as any[];
          if (column) {
            for (const row of rowsArr) {
              try {
                if (row && Object.prototype.hasOwnProperty.call(row, column) && row[column] !== null && row[column] !== undefined && String(row[column]) !== '') {
                  chosenValue = row[column];
                  break;
                }
              } catch { }
            }
          }
          if ((chosenValue === undefined || chosenValue === null) && chosenField) {
            for (const row of rowsArr) {
              try {
                if (row && Object.prototype.hasOwnProperty.call(row, chosenField) && row[chosenField] !== null && row[chosenField] !== undefined && String(row[chosenField]) !== '') {
                  chosenValue = row[chosenField];
                  break;
                }
              } catch { }
            }
          }
          if ((chosenValue === undefined || chosenValue === null) && Array.isArray(dimensionFields)) {
            for (const f of dimensionFields) {
              if (chosenValue !== undefined && chosenValue !== null && String(chosenValue) !== '') break;
              for (const row of rowsArr) {
                try {
                  if (row && Object.prototype.hasOwnProperty.call(row, f) && row[f] !== null && row[f] !== undefined && String(row[f]) !== '') {
                    chosenValue = row[f];
                    break;
                  }
                } catch { }
              }
            }
          }
        }
      } catch { }
      // Treat null/undefined as missing and fall back to the category text
      if (chosenValue === undefined || chosenValue === null) chosenValue = categoryVal;

      const dimText = (typeof buildDimensionText === 'function' && Array.isArray(dimensionFields)) ? buildDimensionText(orig, dimensionFields) : (context.dimensionText || categoryVal);

      // Merge non-null values from any preserved originalRows into originalData so
      // downstream consumers (ChartFormulator) receive the most-complete row possible.
      let mergedOriginalData: any = (orig && typeof orig === 'object') ? { ...orig } : orig;
      try {
        const rowsArr = Array.isArray((orig as any)?.originalRows) ? (orig as any).originalRows as any[] : undefined;
        if (rowsArr && Array.isArray(rowsArr) && rowsArr.length > 0 && mergedOriginalData && typeof mergedOriginalData === 'object') {
          // For each dimension field, if mergedOriginalData is missing the value,
          // prefer the first non-null/non-empty value found in originalRows.
          for (const f of dimensionFields || []) {
            try {
              const cur = mergedOriginalData[f];
              if (cur === null || cur === undefined || String(cur) === '') {
                for (const row of rowsArr) {
                  try {
                    if (row && Object.prototype.hasOwnProperty.call(row, f) && row[f] !== null && row[f] !== undefined && String(row[f]) !== '') {
                      mergedOriginalData[f] = row[f];
                      break;
                    }
                  } catch { }
                }
              }
            } catch { }
          }
          // Also attempt to fill the inferred column if missing
          if (column && (mergedOriginalData[column] === null || mergedOriginalData[column] === undefined || String(mergedOriginalData[column]) === '')) {
            for (const row of rowsArr) {
              try {
                if (row && Object.prototype.hasOwnProperty.call(row, column) && row[column] !== null && row[column] !== undefined && String(row[column]) !== '') {
                  mergedOriginalData[column] = row[column];
                  break;
                }
              } catch { }
            }
          }
        }
      } catch { }

      // Prefer mergedOriginalData values if they provide a non-null chosen value
      const finalChosenValue = (mergedOriginalData && typeof mergedOriginalData === 'object' && chosenField && Object.prototype.hasOwnProperty.call(mergedOriginalData, chosenField) && mergedOriginalData[chosenField] !== null && mergedOriginalData[chosenField] !== undefined && String(mergedOriginalData[chosenField]) !== '')
        ? mergedOriginalData[chosenField]
        : chosenValue;

      const detail: any = {
        field: chosenField,
        value: finalChosenValue,
        originalData: mergedOriginalData,
        dimensionFields: Array.isArray(dimensionFields) ? [...dimensionFields] : [],
        dimensionText: dimText,
      };
      // Build explicit drillFilters: include every non-empty real dimension value
      try {
        const drillFilters: any[] = [];
        const fields = Array.isArray(dimensionFields) ? dimensionFields : [];
        for (const f of fields) {
          try {
            if (!f) continue;
            const v = mergedOriginalData && Object.prototype.hasOwnProperty.call(mergedOriginalData, f) ? mergedOriginalData[f] : undefined;
            if (v !== null && v !== undefined && String(v) !== '') drillFilters.push({ column: f, value: v });
          } catch { }
        }
        // If none found, include chosenField/column when present and non-empty
        if (drillFilters.length === 0) {
          const fallbackKey = column || chosenField;
          try {
            if (fallbackKey && mergedOriginalData && Object.prototype.hasOwnProperty.call(mergedOriginalData, fallbackKey) && mergedOriginalData[fallbackKey] !== null && mergedOriginalData[fallbackKey] !== undefined && String(mergedOriginalData[fallbackKey]) !== '') {
              drillFilters.push({ column: fallbackKey, value: mergedOriginalData[fallbackKey] });
            }
          } catch { }
        }
        if (drillFilters.length > 0) detail.drillFilters = drillFilters;
      } catch { }
      try { if (typeof console !== 'undefined') console.log('FunnelChart: buildDrilldownDetail (final)', detail); } catch (e) { }
      try {
        if (typeof console !== 'undefined') console.log('FunnelChart: buildDrilldownDetail', detail);
      } catch (e) { }
      if (column) detail.column = column;
      return detail;
    };

    // Resolve which slice is at (clientX, clientY) using position so we send the correct segment (avoids ev.target giving wrong slice).
    const resolveSliceAt = (clientX: number, clientY: number): { category: string; value: number; originalData?: any } | null => {
      const container = chartRef.current;
      if (!container || sortedData.length === 0) return null;
      try {
        if (typeof document !== 'undefined' && document.elementFromPoint) {
          let cur: Element | null = document.elementFromPoint(clientX, clientY) as Element | null;
          while (cur && cur !== container && cur !== document.documentElement) {
            const id = cur.getAttribute?.('data-funnel-di');
            if (id && sliceNodeIdMap.has(id)) {
              const ctx = sliceNodeIdMap.get(id);
              if (ctx) return { category: ctx.category, value: ctx.value, originalData: ctx.originalData ?? ctx };
            }
            cur = cur.parentElement;
          }
        }
      } catch (_) { }
      const dataItemsAny: any = series.dataItems;
      let itemsArray: any[] = [];
      try {
        if (dataItemsAny?.each) dataItemsAny.each((di: any) => itemsArray.push(di));
        else if (Array.isArray(dataItemsAny)) itemsArray = dataItemsAny;
        else if (dataItemsAny?.toArray) itemsArray = dataItemsAny.toArray();
      } catch (_) { }
      if (itemsArray.length > 0) {
        const containing: Array<{ area: number; context: any }> = [];
        for (const di of itemsArray) {
          try {
            const sliceEl = di.get?.('slice') ?? di.slice;
            const node = sliceEl?.get?.('node') ?? sliceEl?.node ?? sliceEl?._node;
            if (node && (node as Element).getBoundingClientRect) {
              const r = (node as Element).getBoundingClientRect();
              if (clientX >= r.left && clientX <= r.right && clientY >= r.top && clientY <= r.bottom) {
                const ctx = di.dataContext || di;
                containing.push({ area: (r.width || 0) * (r.height || 0), context: ctx });
              }
            }
          } catch (_) { }
        }
        if (containing.length > 0) {
          containing.sort((a, b) => a.area - b.area);
          const ctx = containing[0].context;
          return { category: ctx.category, value: ctx.value, originalData: ctx.originalData ?? ctx };
        }
      }
      const rect = container.getBoundingClientRect();
      if (!rect || rect.width <= 0 || rect.height <= 0) return null;
      const totalVals = sortedData.reduce((s, it) => s + (Number(it.value) || 0), 0);
      if (totalVals <= 0) return null;
      let ratio = funnelOrientation === 'vertical'
        ? (clientY - rect.top) / rect.height
        : (clientX - rect.left) / rect.width;
      ratio = Math.max(0, Math.min(1, ratio));
      if (funnelOrientation === 'horizontal') ratio = 1 - ratio;
      let acc = 0;
      for (let i = 0; i < sortedData.length; i++) {
        const v = Number(sortedData[i].value) || 0;
        if (ratio < (acc + v) / totalVals) {
          const row = sortedData[i];
          return { category: row.category, value: row.value, originalData: row.originalData ?? row };
        }
        acc += v;
      }
      const last = sortedData[sortedData.length - 1];
      return last ? { category: last.category, value: last.value, originalData: last.originalData ?? last } : null;
    };

    // Slice click: prefer position-based resolution so we send the correct segment (ev.target can be wrong slice).
    series.slices.template.events.on('click', (ev: any) => {
      try {
        funnelSliceDispatchedRef.current = true;
        let context: { category: string; value: number; originalData?: any } | null = resolveSliceAt(ev.clientX, ev.clientY);
        if (!context) {
          let target: any = ev.target;
          let dataItem = target?.dataItem;
          while (!dataItem && target?.parent) {
            target = target.parent;
            dataItem = target?.dataItem;
          }
          if (dataItem?.dataContext) context = dataItem.dataContext as { category: string; value: number; originalData?: any };
        }
        if (!context) {
          try { if (typeof console !== 'undefined') console.log('FunnelChart: slice click - no dataContext, abort'); } catch (e) { }
          return;
        }
        try { if (typeof console !== 'undefined') console.log('FunnelChart: slice click dataContext', context); } catch (e) { }
        const detail = buildDrilldownDetail(context);
        if (!detail) {
          try { if (typeof console !== 'undefined') console.log('FunnelChart: buildDrilldownDetail returned null for slice click', context); } catch (e) { }
          return;
        }
        try {
          try { if (typeof console !== 'undefined') console.log('FunnelChart: slice click detail', detail); } catch (e) { }
          if (onChartInteraction) {
            try { if (typeof console !== 'undefined') console.log('FunnelChart: calling onChartInteraction', { field: detail.field, value: detail.value }); } catch (e) { }
            onChartInteraction(detail.field, detail.value);
          }
        } catch (e) {
          try { if (typeof console !== 'undefined') console.log('FunnelChart: onChartInteraction error', e); } catch (e) { }
        }
        try {
          if (typeof window !== 'undefined' && (window as any).dispatchEvent) {
            try { if (typeof console !== 'undefined') console.log('FunnelChart: dispatching pieSliceInteraction (click)', detail); } catch (e) { }
            window.dispatchEvent(new CustomEvent('pieSliceInteraction', { detail }));
          } else {
            try { if (typeof console !== 'undefined') console.log('FunnelChart: window.dispatchEvent unavailable'); } catch (e) { }
          }
        } catch (e) {
          try { if (typeof console !== 'undefined') console.log('FunnelChart: dispatch error', e); } catch (e) { }
        }
        try { setTimeout(() => { funnelSliceDispatchedRef.current = false; }, 300); } catch (e) { }
      } catch (e) { }
    });

    series.appear();
    // Fallback: when canvas is used, pointer may not hit slice DOM; resolve slice and dispatch
    // only if slice click did not fire (delayed fallback so exact slice wins).
    let captureFn: (ev: PointerEvent) => void = () => { };
    try {
      captureFn = (ev: PointerEvent) => {
        try {
          const container = chartRef.current;
          if (!container || !series?.dataItems?.length) return;
          const target = ev.target as Node | null;

          let pendingDetail: any = null;
          let foundBySliceDom = false;

          // 1) Prefer elementFromPoint lookup using stable data attributes
          try {
            if (typeof document !== 'undefined' && typeof document.elementFromPoint === 'function') {
              const el = document.elementFromPoint(ev.clientX, ev.clientY) as Element | null;
              let cur: Element | null = el;
              while (cur && cur !== container && cur !== document.documentElement) {
                try {
                  const id = cur.getAttribute && cur.getAttribute('data-funnel-di');
                  if (id && sliceNodeIdMap.has(id)) {
                    const ctx = sliceNodeIdMap.get(id);
                    pendingDetail = buildDrilldownDetail({ category: ctx?.category, value: ctx?.value, originalData: ctx?.originalData ?? ctx, dimensionText: ctx?.dimensionText });
                    if (pendingDetail) {
                      foundBySliceDom = true;
                      try { if (typeof console !== 'undefined') console.log('FunnelChart: capture elementFromPoint matched', { id, ctx, pendingDetail }); } catch (e) { }
                      break;
                    }
                  }
                } catch (e) { }
                cur = cur.parentElement;
              }
            }
          } catch (e) { }

          // Fallback: iterate dataItems and check containment for complex node structures
          if (!pendingDetail) {
            const dataItemsAny: any = series.dataItems;
            const iterate = (cb: (di: any) => void) => {
              if (!dataItemsAny) return;
              if (typeof dataItemsAny.each === 'function') dataItemsAny.each(cb);
              else if (Array.isArray(dataItemsAny)) dataItemsAny.forEach(cb);
              else if (dataItemsAny?.toArray) dataItemsAny.toArray().forEach(cb);
            };
            iterate((di: any) => {
              if (pendingDetail) return;
              try {
                const sliceEl = di.get?.('slice') ?? di.slice;
                if (!sliceEl) return;
                const node = sliceEl.get?.('node') ?? sliceEl.node ?? sliceEl._node;
                if (node && target && typeof (node as Node).contains === 'function' && (node as Node).contains(target)) {
                  const context = (di.dataContext || null) as { category?: string; value?: number; originalData?: any } | null;
                  pendingDetail = buildDrilldownDetail(context);
                  if (pendingDetail) {
                    foundBySliceDom = true;
                    try { if (typeof console !== 'undefined') console.log('FunnelChart: capture found slice DOM', { context, pendingDetail }); } catch (e) { }
                  }
                }
              } catch (_) { }
            });
          }

          // 2) If no DOM hit (e.g. canvas), map position to slice index using sortedData (same order as rendered)
          // Vertical: top=index 0; horizontal: left=index 0. Segment bounds [acc/total, (acc+v)/total).
          if (!pendingDetail) {
            const rect = container.getBoundingClientRect();
            if (rect.width > 0 && rect.height > 0) {
              // Prefer actual rendered series dataItems order when available
              let itemsArray: any[] = [];
              try {
                const dataItemsAny: any = series.dataItems;
                if (dataItemsAny) {
                  if (typeof dataItemsAny.each === 'function') {
                    dataItemsAny.each((di: any) => itemsArray.push(di));
                  } else if (Array.isArray(dataItemsAny)) {
                    itemsArray = dataItemsAny;
                  } else if (dataItemsAny?.toArray) {
                    itemsArray = dataItemsAny.toArray();
                  }
                }
              } catch (e) { itemsArray = []; }

              // Build an ordered array of row contexts (fall back to sortedData if no items)
              const orderedRows = (itemsArray && itemsArray.length > 0)
                ? itemsArray.map((di: any) => di.dataContext || di)
                : sortedData;

              // First attempt: hit-test slice bounds; pick smallest containing slice so we get the actual clicked segment
              let hitFound = false;
              try {
                if (itemsArray && itemsArray.length > 0) {
                  const containing: Array<{ area: number; context: any }> = [];
                  for (let i = 0; i < itemsArray.length; i++) {
                    try {
                      const di = itemsArray[i];
                      const sliceEl = di.get?.('slice') ?? di.slice;
                      const node = sliceEl?.get?.('node') ?? sliceEl?.node ?? sliceEl?._node;
                      if (node && (node as Element).getBoundingClientRect) {
                        const r = (node as Element).getBoundingClientRect();
                        if (ev.clientX >= r.left && ev.clientX <= r.right && ev.clientY >= r.top && ev.clientY <= r.bottom) {
                          const context = di.dataContext || di;
                          const area = (r.width || 0) * (r.height || 0);
                          containing.push({ area, context });
                        }
                      }
                    } catch (_) { }
                  }
                  if (containing.length > 0) {
                    containing.sort((a, b) => a.area - b.area);
                    const ctx = containing[0].context;
                    pendingDetail = buildDrilldownDetail({ category: ctx.category, value: ctx.value, originalData: ctx.originalData ?? ctx });
                    hitFound = true;
                    foundBySliceDom = true;
                  }
                }
              } catch (_) { hitFound = false; }

              // If hit-testing didn't find a slice, fall back to ratio-based mapping.
              // For horizontal funnel, amCharts draws first (largest) segment on the right, so invert ratio.
              if (!hitFound) {
                const totalVals = orderedRows.reduce((s: number, it: any) => s + (Number(it.value) || 0), 0);
                if (totalVals > 0) {
                  let pointerRatio = funnelOrientation === 'vertical'
                    ? Math.max(0, Math.min(1, (ev.clientY - rect.top) / rect.height))
                    : Math.max(0, Math.min(1, (ev.clientX - rect.left) / rect.width));
                  if (funnelOrientation === 'horizontal') pointerRatio = 1 - pointerRatio;
                  let acc = 0;
                  let foundIndex = -1;
                  for (let i = 0; i < orderedRows.length; i++) {
                    const v = Number(orderedRows[i].value) || 0;
                    if (pointerRatio < (acc + v) / totalVals) { foundIndex = i; break; }
                    acc += v;
                  }
                  if (foundIndex === -1) foundIndex = orderedRows.length - 1;
                  if (foundIndex >= 0) {
                    const row = orderedRows[foundIndex];
                    try { if (typeof console !== 'undefined') console.log('FunnelChart: position fallback matched index', { foundIndex, row, fallbackSource: itemsArray && itemsArray.length > 0 ? 'dataItems' : 'sortedData' }); } catch (e) { }
                    pendingDetail = buildDrilldownDetail({
                      category: row.category,
                      value: row.value,
                      originalData: row.originalData ?? row,
                    });
                    try { if (typeof console !== 'undefined') console.log('FunnelChart: position fallback pendingDetail', pendingDetail); } catch (e) { }
                  }
                }
              }
            }
          }

          // Only dispatch when click was on a funnel slice (DOM hit). Do not use position-based fallback for
          // canvas clicks so that clicking on whitespace does not trigger drilldown.
          if (!pendingDetail) {
            try { if (typeof console !== 'undefined') console.log('FunnelChart: capture no pendingDetail, nothing to do'); } catch (e) { }
          }
          if (pendingDetail && foundBySliceDom) {
            try { if (typeof console !== 'undefined') console.log('FunnelChart: capture will dispatch (foundBySliceDom true), scheduling timeout'); } catch (e) { }
            // Snapshot the pending detail so later mutations don't change what we dispatch
            const detailToDispatch = JSON.parse(JSON.stringify(pendingDetail));
            setTimeout(() => {
              try { if (typeof console !== 'undefined') console.log('FunnelChart: timeout dispatch check, funnelSliceDispatchedRef=', funnelSliceDispatchedRef.current); } catch (e) { }
              if (funnelSliceDispatchedRef.current) {
                try { if (typeof console !== 'undefined') console.log('FunnelChart: dispatch suppressed because slice click handler already ran'); } catch (e) { }
                return;
              }
              try {
                try { if (typeof console !== 'undefined') console.log('FunnelChart: dispatching pieSliceInteraction (capture)', detailToDispatch); } catch (e) { }
                if (typeof window !== 'undefined' && (window as any).dispatchEvent) {
                  window.dispatchEvent(new CustomEvent('pieSliceInteraction', { detail: detailToDispatch }));
                }
              } catch (e) {
                try { if (typeof console !== 'undefined') console.log('FunnelChart: capture dispatch error', e); } catch (e) { }
              }
            }, 80);
          } else if (pendingDetail && !foundBySliceDom) {
            try { if (typeof console !== 'undefined') console.log('FunnelChart: capture found pendingDetail not from DOM', pendingDetail); } catch (e) { }
            // Always dispatch positional matches (caller clicked over computed slice area),
            // even when drillFilters is empty/null — this makes canvas-based clicks behave like DOM slice clicks.
            try {
              try { if (typeof console !== 'undefined') console.log('FunnelChart: positional match scheduling dispatch (positional)', pendingDetail); } catch (e) { }
              // Snapshot to avoid later mutation of pendingDetail affecting scheduled callbacks
              const detailToDispatchPos = JSON.parse(JSON.stringify(pendingDetail));
              setTimeout(() => {
                try { if (typeof console !== 'undefined') console.log('FunnelChart: positional timeout dispatch check, funnelSliceDispatchedRef=', funnelSliceDispatchedRef.current); } catch (e) { }
                if (funnelSliceDispatchedRef.current) {
                  try { if (typeof console !== 'undefined') console.log('FunnelChart: positional dispatch suppressed because click handler already ran'); } catch (e) { }
                  return;
                }
                try {
                  try { if (typeof console !== 'undefined') console.log('FunnelChart: dispatching pieSliceInteraction (positional)', detailToDispatchPos); } catch (e) { }
                  if (typeof window !== 'undefined' && (window as any).dispatchEvent) {
                    window.dispatchEvent(new CustomEvent('pieSliceInteraction', { detail: detailToDispatchPos }));
                  }
                } catch (e) {
                  try { if (typeof console !== 'undefined') console.log('FunnelChart: positional dispatch error', e); } catch (e) { }
                }
              }, 80);
            } catch (e) {
              try { if (typeof console !== 'undefined') console.log('FunnelChart: error evaluating positional pendingDetail', e); } catch (e) { }
            }
          }
        } catch (_) { }
      };
      if (chartRef.current && !chartRef.current.hasAttribute('data-funnel-capture-added')) {
        chartRef.current.addEventListener('pointerdown', captureFn, true);
        chartRef.current.setAttribute('data-funnel-capture-added', '1');
      }
    } catch (_) { }

    const isStreamRefresh =
      typeof window !== 'undefined' && Boolean((window as any).__chartStreamSilentRefresh);
    if (isStreamRefresh) {
      try {
        (window as any).__chartStreamSilentRefresh = false;
      } catch {
        /* ignore */
      }
    } else {
      chart.appear(1000, 100);
    }

    return () => {
      try { window.removeEventListener('chartCustomizationChanged', handleCustomizationChange as EventListener); } catch { }
      const el = chartRef.current;
      if (el) {
        if (el.hasAttribute('data-funnel-capture-added')) {
          el.removeAttribute('data-funnel-capture-added');
          el.removeEventListener('pointerdown', captureFn, true);
        }
      }
      if (rootRef.current) {
        rootRef.current.dispose();
        rootRef.current = null;
      }
    };
  }, [data, funnelOrientation, onChartInteraction, customVersion, theme]);

  // Watch for `customizationOptions` prop changes and update internal customizationRef
  useEffect(() => {
    try {
      if (typeof customizationOptions !== 'undefined' && customizationOptions !== null) {
        customizationRef.current = customizationOptions;
        setCustomVersion((v) => v + 1);
      }
    } catch (e) { }
  }, [customizationOptions]);

  // Separate effect to refresh labels when customization changes
  useEffect(() => {
    if (!rootRef.current) return;

    try {
      const root = rootRef.current;
      const chart = root.container.children.values.find((c: any) => c instanceof am5percent.SlicedChart);
      if (!chart) return;

      const series = (chart as any).series.values.find((s: any) => s instanceof am5percent.FunnelSeries);
      if (!series) return;

      // Force refresh all labels
      if (series.labels && typeof series.labels.each === 'function') {
        series.labels.each((lbl: any) => {
          try { if (typeof lbl.markDirty === 'function') lbl.markDirty(); } catch (e) { }
          try { if (typeof lbl.invalidate === 'function') lbl.invalidate(); } catch (e) { }
          try { if (typeof lbl.invalidateText === 'function') lbl.invalidateText(); } catch (e) { }
        });
      }

      // Also refresh data item labels
      const dataItemsAny: any = series.dataItems;
      if (dataItemsAny && typeof dataItemsAny.each === 'function') {
        dataItemsAny.each((di: any) => {
          try {
            const lbl = di.get && di.get('label') ? di.get('label') : (di.label || null);
            if (lbl) {
              try { if (typeof lbl.markDirty === 'function') lbl.markDirty(); } catch (e) { }
              try { if (typeof lbl.invalidate === 'function') lbl.invalidate(); } catch (e) { }
              try { if (typeof lbl.invalidateText === 'function') lbl.invalidateText(); } catch (e) { }
            }
            const slice = di.get && di.get('slice') ? di.get('slice') : (di.slice || null);
            if (slice) {
              const sLbl = slice.get && slice.get('label') ? slice.get('label') : (slice.label || null);
              if (sLbl) {
                try { if (typeof sLbl.markDirty === 'function') sLbl.markDirty(); } catch (e) { }
                try { if (typeof sLbl.invalidate === 'function') sLbl.invalidate(); } catch (e) { }
                try { if (typeof sLbl.invalidateText === 'function') sLbl.invalidateText(); } catch (e) { }
              }
            }
          } catch (e) { }
        });
      }

      // Invalidate series to force re-render
      try { if (typeof (series as any).invalidateData === 'function') (series as any).invalidateData(); } catch (e) { }
      try { if (typeof (chart as any).invalidateData === 'function') (chart as any).invalidateData(); } catch (e) { }
      try { if (typeof (chart as any).markDirty === 'function') (chart as any).markDirty(); } catch (e) { }
    } catch (e) { }
  }, [customVersion]);

  // Live options for render-time decisions (reads window fallback + live customizationRef)
  const _windowOpts = (typeof window !== 'undefined' ? (window as any).__chartCustomizationOptions : null) || {};
  const optionsLive: any = { ...funnelDefaultOptions, ..._windowOpts, ...(customizationRef.current || {}) };

  const funnelDomLegendItems: ChartDomScrollLegendItem[] =
    !optionsLive || optionsLive.showLegend === false || !legendItems.length
      ? []
      : (() => {
        const totalVal = legendItems.reduce((s, it) => s + (Number(it?.value) || 0), 0) || 1;
        return legendItems.map((item, idx) => {
          const color =
            legendPalette && legendPalette.length ? legendPalette[idx % legendPalette.length] : '#888';
          const line = formatFunnelDomLegendLine(
            item,
            totalVal,
            {
              labelContents: optionsLive.labelContents,
              tooltipContents: optionsLive.tooltipContents,
              numberFormat: optionsLive.numberFormat,
              currencyFormat: optionsLive.currencyFormat,
              currencySymbol: optionsLive.currencySymbol,
            },
            funnelLegendDimsRef.current,
          );
          return { id: item.__funnelId ?? idx, line, color };
        });
      })();

  return (
    <div className="flex h-full min-h-0 w-full flex-col pt-3" style={{ position: 'relative' }}>
      <div className="flex items-center justify-end gap-2 mb-0 pr-22">
        <Label htmlFor="funnel-orientation" className="text-xs text-foreground">
          Vertical
        </Label>
        <Switch
          id="funnel-orientation"
          checked={funnelOrientation === 'horizontal'}
          onCheckedChange={(checked) =>
            setFunnelOrientation(checked ? 'horizontal' : 'vertical')
          }
          className="
            h-4 w-7 data-[state=checked]:bg-primary data-[state=unchecked]:bg-foreground [&>span]:h-3 [&>span]:w-3 [&>span]:translate-x-0.5 data-[state=checked]:[&>span]:translate-x-3 "
        />
        <Label htmlFor="funnel-orientation" className="text-xs text-foreground">
          Horizontal
        </Label>
      </div>
      <div className={`relative flex-1 min-h-0 flex w-full ${optionsLive.legendOrientation === 'left' ? 'flex-row-reverse' :
        optionsLive.legendOrientation === 'right' ? 'flex-row' :
          optionsLive.legendOrientation === 'top' ? 'flex-col-reverse' :
            'flex-col'
        }`}>
        <div ref={chartRef} className="min-h-0 flex-1 w-full min-w-0" />
        <ChartDomScrollLegend
          visible={funnelDomLegendItems.length > 0}
          items={funnelDomLegendItems}
          orientation={optionsLive.legendOrientation || 'bottom'}
        />
      </div>
    </div>
  );
}

