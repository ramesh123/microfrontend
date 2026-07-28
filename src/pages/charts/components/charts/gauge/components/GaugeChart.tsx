import { useEffect, useRef, useMemo } from 'react';
import * as React from 'react';
import * as am5 from '@amcharts/amcharts5';
import * as am5xy from '@amcharts/amcharts5/xy';
import * as am5radar from '@amcharts/amcharts5/radar';
import am5themes_Animated from '@amcharts/amcharts5/themes/Animated';
import { formatNumber } from '@/utils/numberFormatters';
import type { GaugeCustomizationOptions } from '../customize/gaugeCustomizeTypes';
import { defaultOptions as gaugeDefaultOptions, colorSchemes as gaugeColorSchemes, resolveGaugeArcWidth } from '../customize/gaugeCustomizeTypes';
import { useTheme } from '@/context/theme';
import { applyAm5InterfaceTheme, probeAmChartThemeColors, resolveCssColorStringToAm5 } from '../../amChartThemeColors';
import { resolveGaugeArcBands, resolveValueRangeColorForValue, parseValueRangeBound } from '../../shared/bigNumberValueRangeColors';

interface GaugeChartProps {
  data: Array<{ category: string; value: number; originalData: any; axisLabelText?: string }> | any;
  onChartInteraction?: (field: string, value: any) => void;
  customizationOptions?: GaugeCustomizationOptions;
}

/** Snap auto-computed gauge bounds to nice tick steps so arc fills align with axis labels. */
function snapGaugeAxisBounds(min: number, max: number, tickIntervals: number): { min: number; max: number } {
  const range = max - min;
  if (!Number.isFinite(min) || !Number.isFinite(max) || range <= 0) {
    return { min, max };
  }

  const roughStep = range / Math.max(1, tickIntervals - 1);
  const magnitude = Math.pow(10, Math.floor(Math.log10(Math.max(Math.abs(roughStep), 1e-12))));
  const normalized = roughStep / magnitude;
  let nice = 1;
  if (normalized <= 1) nice = 1;
  else if (normalized <= 2) nice = 2;
  else if (normalized <= 5) nice = 5;
  else nice = 10;

  const step = nice * magnitude;
  const snappedMin = Math.floor(min / step) * step;
  let snappedMax = Math.ceil(max / step) * step;
  if (snappedMax <= snappedMin) snappedMax = snappedMin + step;

  return { min: snappedMin, max: snappedMax };
}

function gaugeBoundsKey(min: number, max: number): string {
  return `${min}|${max}`;
}

function toGaugeNumberOr(v: unknown, fallback: number): number {
  if (typeof v === 'number' && !Number.isNaN(v)) return v;
  if (v === '' || v === null || v === undefined) return fallback;
  const n = Number(v);
  return Number.isNaN(n) ? fallback : n;
}

/**
 * Identifies dimension fields from data structure.
 * Dimensions are non-numeric fields that are not aggregated (SUM, COUNT, AVG, etc.)
 */
function identifyDimensionFields(rows: Array<any>, apiColumns?: string[], metricField?: string): string[] {
  if (!rows || rows.length === 0) return [];

  const sample = rows[0] || {};

  // Prefer column order from API if provided, otherwise fall back to object's key order
  const allKeys = Array.isArray(apiColumns) && apiColumns.length ? apiColumns : Object.keys(sample);
  const dimensionFields: string[] = [];

  // Check each field to determine if it's a dimension
  for (const key of allKeys) {
    const upperKey = (key || '').toUpperCase();

    // Skip if field name contains aggregation indicators (e.g. DC_AMOUNT(SUM), SUM(...), ...)
    const hasAggregationPattern = /\((SUM|COUNT|AVG|MIN|MAX|STDDEV|VARIANCE)\)/i.test(upperKey) ||
      /^(SUM|COUNT|AVG|MIN|MAX|STDDEV|VARIANCE)\(/i.test(upperKey) ||
      /_(SUM|COUNT|AVG|MIN|MAX|STDDEV|VARIANCE)$/i.test(upperKey) ||
      /(SUM|COUNT|AVG|MIN|MAX|STDDEV|VARIANCE)$/i.test(upperKey);

    if (hasAggregationPattern) {
      continue;
    }

    // Skip the explicitly-selected metric field so it is never treated as a dimension
    if (metricField && key === metricField) continue;

    // Treat all non-aggregated fields as dimensions, including numeric columns
    // (this allows non-aggregated numeric fields like `processing_fee` to appear
    // in labels/context while preventing them from being chosen as the metric)

    // Otherwise treat as a dimension field (preserving order)
    dimensionFields.push(key);
  }

  return dimensionFields;
}

/**
 * Builds axis label text from dimension fields.
 * - Single dimension: show value directly
 * - Multiple dimensions: concatenate with ", " (comma and space)
 * - Skip null/undefined/empty values
 */
function buildAxisLabelText(row: any, dimensionFields: string[]): string {
  if (!dimensionFields || dimensionFields.length === 0) {
    return '';
  }

  const values: string[] = [];

  for (const field of dimensionFields) {
    const value = row[field];

    // Skip null, undefined, or empty string values
    if (value !== null && value !== undefined && value !== '') {
      values.push(String(value));
    }
  }

  // Join with ", " separator (comma and space) for axis labels
  return values.join(', ');
}

function resolveEffectiveBandBoundLocal(
    stored: number | undefined,
    mode: 'count' | 'percent',
    autoMin: number,
    autoMax: number,
  ): number | undefined {
    if (stored === undefined) return undefined;
    if (mode !== 'percent') return stored;
    const span = autoMax - autoMin;
    if (!Number.isFinite(span) || span <= 0) return stored;
    return autoMin + (stored / 100) * span;
  }

  function clampBandValueLocal(value: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, value));
  }

  function resolveValueRangeColorForValueForGauge(
    value: number,
    opts: GaugeCustomizationOptions | null | undefined,
    autoMin: number,
    autoMax: number,
  ): string | null {
    if (opts?.customBands && Array.isArray(opts.customBands) && opts.customBands.length > 0) {
      const mode = opts.valueRangeBoundsMode === 'percent' ? 'percent' : 'count';
      for (const band of opts.customBands) {
        const bandMin = resolveEffectiveBandBoundLocal(
          parseValueRangeBound(band.minValue),
          mode,
          autoMin,
          autoMax,
        );
        const bandMax = resolveEffectiveBandBoundLocal(
          parseValueRangeBound(band.maxValue),
          mode,
          autoMin,
          autoMax,
        );

        const hasMin = bandMin !== undefined;
        const hasMax = bandMax !== undefined;

        let matches = true;
        if (hasMin && value < bandMin) matches = false;
        if (hasMax && value > bandMax) matches = false;

        if (matches) {
          return band.color;
        }
      }
    }
    return resolveValueRangeColorForValue(value, opts, autoMin, autoMax);
  }

  function resolveGaugeArcBandsForGauge(
    min: number,
    max: number,
    opts?: GaugeCustomizationOptions | null,
  ): Array<{ key: string; label: string; start: number; end: number; color: string }> {
    if (opts?.customBands && Array.isArray(opts.customBands) && opts.customBands.length > 0) {
      const range = max - min;
      const mode = opts.valueRangeBoundsMode === 'percent' ? 'percent' : 'count';
      const segments = opts.customBands.map((band, index) => {
        const step = range / opts.customBands!.length;
        const defaultStart = min + index * step;
        const defaultEnd = min + (index + 1) * step;

        const resolve = (stored: number | '' | undefined, fallback: number) => {
          const parsed = parseValueRangeBound(stored);
          if (parsed === undefined) return fallback;
          return clampBandValueLocal(
            resolveEffectiveBandBoundLocal(parsed, mode, min, max) ?? fallback,
            min,
            max,
          );
        };

        const start = resolve(band.minValue, defaultStart);
        const end = resolve(band.maxValue, defaultEnd);

        return {
          key: `custom_${index}`,
          label: `Band ${index + 1}`,
          start: start,
          end: Math.max(start, end),
          color: band.color,
        };
      });

      // Contiguity adjustments
      segments[0].start = min;
      segments[segments.length - 1].end = max;
      for (let i = 0; i < segments.length - 1; i++) {
        segments[i].end = Math.max(segments[i].start, Math.min(segments[i].end, segments[i + 1].start));
        segments[i + 1].start = segments[i].end;
      }

      return segments;
    }

    return resolveGaugeArcBands(min, max, opts).map(band => ({
      key: band.key as string,
      label: band.label,
      start: band.start,
      end: band.end,
      color: band.color,
    }));
  }

  export function GaugeChart({ data, onChartInteraction, customizationOptions }: GaugeChartProps) {
    const { theme } = useTheme();
    const chartRef = useRef<HTMLDivElement>(null);
    const rootRef = useRef<am5.Root | null>(null);
    /** Locked snapped axis range — avoids recomputing auto bounds on every stream tick. */
    const stableAxisBoundsRef = useRef<{ min: number; max: number } | null>(null);
    const boundsConfigKeyRef = useRef<string | null>(null);
    const chartHasAppearedRef = useRef(false);
    const chartLiveRefs = useRef<{
      boundsKey: string;
      customizationKey?: string;
      pointerDataItem: am5.DataItem<am5xy.IValueAxisDataItem> | null;
      valueLabel: am5.Label | null;
      totalLabel: am5.Label | null;
    } | null>(null);
    // Compute a resolved palette so overlay tick colors match chart colors
    const getCssVar = (name: string) => {
      try {
        if (typeof window === 'undefined') return '';
        const val = getComputedStyle(document.documentElement).getPropertyValue(name);
        return val ? val.trim() : '';
      } catch { return ''; }
    };

    const resolveColorString = (input?: string) => {
      try {
        if (!input) return '';
        const s = String(input).trim();
        if (!s) return '';
        if (s.startsWith('--')) {
          const v = getCssVar(s);
          return v || s;
        }
        const varMatch = s.match(/var\((--[^),]+)\)/);
        if (varMatch) {
          const v = getCssVar(varMatch[1]);
          return v || s;
        }
        return s;
      } catch { return String(input || ''); }
    };


    const [customizationState, setCustomizationState] = React.useState<GaugeCustomizationOptions | undefined>(customizationOptions);

    // Listen for customization changes
    React.useEffect(() => {
      const handleCustomizationChange = (event: CustomEvent) => {
        setCustomizationState(event.detail);
      };

      if (typeof window !== 'undefined') {
        window.addEventListener('chartCustomizationChanged', handleCustomizationChange as EventListener);

        // Also check window object on mount
        if ((window as any).__chartCustomizationOptions) {
          setCustomizationState((window as any).__chartCustomizationOptions);
        }
      }

      return () => {
        if (typeof window !== 'undefined') {
          window.removeEventListener('chartCustomizationChanged', handleCustomizationChange as EventListener);
        }
      };
    }, []);

    // Update state when prop changes
    React.useEffect(() => {
      if (customizationOptions) {
        setCustomizationState(customizationOptions);
      } else if (typeof window !== 'undefined' && (window as any).__chartCustomizationOptions) {
        setCustomizationState((window as any).__chartCustomizationOptions);
      }
    }, [customizationOptions]);

    // Transform data to handle both raw API response and transformed format
    const transformedData = useMemo(() => {
      if (!data) return [];

      // Support callers passing either an array of rows or the full API response
      // { status, message, data: [...rows], columns: [...] }
      let rows: Array<any> = Array.isArray(data) ? data : (data as any).data ?? [];
      const apiColumns: string[] | undefined = !Array.isArray(data) && Array.isArray((data as any).columns) ? (data as any).columns : undefined;

      // Debug: Log incoming data structure
      console.log('🔍 GaugeChart: Incoming data structure', {
        isArray: Array.isArray(data),
        hasData: !!(data as any)?.data,
        rowsLength: rows?.length,
        apiColumns,
        firstRow: rows?.[0],
        rawData: data,
      });

      if (!rows || rows.length === 0) return [];

      // Determine an explicitly-configured metric field (from props, window or payload)
      const configuredMetricField = (customizationOptions && (customizationOptions as any).metricField)
        || (typeof window !== 'undefined' && (window as any).__chartCustomizationOptions && (window as any).__chartCustomizationOptions.metricField)
        || ((data && (data as any).metricField) ? (data as any).metricField : undefined)
        || ((data && (data as any).selectedMetric) ? (data as any).selectedMetric : undefined);

      // If data is already in transformed format (category/value/originalData),
      // prefer to derive dimension fields from each item's `originalData` so
      // axis labels can include multiple dimension values (e.g. `id, loan_type`).
      if (rows[0] && 'category' in rows[0] && 'value' in rows[0]) {
        console.log('🔍 GaugeChart: Data is in transformed format (category/value)', {
          firstItem: rows[0],
          itemsCount: rows.length,
        });
        const items = rows as Array<{ category: string; value: number; originalData: any }>;

        // Determine dimension fields from the underlying originalData if present
        let dimensionFieldsForTransformed: string[] = [];
        const sampleOriginal = items[0]?.originalData;
        if (sampleOriginal && (typeof sampleOriginal === 'object')) {
          // If originalData is an object (single row), wrap in array for detection
          dimensionFieldsForTransformed = identifyDimensionFields(Array.isArray(sampleOriginal) ? sampleOriginal : [sampleOriginal], apiColumns, configuredMetricField);
        } else {
          // Fallback: identify from transformed row keys but exclude our wrapper keys
          dimensionFieldsForTransformed = identifyDimensionFields(rows, apiColumns, configuredMetricField).filter((f) => !['category', 'value', 'originalData'].includes(f));
        }

        const map = new Map<string, { category: string; value: number; originalData: any[]; axisLabelText?: string }>();
        items.forEach((it) => {
          // Build axis label text from originalData when possible, otherwise use category
          const axisLabelText = it.originalData && dimensionFieldsForTransformed.length > 0
            ? buildAxisLabelText(it.originalData, dimensionFieldsForTransformed)
            : String(it.category || 'Unknown');

          const key = String(axisLabelText || it.category || 'Unknown');
          const existing = map.get(key);
          if (existing) {
            existing.value += Number(it.value || 0);
            existing.originalData.push(it.originalData);
          } else {
            map.set(key, {
              category: it.category || axisLabelText || 'Unknown',
              value: Number(it.value || 0),
              originalData: [it.originalData],
              axisLabelText: axisLabelText || it.category || 'Unknown',
            });
          }
        });

        return Array.from(map.values()).map((v) => ({
          category: v.category,
          value: v.value,
          originalData: v.originalData,
          axisLabelText: v.axisLabelText || v.category,
        }));
      }

      // Identify dimension fields from the data structure, preserving API column order if present
      const dimensionFields = identifyDimensionFields(rows, apiColumns, configuredMetricField);

      // Transform raw API response format (e.g., { SOURCE_NAME: "...", "DC_AMOUNT(SUM)": value })
      const rawItems = rows.map((item: any, index: number) => {
        const keys = apiColumns && apiColumns.length ? apiColumns : Object.keys(item);

        // Find the category column (non-numeric, typically SOURCE_NAME or similar)
        const categoryKey = keys.find(
          (key) =>
            !key.includes('(') &&
            typeof item[key] !== 'number' &&
            (key.toLowerCase().includes('source') ||
              key.toLowerCase().includes('name') ||
              key.toLowerCase().includes('category'))
        ) || keys.find((key) => typeof item[key] !== 'number' && !key.includes('('));

        // Find the value column (numeric). MUST be aggregated or explicitly configured metric.
        // Priority: 1) Explicit metric, 2) Aggregated columns, 3) NEVER use non-aggregated numeric fields
        const isNumericLike = (v: any) => {
          try {
            if (v === null || v === undefined || v === '') return false;
            const n = Number(v);
            return Number.isFinite(n);
          } catch { return false; }
        };

        // Check if a key represents an aggregated column
        // Matches patterns like: "column(SUM)", "column(COUNT)", "SUM(column)", "TOTAL_AMOUNT", etc.
        const isAggregatedColumn = (key: string): boolean => {
          if (!key || typeof key !== 'string') return false;

          const keyTrimmed = key.trim();
          if (!keyTrimmed) return false;

          // Pattern 1: Contains parentheses with aggregate function (e.g., "total_amount(SUM)", "DC_AMOUNT(SUM)")
          // This is the most common pattern from SQL aggregations
          if (keyTrimmed.includes('(') && keyTrimmed.includes(')')) {
            const parenMatch = keyTrimmed.match(/\(([^)]+)\)/);
            if (parenMatch && parenMatch[1]) {
              const parenContent = parenMatch[1].trim().toUpperCase();
              const aggregateFunctions = ['SUM', 'COUNT', 'AVG', 'AVERAGE', 'MIN', 'MAX', 'STDDEV', 'VARIANCE', 'TOTAL'];
              if (aggregateFunctions.includes(parenContent)) {
                return true;
              }
            }
          }

          // Pattern 2: Starts with aggregate function (e.g., "SUM(column)", "COUNT(*)")
          if (/^(SUM|COUNT|AVG|AVERAGE|MIN|MAX|STDDEV|VARIANCE)\(/i.test(keyTrimmed)) {
            return true;
          }

          // Pattern 3: Ends with aggregate suffix (e.g., "AMOUNT_SUM", "VALUE_TOTAL")
          if (/_(SUM|COUNT|AVG|AVERAGE|MIN|MAX|STDDEV|VARIANCE|TOTAL)$/i.test(keyTrimmed)) {
            return true;
          }

          // Pattern 4: Starts with "TOTAL_" prefix (common pattern for aggregated totals)
          if (/^TOTAL_/i.test(keyTrimmed)) {
            return true;
          }

          return false;
        };

        // Priority 1: If an explicit metric is configured and exists on the row and is numeric-like, use it
        const explicitMetricKey = configuredMetricField && keys.includes(configuredMetricField) && isNumericLike(item[configuredMetricField])
          ? configuredMetricField
          : undefined;

        // Priority 2: Find ALL aggregated columns first, then pick the first valid one
        // This ensures we never accidentally pick a non-aggregated numeric field
        const allAggregatedKeys = keys.filter((key) => {
          try {
            if (!isAggregatedColumn(key)) return false;
            const v = item[key];
            return isNumericLike(v);
          } catch { return false; }
        });

        // Select the first aggregated column (or explicit metric if configured)
        const aggCandidate = allAggregatedKeys.length > 0 ? allAggregatedKeys[0] : undefined;

        // Final selection: explicit metric > aggregated column
        // NEVER use non-aggregated numeric fields (like processing_fee) as they are dimensions
        const valueKey = explicitMetricKey || aggCandidate;

        // Debug logging - always log for first item to diagnose issues
        if (index === 0) {
          const allNumericKeys = keys.filter((key) => {
            try {
              return isNumericLike(item[key]) && !isAggregatedColumn(key);
            } catch { return false; }
          });

          // Always log the selection process
          console.log('🔍 GaugeChart: Value extraction for row', index, {
            item,
            keys,
            apiColumns,
            configuredMetricField,
            explicitMetricKey,
            allAggregatedKeys,
            aggCandidate,
            allNumericKeys,
            selectedValueKey: valueKey,
            selectedValue: valueKey ? item[valueKey] : undefined,
            isAggregated: valueKey ? isAggregatedColumn(valueKey) : false,
          });

          if (!valueKey) {
            console.error('❌ GaugeChart: No aggregated column or explicit metric found!', {
              availableKeys: keys,
              allAggregatedKeys,
              allNumericKeys,
              configuredMetricField,
              itemKeys: Object.keys(item),
            });
          } else if (!isAggregatedColumn(valueKey) && !explicitMetricKey) {
            console.error(' GaugeChart: Selected valueKey is not aggregated!', {
              valueKey,
              isAggregated: isAggregatedColumn(valueKey),
              allAggregatedKeys,
            });
          } else {
            console.log(' GaugeChart: Successfully selected metric', {
              valueKey,
              value: item[valueKey],
              formatted: typeof item[valueKey] === 'number' ? item[valueKey].toLocaleString() : item[valueKey],
            });
          }
        }

        const category = categoryKey ? String(item[categoryKey] || 'Unknown') : `Source ${index + 1}`;

        // Final safety check: ensure valueKey is either explicit metric or aggregated column
        // NEVER use non-aggregated numeric fields
        let finalValue = 0;
        if (valueKey) {
          if (explicitMetricKey || isAggregatedColumn(valueKey)) {
            finalValue = Number(item[valueKey]) || 0;
          } else {
            console.error('GaugeChart: Rejecting non-aggregated numeric field as value', {
              valueKey,
              isAggregated: isAggregatedColumn(valueKey),
              allAggregatedKeys,
            });
            finalValue = 0;
          }
        }
        const value = finalValue;

        // Build axis label text from dimension fields
        const axisLabelText = buildAxisLabelText(item, dimensionFields) || category;

        return {
          category,
          value,
          axisLabelText,
          originalData: item,
        };
      });

      // Aggregate rows by axisLabelText (concatenated dimension fields) to properly handle multiple dimensions
      const agg = new Map<string, { category: string; value: number; originalData: any[]; axisLabelText: string }>();
      rawItems.forEach((it) => {
        // Use axisLabelText as the key for aggregation to ensure proper grouping by all dimension fields
        const key = String(it.axisLabelText || it.category || 'Unknown');
        const existing = agg.get(key);
        if (existing) {
          existing.value += Number(it.value || 0);
          existing.originalData.push(it.originalData);
        } else {
          agg.set(key, {
            category: it.category || key,
            value: Number(it.value || 0),
            originalData: [it.originalData],
            axisLabelText: it.axisLabelText || it.category || key,
          });
        }
      });

      // Return aggregated array sorted descending by value so primary is largest
      const finalResult = Array.from(agg.values())
        .map((v) => ({
          category: v.category,
          value: v.value,
          originalData: v.originalData,
          axisLabelText: v.axisLabelText || v.category,
        }))
        .sort((a, b) => Number(b.value) - Number(a.value));

      // Log final transformed data
      console.log('📊 GaugeChart: Final transformed data', {
        resultCount: finalResult.length,
        firstItem: finalResult[0],
        allItems: finalResult,
      });

      return finalResult;
    }, [data, customizationOptions]);

    // Calculate unit selection and normalization factor based on max value
    // Rules: < 1K → raw, 1K-<1M → K, >= 1M → M
    const getUnitInfo = (maxValue: number): { unit: 'raw' | 'K' | 'M'; factor: number; suffix: string } => {
      const absMax = Math.abs(maxValue);
      if (absMax < 1000) {
        return { unit: 'raw', factor: 1, suffix: '' };
      } else if (absMax < 1000000) {
        return { unit: 'K', factor: 1000, suffix: 'K' };
      } else {
        return { unit: 'M', factor: 1000000, suffix: 'M' };
      }
    };

    const gaugeConfig = useMemo(() => {
      if (!transformedData || transformedData.length === 0) {
        return { value: 0, min: 0, max: 100, unitInfo: { unit: 'raw' as const, factor: 1, suffix: '' } };
      }
      const value = transformedData[0]?.value || 0;
      const values = transformedData.map((d) => d.value || 0);
      // Compute tight, data-driven bounds that focus visually on the upper range
      const rawMin = Math.min(...values);
      const rawMax = Math.max(...values);
      const rawRange = rawMax - rawMin;

      // Use a small buffer above the highest value (5% default). This keeps the
      // gauge from touching the very top while remaining tight to the data.
      const topBufferMultiplier = 1.05; // 5% above highest value
      let calculatedMax = rawMax > 0 ? rawMax * topBufferMultiplier : rawMax + (Math.abs(rawMax) * 0.05 || 1);

      // Choose a visible span (computedMax - computedMin) that adapts to how
      // clustered the data are. When values are tightly clustered near the max,
      // produce a smaller span so ticks concentrate near the upper range.
      let rangeSpan: number;
      if (rawRange <= 0) {
        // Single-value case: show a small portion above/below the value
        rangeSpan = Math.max(Math.abs(calculatedMax) * 0.12, 1);
      } else if (rawMax > 0 && rawRange / rawMax < 0.15) {
        // Clustered values: bias span towards the top of the scale
        rangeSpan = Math.max(rawRange * 3, Math.abs(calculatedMax) * 0.12);
      } else {
        // More spread-out values: allow a wider span but keep it reasonable
        rangeSpan = Math.max(rawRange * 1.2, Math.abs(calculatedMax) * 0.2);
      }

      // Compute the lower bound so that the gauge emphasizes the upper range.
      // Ensure that the actual minimum value is always included (don't clip data).
      let computedMin = calculatedMax - rangeSpan;
      computedMin = Math.min(rawMin, computedMin);

      // Safety guards
      if (!isFinite(computedMin) || isNaN(computedMin)) computedMin = 0;
      if (!isFinite(calculatedMax) || isNaN(calculatedMax)) calculatedMax = 100;
      if (Math.abs(calculatedMax - computedMin) < 1e-9) {
        computedMin = calculatedMax - Math.max(1, Math.abs(calculatedMax) * 0.1);
      }

      const unitInfo = getUnitInfo(calculatedMax);

      return { value, min: computedMin, max: calculatedMax, unitInfo, rawMin, rawMax, rawRange };
    }, [transformedData]);

    useEffect(() => {
      return () => {
        try {
          if (rootRef.current) {
            rootRef.current.dispose();
            rootRef.current = null;
          }
        } catch {
          /* ignore */
        }
        chartLiveRefs.current = null;
        chartHasAppearedRef.current = false;
        stableAxisBoundsRef.current = null;
        boundsConfigKeyRef.current = null;
      };
    }, []);

    useEffect(() => {
      if (!chartRef.current || !transformedData || transformedData.length === 0) return;

      const { value, min, max, unitInfo } = gaugeConfig;


      // Build a combined options object (defaults <- window <- props <- state)
      const windowOpts = (typeof window !== 'undefined' ? (window as any).__chartCustomizationOptions : null) || {};
      const optionsRaw: any = { ...(gaugeDefaultOptions as any), ...windowOpts, ...(customizationOptions as any), ...(customizationState as any) };

      // If user explicitly provided a MIN but hasn't provided a MAX yet,
      // don't render the chart until both are supplied. This avoids showing
      // a misleading or truncated gauge while the user is still editing.
      const rawMinProvided = optionsRaw && optionsRaw.min !== '' && optionsRaw.min !== undefined && optionsRaw.min !== null;
      const rawMaxProvided = optionsRaw && optionsRaw.max !== '' && optionsRaw.max !== undefined && optionsRaw.max !== null;
      if (rawMinProvided && !rawMaxProvided) {
        if (rootRef.current) {
          try { rootRef.current.dispose(); } catch { }
          rootRef.current = null;
        }
        stableAxisBoundsRef.current = null;
        chartLiveRefs.current = null;
        chartHasAppearedRef.current = false;
        return;
      }

      // Determine effective numeric bounds from options (if provided) or computed values
      let effectiveMin = (optionsRaw && (optionsRaw.min === '' || optionsRaw.min === undefined || optionsRaw.min === null))
        ? min
        : toGaugeNumberOr(optionsRaw.min, min);
      let effectiveMax = (optionsRaw && (optionsRaw.max === '' || optionsRaw.max === undefined || optionsRaw.max === null))
        ? max
        : toGaugeNumberOr(optionsRaw.max, max);
      const bothBoundsProvided = rawMinProvided && rawMaxProvided;

      const boundsConfigKey = bothBoundsProvided
        ? `${optionsRaw.min}|${optionsRaw.max}`
        : 'auto';
      if (boundsConfigKeyRef.current !== boundsConfigKey) {
        boundsConfigKeyRef.current = boundsConfigKey;
        stableAxisBoundsRef.current = null;
      }

      // Ensure effectiveMax > effectiveMin. If the incoming data or options produce
      // an equal min/max (or a tiny range), expand the range so axis ranges and
      // fills render correctly (avoids zero-length arc).
      let normMin = Number(effectiveMin);
      let normMax = Number(effectiveMax);
      if (!isFinite(normMin) || isNaN(normMin)) normMin = 0;
      if (!isFinite(normMax) || isNaN(normMax)) normMax = normMin + 1;
      const rawRange = normMax - normMin;
      if (rawRange <= 0 || Math.abs(rawRange) < 1e-9) {
        // If values are identical, add 10% padding or at least 1 unit
        const pad = Math.max(1, Math.abs(normMin) * 0.1);
        normMax = normMin + pad;
      }
      // If the detected range is extremely small compared to values, add a tiny buffer
      if (Math.abs(normMax - normMin) / Math.max(1, Math.abs(normMin)) < 1e-6) {
        normMax = normMin + Math.max(1, Math.abs(normMin) * 0.01);
      }

      // Use normalized bounds from here on
      const finalEffectiveMin = normMin;
      const finalEffectiveMax = normMax;

      // Overwrite effectiveMin/effectiveMax variables so the rest of the code uses normalized bounds
      effectiveMin = finalEffectiveMin;
      effectiveMax = finalEffectiveMax;

      const tickIntervals = Math.max(
        4,
        Math.min(
          12,
          typeof optionsRaw.splitNumber === 'number' && optionsRaw.splitNumber > 2
            ? optionsRaw.splitNumber
            : 10,
        ),
      );

      // When bounds are auto-computed, snap to tick grid so colored arc matches first/last labels.
      if (!bothBoundsProvided) {
        const snapped = snapGaugeAxisBounds(effectiveMin, effectiveMax, tickIntervals);
        effectiveMin = snapped.min;
        effectiveMax = snapped.max;
      }

      const proposedBounds = { min: effectiveMin, max: effectiveMax };
      const primaryValueForBounds = Number(value);
      if (bothBoundsProvided) {
        stableAxisBoundsRef.current = proposedBounds;
      } else if (stableAxisBoundsRef.current) {
        const locked = stableAxisBoundsRef.current;
        const needsExpand =
          Number.isFinite(primaryValueForBounds) &&
          (primaryValueForBounds > locked.max || primaryValueForBounds < locked.min);
        if (needsExpand) {
          stableAxisBoundsRef.current = proposedBounds;
        } else {
          effectiveMin = locked.min;
          effectiveMax = locked.max;
        }
      } else {
        stableAxisBoundsRef.current = proposedBounds;
      }

      const currentBoundsKey = gaugeBoundsKey(effectiveMin, effectiveMax);

      // Provide normalized fontSize and other options
      const baseFontSize = toGaugeNumberOr(optionsRaw.fontSize, 11);
      const colorSchemeKey = optionsRaw.colorScheme || 'd3-category20c';

      // Prefer theme CSS variables for colors; fall back to a small sensible palette
      const getCssVar = (name: string) => {
        try {
          if (typeof window === 'undefined') return '';
          const val = getComputedStyle(document.documentElement).getPropertyValue(name);
          return val ? val.trim() : '';
        } catch { return ''; }
      };

      const themePalette: string[] = [
        getCssVar('--color-primary') || getCssVar('--theme-primary') || '',
        getCssVar('--color-accent') || getCssVar('--theme-accent') || '',
        getCssVar('--color-secondary') || getCssVar('--theme-secondary') || '',
        getCssVar('--color-muted') || getCssVar('--theme-muted') || '',
      ].filter(Boolean);

      const fallbackPalette = ['#536DFE', '#4CAF50', '#FF9800'];

      // Resolve palette: explicit scheme from options -> exported gaugeColorSchemes -> theme vars -> fallback
      let paletteSource: string[] | undefined = undefined;
      try {
        const scheme = String(colorSchemeKey || '').trim();
        const found = gaugeColorSchemes.find((s: any) => s.value === scheme);
        if (found && Array.isArray(found.colors) && found.colors.length) {
          paletteSource = found.colors.slice();
        }
      } catch { }

      const resolvedPalette = (paletteSource && paletteSource.length ? paletteSource : (themePalette.length ? themePalette : fallbackPalette)).map((c) => String(c));
      // Resolve color strings so they adapt to theme CSS variables when used.
      const resolveColorString = (input?: string) => {
        try {
          if (!input) return '';
          const s = String(input).trim();
          if (!s) return '';
          if (s.startsWith('--')) {
            const v = getCssVar(s);
            return v || s;
          }
          const varMatch = s.match(/var\((--[^),]+)\)/);
          if (varMatch) {
            const v = getCssVar(varMatch[1]);
            return v || s;
          }
          return s;
        } catch {
          return String(input || '');
        }
      };

      // Resolved palette colors

      const chartTheme = probeAmChartThemeColors();

      const toAmColor = (input: unknown): am5.Color => {
        const fallback = am5.color(0x536DFE);
        try {
          if (input == null || input === '') return fallback;
          const raw = String(input).trim();
          if (!raw) return fallback;
          const resolved = resolveColorString(raw) || raw;
          if (resolved.startsWith('#')) {
            try {
              return am5.color(resolved as any);
            } catch {
              /* fall through */
            }
          }
          const probeDiv = document.createElement('div');
          probeDiv.style.color = resolved;
          document.documentElement.appendChild(probeDiv);
          const computed = getComputedStyle(probeDiv).color;
          document.documentElement.removeChild(probeDiv);
          return resolveCssColorStringToAm5(computed, fallback);
        } catch {
          return fallback;
        }
      };

      // Helper function to get currency code and locale from currencySymbol option
      const getCurrencyInfo = (): { code: string; locale: string; symbol: string } => {
        const currencyOption = optionsRaw.currencySymbol || '(USD)';

        // Extract currency code from options like "$ (USD)", "€ (EUR)", etc.
        const codeMatch = currencyOption.match(/\(([A-Z]{3})\)/);
        const code = codeMatch ? codeMatch[1] : 'USD';

        // Map currency codes to locales for proper formatting
        const localeMap: Record<string, string> = {
          'USD': 'en-US',
          'EUR': 'de-DE',
          'GBP': 'en-GB',
          'JPY': 'ja-JP',
          'CNY': 'zh-CN',
          'INR': 'en-IN',
          'AUD': 'en-AU',
          'CAD': 'en-CA',
          'CHF': 'de-CH',
          'SGD': 'en-SG',
        };

        const locale = localeMap[code] || 'en-US';

        // Extract symbol from option
        const symbolMatch = currencyOption.match(/^([^\s(]+)/);
        const symbol = symbolMatch ? symbolMatch[1] : '';

        return { code, locale, symbol };
      };

      // Helper function to format value with currency
      const formatValueWithCurrency = (value: number, formattedValue: string): string => {
        if (optionsRaw.currencyFormat === 'none') {
          return formattedValue;
        }

        const { code, locale, symbol } = getCurrencyInfo();

        // For 'full' format, use Intl.NumberFormat for proper currency formatting with locale
        if (optionsRaw.numberFormat === 'full') {
          try {
            const formatter = new Intl.NumberFormat(locale, {
              style: 'currency',
              currency: code,
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            });
            return formatter.format(value);
          } catch (error) {
            console.warn('Invalid currency code, using fallback formatting:', error);
          }
        }

        // For 'decimal' format, use Intl.NumberFormat with 2 decimal places
        if (optionsRaw.numberFormat === 'decimal') {
          try {
            const formatter = new Intl.NumberFormat(locale, {
              style: 'currency',
              currency: code,
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            });
            return formatter.format(value);
          } catch (error) {
            // Fallback to manual formatting
          }
        }

        // For 'short' and 'adaptive' formats, apply currency symbol to the formatted value
        if (optionsRaw.currencyFormat === 'prefix') {
          return `${symbol}${formattedValue}`;
        } else if (optionsRaw.currencyFormat === 'suffix') {
          return `${formattedValue} ${symbol}`;
        }

        return formattedValue;
      };

      // Helper function to format number with consistent unit based on gauge's unitInfo
      // This ensures needle values, axis ticks, and labels all use the same unit
      const formatNumberWithUnit = (value: number, useUnitInfo: boolean = true): string => {
        if (typeof value !== 'number' || isNaN(value)) return String(value);

        // If unitInfo should be used (for consistency), normalize and format with unit
        if (useUnitInfo && unitInfo.unit !== 'raw') {
          const normalized = value / unitInfo.factor;
          // Format with appropriate decimal places based on unit
          let formatted: string;
          if (unitInfo.unit === 'M') {
            // For millions, show up to 2 decimal places if needed
            formatted = normalized % 1 === 0
              ? normalized.toLocaleString(undefined, { maximumFractionDigits: 0 })
              : normalized.toLocaleString(undefined, { maximumFractionDigits: 2, minimumFractionDigits: 0 });
          } else {
            // For thousands, show up to 1 decimal place if needed
            formatted = normalized % 1 === 0
              ? normalized.toLocaleString(undefined, { maximumFractionDigits: 0 })
              : normalized.toLocaleString(undefined, { maximumFractionDigits: 1, minimumFractionDigits: 0 });
          }
          return formatValueWithCurrency(value, `${formatted}${unitInfo.suffix}`);
        }

        // For raw values or when unitInfo shouldn't be used, use original formatting
        const fmt = (optionsRaw && optionsRaw.numberFormat) ? String(optionsRaw.numberFormat) : 'adaptive';
        const abs = Math.abs(value);
        const isInteger = Math.abs(value - Math.round(value)) < 1e-9;

        switch (fmt) {
          case 'decimal': {
            const formatted = value.toFixed(2);
            return formatValueWithCurrency(value, formatted);
          }

          case 'full': {
            if (isInteger) {
              return formatValueWithCurrency(value, Math.round(value).toLocaleString());
            }
            const formatted = Number(value.toFixed(2)).toLocaleString();
            return formatValueWithCurrency(value, formatted);
          }

          case 'short': {
            try {
              const formatted = formatNumber(value, { format: 'short' });
              return formatValueWithCurrency(value, formatted);
            } catch (e) {
              return formatValueWithCurrency(value, String(value));
            }
          }

          case 'percentage': {
            const span = effectiveMax - effectiveMin;
            const pct = span > 0 ? ((value - effectiveMin) / span) * 100 : 0;
            const clamped = Math.max(0, Math.min(100, pct));
            return `${clamped.toFixed(2)}%`;
          }

          case 'adaptive':
          default: {
            // For adaptive, use unitInfo if value is large enough
            if (useUnitInfo && abs >= 1000 && unitInfo.unit !== 'raw') {
              const normalized = value / unitInfo.factor;
              const formatted = normalized % 1 === 0
                ? normalized.toLocaleString(undefined, { maximumFractionDigits: 0 })
                : normalized.toLocaleString(undefined, { maximumFractionDigits: unitInfo.unit === 'M' ? 2 : 1, minimumFractionDigits: 0 });
              return formatValueWithCurrency(value, `${formatted}${unitInfo.suffix}`);
            }
            if (abs < 1000) {
              if (isInteger) return formatValueWithCurrency(value, Math.round(value).toLocaleString());
              const formatted = Number(value.toFixed(2)).toString().replace(/\.00$/, '');
              return formatValueWithCurrency(value, formatted);
            }
            try {
              const formatted = formatNumber(value, { format: 'short' });
              return formatValueWithCurrency(value, formatted);
            } catch (e) {
              return formatValueWithCurrency(value, String(value));
            }
          }
        }
      };

      // Helper function to format number based on options (legacy, for backward compatibility)
      // Supports: 'adaptive', 'short', 'full', 'decimal', 'percentage'
      const formatNumberValue = (value: number): string => {
        // Use unit-aware formatting for consistency
        return formatNumberWithUnit(value, true);
      };

      const arcBandsForUpdate = resolveGaugeArcBandsForGauge(effectiveMin, effectiveMax, optionsRaw);
      const isStreamRefresh =
        typeof window !== 'undefined' && Boolean((window as any).__chartStreamSilentRefresh);

      const currentCustomizationKey = JSON.stringify({
        splitNumber: optionsRaw.splitNumber,
        fontSize: optionsRaw.fontSize,
        arcWidth: resolveGaugeArcWidth(optionsRaw.arcWidth),
        roundCap: optionsRaw.roundCap,
        showPointer: optionsRaw.showPointer,
        showLabels: optionsRaw.showLabels,
        showTotal: optionsRaw.showTotal,
        numberFormat: optionsRaw.numberFormat,
        currencyFormat: optionsRaw.currencyFormat,
        currencySymbol: optionsRaw.currencySymbol,
        colorScheme: optionsRaw.colorScheme,
        valueRangeBoundsMode: optionsRaw.valueRangeBoundsMode,
        customBands: optionsRaw.customBands,
        valueRangeColorLow: optionsRaw.valueRangeColorLow,
        valueRangeColorMid: optionsRaw.valueRangeColorMid,
        valueRangeColorHigh: optionsRaw.valueRangeColorHigh,
        valueRangeLowMin: optionsRaw.valueRangeLowMin,
        valueRangeLowMax: optionsRaw.valueRangeLowMax,
        valueRangeMidMin: optionsRaw.valueRangeMidMin,
        valueRangeMidMax: optionsRaw.valueRangeMidMax,
        valueRangeHighMin: optionsRaw.valueRangeHighMin,
        valueRangeHighMax: optionsRaw.valueRangeHighMax,
      });

      if (rootRef.current &&
        chartLiveRefs.current?.boundsKey === currentBoundsKey &&
        chartLiveRefs.current?.customizationKey === currentCustomizationKey) {
        const primaryValue = Number(value);
        const pointerValue = Number.isFinite(primaryValue)
          ? Math.max(effectiveMin, Math.min(effectiveMax, primaryValue))
          : effectiveMin;
        const animDuration = isStreamRefresh ? 350 : 800;

        if (isStreamRefresh) {
          try {
            (window as any).__chartStreamSilentRefresh = false;
          } catch {
            /* ignore */
          }
        }

        const pointerDataItem = chartLiveRefs.current.pointerDataItem;
        if (pointerDataItem && optionsRaw.showPointer !== false) {
          if (optionsRaw.animation !== false) {
            try {
              pointerDataItem.animate({
                key: 'value',
                to: pointerValue,
                duration: animDuration,
                easing: am5.ease.out(am5.ease.cubic),
              });
            } catch {
              pointerDataItem.set('value', pointerValue);
            }
          } else {
            pointerDataItem.set('value', pointerValue);
          }
        }

        const item = transformedData[0];
        if (item) {
          const sourceValue = item.value || 0;
          const itemColorStr =
            resolveValueRangeColorForValueForGauge(
              Number(sourceValue || 0),
              optionsRaw,
              effectiveMin,
              effectiveMax,
            ) ||
            arcBandsForUpdate[0]?.color ||
            resolvedPalette[0];
          const itemAmColor = toAmColor(resolveColorString(itemColorStr) || itemColorStr);
          const rawNum = Number(sourceValue || 0);
          const centerFormatted = Number.isFinite(rawNum)
            ? optionsRaw.numberFormat === 'decimal'
              ? rawNum.toFixed(2)
              : formatNumberValue(rawNum)
            : formatNumberValue(0);

          chartLiveRefs.current.valueLabel?.setAll({
            text: centerFormatted,
            fill: itemAmColor,
          });

          if (optionsRaw.showTotal === true && chartLiveRefs.current.totalLabel) {
            const total = transformedData.reduce((sum, row) => sum + (row.value || 0), 0);
            chartLiveRefs.current.totalLabel.set('text', `Total: ${formatNumberValue(total)}`);
          }
        }

        return;
      }

      chartLiveRefs.current = null;

      if (rootRef.current) {
        try { rootRef.current.dispose(); } catch { }
        rootRef.current = null;
      }
      const root = am5.Root.new(chartRef.current);
      root.setThemes([am5themes_Animated.new(root)]);
      root.autoResize = true;
      rootRef.current = root;
      root._logo?.dispose();
      applyAm5InterfaceTheme(root, chartTheme);

      // Remove default/root paddings; keep small inset so arc/labels stay inside the box
      try {
        root.container.setAll({
          paddingTop: 6,
          paddingBottom: 6,
          paddingLeft: 8,
          paddingRight: 8,
          width: am5.p100,
          height: am5.p100,
          layout: root.verticalLayout,
        });
      } catch { }

      // Prevent clicks anywhere inside the chart container from bubbling up to parent components
      const containerEl = chartRef.current;
      let stopDomClick: ((e: Event) => void) | null = null;
      if (containerEl) {
        stopDomClick = (e: Event) => {
          try { e.stopPropagation(); } catch { }
        };
        containerEl.addEventListener('click', stopDomClick, true);
        containerEl.addEventListener('pointerdown', stopDomClick, true);
        containerEl.addEventListener('mousedown', stopDomClick, true);
      }

      // Determine responsive sizes from container
      const containerRect = containerEl ? containerEl.getBoundingClientRect() : { width: 300, height: 200 };
      const cardWidth = Math.max(60, containerRect.width || 300);
      const cardHeight = Math.max(60, containerRect.height || 200);
      const responsiveScale = Math.max(60, Math.min(cardWidth, cardHeight * 1.75));
      const baseSize = responsiveScale;
      const scaleRatio = (optionsRaw.fontSize ?? 14) / 14;
      const titleFontSize = Math.max(8, Math.round(Math.max(8, Math.min(13, Math.round(baseSize * 0.038))) * scaleRatio));
      const valueFontSize = Math.max(10, Math.round(Math.max(12, Math.min(24, Math.round(baseSize * 0.075))) * scaleRatio));
      const labelGap = Math.max(4, Math.round(baseSize * 0.022));

      // Yes/No style semicircle gauge with Low / Mid / High bands (amCharts gauge pattern)
      const GAUGE_START_ANGLE = 180;
      const GAUGE_END_ANGLE = 360;

      const gaugeSection = root.container.children.push(
        am5.Container.new(root, {
          width: am5.p100,
          height: am5.percent(68),
          centerX: am5.p50,
          x: am5.p50,
        })
      );

      const chart = gaugeSection.children.push(
        am5radar.RadarChart.new(root, {
          panX: false,
          panY: false,
          startAngle: GAUGE_START_ANGLE,
          endAngle: GAUGE_END_ANGLE,
          width: am5.percent(90),
          height: am5.percent(90),
          centerX: am5.p50,
          centerY: am5.p100,
          x: am5.p50,
          y: am5.p100,
        })
      );

      const GAUGE_AXIS_INNER_RADIUS = -resolveGaugeArcWidth(optionsRaw.arcWidth);
      const gaugeLineCap = optionsRaw.roundCap !== false ? 'round' : 'butt';

      const axisRenderer = am5radar.AxisRendererCircular.new(root, {
        innerRadius: GAUGE_AXIS_INNER_RADIUS,
        strokeOpacity: 0,
        minGridDistance: Math.max(12, Math.round(160 / tickIntervals)),
      });

      axisRenderer.labels.template.setAll({
        forceHidden: false,
        fontSize: Math.max(8, Math.round(baseFontSize * 0.72)),
        fontWeight: '500',
        fill: chartTheme.cardForeground,
        fillOpacity: 0.9,
        inside: false,
        radius: 14,
        paddingTop: 2,
        paddingBottom: 2,
      });
      axisRenderer.ticks.template.setAll({
        visible: true,
        strokeOpacity: 0.5,
        stroke: chartTheme.border,
        length: 6,
      });
      axisRenderer.grid.template.setAll({
        forceHidden: true,
      });
      axisRenderer.axisFills.template.setAll({
        visible: true,
        fillOpacity: 1,
        strokeOpacity: 0,
        lineCap: gaugeLineCap,
      });

      const axis = chart.xAxes.push(
        am5xy.ValueAxis.new(root, {
          maxDeviation: 0,
          min: effectiveMin,
          max: effectiveMax,
          strictMinMax: true,
          renderer: axisRenderer,
        })
      );

      try {
        axis.set('extraMin', 0);
        axis.set('extraMax', 0);
      } catch {
        // ignore if not supported on this axis type
      }

      axisRenderer.labels.template.adapters.add('text', (text) => {
        const axisRangeSpan = (effectiveMax - effectiveMin) || 1;
        try {
          if (text == null || text === '') return text;
          const cleaned = String(text).replace(/,/g, '').trim();
          const num = Number(cleaned);
          if (!Number.isFinite(num)) return text;
          if (optionsRaw.numberFormat === 'percentage') {
            const pct = axisRangeSpan > 0 ? ((num - effectiveMin) / axisRangeSpan) * 100 : 0;
            const clamped = Math.max(0, Math.min(100, pct));
            return `${clamped.toFixed(0)}%`;
          }
          if (axisRangeSpan <= 100 && Math.abs(num - Math.round(num)) < 1e-6) {
            return String(Math.round(num));
          }
          if (axisRangeSpan <= 1000) {
            return Number(num.toFixed(2)).toString();
          }
          return formatNumberValue(num);
        } catch {
          return text;
        }
      });

      chart.radarContainer.setAll({
        centerX: am5.p50,
        centerY: am5.p100,
        paddingTop: 0,
        paddingBottom: 0,
      });

      const arcBands = resolveGaugeArcBandsForGauge(effectiveMin, effectiveMax, optionsRaw);
      arcBands.forEach((band) => {
        const rangeItem = axis.makeDataItem({ value: band.start, endValue: band.end });
        const axisRange = axis.createAxisRange(rangeItem);
        const bandLabel = rangeItem.get('label');
        if (bandLabel) {
          bandLabel.setAll({ forceHidden: true });
        }
        const axisFill = axisRange.get('axisFill');
        if (axisFill) {
          axisFill.setAll({
            visible: true,
            fillOpacity: 1,
            fill: toAmColor(band.color),
            lineCap: gaugeLineCap,
          });
        }
      });

      const primaryValue = Number(value);
      const pointerValue = Number.isFinite(primaryValue)
        ? Math.max(effectiveMin, Math.min(effectiveMax, primaryValue))
        : effectiveMin;

      let pointerDataItem: am5.DataItem<am5xy.IValueAxisDataItem> | null = null;
      let valueLabelRef: am5.Label | null = null;
      let totalLabelRef: am5.Label | null = null;

      if (optionsRaw.showPointer !== false) {
        const axisDataItem = axis.makeDataItem({});
        axisDataItem.set('value', pointerValue);
        pointerDataItem = axisDataItem;

        const hand = am5radar.ClockHand.new(root, {
          radius: am5.percent(88),
        });
        const pointerColor = toAmColor('#111111');

        hand.pin.setAll({ fill: pointerColor, strokeOpacity: 0 });
        hand.hand.setAll({ fill: pointerColor, strokeOpacity: 0 });

        axisDataItem.set(
          'bullet',
          am5xy.AxisBullet.new(root, {
            sprite: hand,
          }),
        );
        axis.createAxisRange(axisDataItem);
        const grid = axisDataItem.get('grid');
        if (grid) grid.set('visible', false);

        if (optionsRaw.animation !== false) {
          try {
            axisDataItem.animate({
              key: 'value',
              to: pointerValue,
              duration: 800,
              easing: am5.ease.out(am5.ease.cubic),
            });
          } catch { }
        }

        if (onChartInteraction) {
          const stopAndCall = (ev: any, fn: () => void) => {
            try {
              const domEv = ev?.originalEvent || ev?.domEvent || ev?.event || ev;
              if (domEv && (domEv as any).__gaugeHandled) return;
              if (domEv) (domEv as any).__gaugeHandled = true;
              domEv?.stopPropagation?.();
            } catch { }
            fn();
          };
          hand.pin.events.on('click', (ev: any) => stopAndCall(ev, () => onChartInteraction('value', pointerValue)));
          hand.hand.events.on('click', (ev: any) => stopAndCall(ev, () => onChartInteraction('value', pointerValue)));
        }
      }

      // Label + value below the gauge arc, centered in the card
      const labelFooter = root.container.children.push(
        am5.Container.new(root, {
          width: am5.p100,
          layout: root.verticalLayout,
          centerX: am5.p50,
          x: am5.p50,
          paddingTop: labelGap,
          paddingBottom: Math.max(2, Math.round(baseSize * 0.012)),
        })
      );

      transformedData.forEach((item, index) => {
        if (index !== 0) return;
        const sourceValue = item.value || 0;
        const sourceCategory = item.axisLabelText || item.category || '';
        const itemColorStr = resolveValueRangeColorForValueForGauge(
          Number(sourceValue || 0),
          optionsRaw,
          effectiveMin,
          effectiveMax,
        ) || arcBands[0]?.color || resolvedPalette[0];
        const itemAmColor = toAmColor(resolveColorString(itemColorStr) || itemColorStr);

        try {
          if (sourceCategory && optionsRaw.showLabels !== false) {
            const titleLabel = am5.Label.new(root, {
              text: String(sourceCategory),
              fontSize: titleFontSize,
              fontWeight: '600',
              fill: chartTheme.cardForeground,
              fillOpacity: 0.82,
              x: am5.p50,
              centerX: am5.p50,
              width: am5.p100,
              textAlign: 'center',
              oversizedBehavior: 'fit',
              paddingBottom: Math.max(2, Math.round(baseSize * 0.01)),
            });
            labelFooter.children.push(titleLabel);
          }

          const rawNum = Number(sourceValue || 0);
          const centerFormatted = Number.isFinite(rawNum)
            ? (optionsRaw.numberFormat === 'decimal'
              ? rawNum.toFixed(2)
              : formatNumberValue(rawNum))
            : formatNumberValue(0);

          const valueLabel = am5.Label.new(root, {
            text: centerFormatted,
            fontSize: valueFontSize,
            fontWeight: '700',
            fill: itemAmColor,
            x: am5.p50,
            centerX: am5.p50,
            width: am5.p100,
            textAlign: 'center',
            oversizedBehavior: 'fit',
            paddingTop: Math.max(1, Math.round(baseSize * 0.006)),
          });

          valueLabelRef = valueLabel;
          labelFooter.children.push(valueLabel);
        } catch {
          // ignore label render errors
        }
      });

      // Add total label if showTotal is enabled
      if (optionsRaw.showTotal === true) {
        const total = transformedData.reduce((sum, item) => sum + (item.value || 0), 0);
        const formattedTotal = formatNumberValue(total);

        const totalLabel = am5.Label.new(root, {
          text: `Total: ${formattedTotal}`,
          fontSize: Math.max(10, Math.round(titleFontSize * 0.95)),
          fontWeight: '600',
          fill: chartTheme.cardForeground,
          x: am5.p50,
          centerX: am5.p50,
          width: am5.p100,
          textAlign: 'center',
          paddingTop: Math.max(2, Math.round(baseSize * 0.008)),
        });
        totalLabelRef = totalLabel;
        labelFooter.children.push(totalLabel);
      }

      chartLiveRefs.current = {
        boundsKey: currentBoundsKey,
        customizationKey: currentCustomizationKey,
        pointerDataItem,
        valueLabel: valueLabelRef,
        totalLabel: totalLabelRef,
      };

      // Interaction handlers: attach category clicks from center/right labels
      if (onChartInteraction) {
        setTimeout(() => {
          labelFooter.children.each((child) => {
            if (child instanceof am5.Label) {
              const labelText = child.get('text') || '';
              transformedData.forEach((item) => {
                // Use axisLabelText for display matching, but pass original category for interaction
                const sourceCategory = item.axisLabelText || item.category || '';
                const categoryForInteraction = item.category || '';
                if (labelText.includes(sourceCategory) || labelText.includes(categoryForInteraction)) {
                  child.events.on('click', (ev: any) => {
                    try {
                      ev?.originalEvent?.stopPropagation?.();
                      ev?.domEvent?.stopPropagation?.();
                      ev?.event?.stopPropagation?.();
                    } catch { }
                    onChartInteraction('category', categoryForInteraction);
                  });
                }
              });
            }
          });
        }, 100);
      }

      if (!chartHasAppearedRef.current) {
        chart.appear(1000, 100);
        chartHasAppearedRef.current = true;
      }

      return () => {
        try {
          if (containerEl && stopDomClick) {
            containerEl.removeEventListener('click', stopDomClick, true);
            containerEl.removeEventListener('pointerdown', stopDomClick, true);
            containerEl.removeEventListener('mousedown', stopDomClick, true);
          }
        } catch {
          /* ignore */
        }
      };
    }, [transformedData, gaugeConfig, onChartInteraction, customizationState, customizationOptions, theme]);

    return (
      <div className="relative h-full w-full min-h-0 min-w-0 overflow-hidden">
        <div ref={chartRef} className="absolute inset-0 min-h-0 min-w-0" />
      </div>
    );
  }
