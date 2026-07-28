import { useEffect, useRef, useMemo, useState, useCallback } from 'react';
import * as am5 from '@amcharts/amcharts5';
import * as am5xy from '@amcharts/amcharts5/xy';
import am5themes_Animated from '@amcharts/amcharts5/themes/Animated';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { AlertTriangle, CircleAlert, Columns3, Rows3 } from 'lucide-react';
import {
  scorecardBarFillStyle,
  scorecardBarTrackStyle
} from '@/pages/ExploratoryAnalysis/AgenticSemantics/agenticBarShineThemes';
import { formatNumber } from '@/utils/numberFormatters';
import type { BarCustomizationOptions } from '../customize/barCustomizeTypes';
import { defaultOptions as barDefaultOptions } from '../customize/barCustomizeTypes';
import { GROUPED_BAR_SHINE_PALETTES, createShinePaletteFromBase } from '@/pages/ExploratoryAnalysis/AgenticSemantics/am5MiniChartConstants';
import { colorSchemes } from '../../pie';
import { computePaddedValueAxisDomain } from '@/utils/chartValueAxisDomain';
import { primeSeriesLinkedTooltipFill, attachSeriesLinkedTooltipContrast } from '@/pages/ExploratoryAnalysis/AgenticSemantics/am5MiniChartTooltip';
import { useTheme } from '@/context/theme';
import { applyAm5InterfaceTheme, probeAmChartThemeColors, type AmChartThemePack } from '../../amChartThemeColors';
import { ChartDomScrollLegend, type ChartDomScrollLegendItem, am5ColorToCssHex } from '../../ChartDomScrollLegend';
import {
  attachBottomCategoryAxisTitle,
  attachBottomValueAxisTitle,
  attachLeftCategoryAxisTitle,
  attachLeftValueAxisTitle,
  resolveCategoryAxisTitle,
  resolveValueAxisTitle,
  resolveChartValueFields,
  CHART_AXIS_TICK_FONT_SIZE,
  CHART_AXIS_TICK_FONT_WEIGHT,
  type ChartMetricParam,
} from '../../chartAxisTitleUtils';
import {
  attachChartScrollbarYRangeSync,
  resolveChartAxisTruncateOptions,
  resolveDataZoomMin,
} from '../../chartScrollbarYAxisSync';

/** Column thickness (px). Lower = slimmer bars / more category spacing. */
const BAR_COLUMN_WIDTH_GROUPED_PX = 20;
const BAR_COLUMN_WIDTH_HORIZONTAL_SINGLE_PX = 14;
/**
 * Rounded outer corners: vertical = top (TL/TR); horizontal = value end (TR/BR).
 * On horizontal ColumnSeries, bar thickness is `height`; fixed `width` would cap length along X.
 */
const BAR_COLUMN_CORNER_RADIUS = 7;

function verticalBarTopCornerRadius(isStacked: boolean, seriesIndex: number, seriesCount: number) {
  const roundTop = !isStacked || seriesIndex === seriesCount - 1;
  return {
    cornerRadiusTL: roundTop ? BAR_COLUMN_CORNER_RADIUS : 0,
    cornerRadiusTR: roundTop ? BAR_COLUMN_CORNER_RADIUS : 0,
    cornerRadiusBL: 0,
    cornerRadiusBR: 0,
  };
}

function horizontalBarEndCornerRadius(isStacked: boolean, seriesIndex: number, seriesCount: number) {
  const roundEnd = !isStacked || seriesIndex === seriesCount - 1;
  return {
    cornerRadiusTL: 0,
    cornerRadiusBL: 0,
    cornerRadiusTR: roundEnd ? BAR_COLUMN_CORNER_RADIUS : 0,
    cornerRadiusBR: roundEnd ? BAR_COLUMN_CORNER_RADIUS : 0,
  };
}

function numOrUndef(v: unknown): number | undefined {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim()) {
    const n = Number(v);
    if (Number.isFinite(n)) return n;
  }
  return undefined;
}

function formatCount(n: number): string {
  return new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 }).format(n);
}

function formatScore(n: number): string {
  return n % 1 === 0 ? String(n) : n.toFixed(2);
}

/** Vertical column shine (same as am5MiniChartBarSingle / am5MiniChartBarGrouped). */
function barColumnShineGradient(
  root: am5.Root,
  palette: readonly [string, string, string],
  rotation: number = 90,
) {
  const [topHex, midHex, botHex] = palette;
  return am5.LinearGradient.new(root, {
    rotation,
    stops: [
      { color: am5.color(topHex), offset: 0 },
      { color: am5.color(midHex), offset: 0.5 },
      { color: am5.color(botHex), offset: 1 },
    ],
  });
}

interface BarChartProps {
  data: Array<{ category: string; value: number; originalData: any }> | {
    x_axis?: string;
    data?: Array<Record<string, any>>;
    columns?: string[];
  };
  isStacked?: boolean;
  orientation?: 'vertical' | 'horizontal';
  onChartInteraction?: (
    field: string,
    value: any,
    originalData?: any,
    eventDimensionFields?: string[],
    eventDrillFilters?: Array<{ column: string; value: any }>,
  ) => void;
  customizationOptions?: BarCustomizationOptions;
  /** API x-axis field name (e.g. STATEMENT_DATE); used when `data` is a plain array. */
  x_axis?: string;
  /** API response columns — used for value-axis title when row keys are generic (`value`). */
  columns?: string[];
  /** API params.metrics — alias shown on value axis when set, else columns name. */
  metrics?: ChartMetricParam[];
}

export function BarChart({ data, isStacked = false, orientation = 'vertical', onChartInteraction, customizationOptions, x_axis: xAxisProp, columns: columnsProp, metrics: metricsProp = [] }: BarChartProps) {
  const { theme } = useTheme();
  const chartRef = useRef<HTMLDivElement>(null);
  const rootRef = useRef<am5.Root | null>(null);
  const chartStateRef = useRef<any>(null); // holds chart/xAxis/yAxis/series/legend for in-place updates
  const [barDomLegend, setBarDomLegend] = useState<ChartDomScrollLegendItem[]>([]);
  const [barOrientation, setBarOrientation] = useState<'vertical' | 'horizontal'>(() => {
    if (customizationOptions && typeof customizationOptions.horizontal === 'boolean') {
      return customizationOptions.horizontal ? 'horizontal' : 'vertical';
    }
    const winOpts = typeof window !== 'undefined' ? (window as any).__chartCustomizationOptions : null;
    if (winOpts && typeof winOpts.horizontal === 'boolean') {
      return winOpts.horizontal ? 'horizontal' : 'vertical';
    }
    return orientation;
  });

  const rawRow = useMemo(() => {
    if (data && typeof data === 'object' && !Array.isArray(data) && 'data' in data && Array.isArray(data.data)) {
      return data.data[0];
    }
    if (Array.isArray(data)) {
      if (data[0]?.originalData) return data[0].originalData;
      return data[0];
    }
    return null;
  }, [data]);

  const isScorecard = useMemo(() => {
    if (barOrientation !== 'horizontal') return false;
    if (!rawRow) return false;
    // Check if it looks like a trust scorecard
    const keys = Object.keys(rawRow);
    const hasTableName = keys.some(k => k.toLowerCase() === 'table_name');
    const hasTrustScore = keys.some(k => k.toLowerCase() === 'trust_score' || k.toLowerCase() === 'overall_trust_score');
    return hasTableName && hasTrustScore;
  }, [rawRow, barOrientation]);

  const payload = useMemo(() => {
    return (data as any)?.chart_payload || (data as any)?.payload || null;
  }, [data]);

  const summary = useMemo(() => {
    return payload?.summary || (data as any)?.summary || {};
  }, [payload, data]);

  const tableName = rawRow ? String(rawRow.table_name ?? rawRow.TABLE_NAME ?? "") : "";
  
  const trustMain = rawRow ? (
    numOrUndef(rawRow.trust_score) ??
    numOrUndef(rawRow.TRUST_SCORE) ??
    numOrUndef(rawRow.overall_trust_score) ??
    numOrUndef(summary?.overall_trust_score) ??
    0
  ) : 0;
  
  const rowCount = rawRow ? (numOrUndef(rawRow.row_count) ?? numOrUndef(rawRow.ROW_COUNT)) : undefined;
  
  const columnCount = rawRow ? (
    numOrUndef(rawRow.column_count) ??
    numOrUndef(rawRow.COLUMN_COUNT) ??
    numOrUndef(rawRow.num_columns) ??
    numOrUndef(rawRow.NUM_COLUMNS) ??
    numOrUndef(summary?.column_count) ??
    numOrUndef(summary?.num_columns)
  ) : undefined;
  
  const critical = rawRow ? (numOrUndef(rawRow.critical_issue_count) ?? numOrUndef(rawRow.CRITICAL_ISSUE_COUNT) ?? numOrUndef(summary?.critical_issue_count) ?? 0) : 0;
  
  const warnings = rawRow ? (numOrUndef(rawRow.warning_issue_count) ?? numOrUndef(rawRow.WARNING_ISSUE_COUNT) ?? numOrUndef(summary?.warning_issue_count) ?? 0) : 0;

  const NON_BAR_FIELDS = useMemo(() => new Set([
    "table_name",
    "TABLE_NAME",
    "row_count",
    "ROW_COUNT",
    "column_count",
    "COLUMN_COUNT",
    "num_columns",
    "NUM_COLUMNS",
    "warning_issue_count",
    "WARNING_ISSUE_COUNT",
    "critical_issue_count",
    "CRITICAL_ISSUE_COUNT",
    "overall_trust_score",
    "OVERALL_TRUST_SCORE"
  ]), []);

  const displayCols = useMemo(() => {
    const raw = payload?.display_columns || (data as any)?.display_columns;
    if (!Array.isArray(raw)) return [] as { field: string; label: string }[];
    const out: { field: string; label: string }[] = [];
    for (const c of raw) {
      if (!c || typeof (c as { field?: unknown }).field !== "string") continue;
      const field = String((c as { field: string }).field);
      const label =
        typeof (c as { label?: unknown }).label === "string" && (c as { label: string }).label.trim()
          ? (c as { label: string }).label.trim()
          : field.replace(/_/g, " ");
      out.push({ field, label });
    }
    return out;
  }, [payload, data]);

  const bars = useMemo((): Array<{ field: string; label: string; value: number }> => {
    if (!rawRow) return [];
    const specs: Array<{ field: string; label: string; value: number }> = [];
    const seen = new Set<string>();
    const ordered = displayCols.length
      ? displayCols
      : Object.keys(rawRow)
          .filter((k) => !NON_BAR_FIELDS.has(k) && typeof rawRow[k] === "number")
          .map((field) => ({ field, label: field.replace(/_/g, " ") }));

    for (const { field, label } of ordered) {
      if (NON_BAR_FIELDS.has(field)) continue;
      const value = numOrUndef(rawRow[field]);
      if (value == null) continue;
      specs.push({ field, label, value });
      seen.add(field);
    }
    if (specs.length === 0 && rawRow) {
      for (const [field, raw] of Object.entries(rawRow)) {
        if (NON_BAR_FIELDS.has(field) || seen.has(field)) continue;
        const value = numOrUndef(raw);
        if (value == null) continue;
        specs.push({ field, label: field.replace(/_/g, " "), value });
      }
    }
    const trustBar = specs.find((b) => b.field === "trust_score" || b.field === "TRUST_SCORE" || b.field === "overall_trust_score");
    const rest = specs.filter((b) => b.field !== "trust_score" && b.field !== "TRUST_SCORE" && b.field !== "overall_trust_score");
    return trustBar ? [...rest, { ...trustBar, label: "Overall Trust" }] : rest;
  }, [rawRow, displayCols, NON_BAR_FIELDS]);

  // Get customization options from prop or window and keep reactive to UI changes
  const [options, setOptions] = useState<Partial<BarCustomizationOptions>>(() => {
    // Merge provided/custom/global options with defaults so missing fields fall back to sensible values
    const base = { ...(barDefaultOptions as any) } as Partial<BarCustomizationOptions>;
    if (customizationOptions) return { ...base, ...(customizationOptions as any) } as Partial<BarCustomizationOptions>;
    if (typeof window !== 'undefined') return { ...base, ...((window as any).__chartCustomizationOptions || {}) } as Partial<BarCustomizationOptions>;
    return base;
  });


  useEffect(() => {
    if (customizationOptions) {
      setOptions(customizationOptions);
      return;
    }
    if (typeof window === 'undefined') return;
    const winOpts = (window as any).__chartCustomizationOptions;
    if (winOpts) setOptions(winOpts);
    const handler = (e: any) => {
      try {
        setOptions(e?.detail || (window as any).__chartCustomizationOptions || {});
      } catch (err) { }
    };
    window.addEventListener('chartCustomizationChanged', handler);
    return () => { window.removeEventListener('chartCustomizationChanged', handler); };
  }, [customizationOptions]);

  useEffect(() => {
    if (customizationOptions && typeof customizationOptions.horizontal === 'boolean') {
      setBarOrientation(customizationOptions.horizontal ? 'horizontal' : 'vertical');
    }
  }, [customizationOptions]);

  useEffect(() => {
    if (options && typeof options.horizontal === 'boolean') {
      setBarOrientation(options.horizontal ? 'horizontal' : 'vertical');
    }
  }, [options?.horizontal]);

  // Transform API response format to chart data format and apply sorting
  const chartData = useMemo(() => {
    let transformedData: any[] = [];

    // Check if data is in API response format (has x_axis, data, columns)
    if (data && typeof data === 'object' && !Array.isArray(data) && 'x_axis' in data && 'data' in data && 'columns' in data) {
      const apiResponse = data as { x_axis: string; data: Array<Record<string, any>>; columns: string[] };
      const xAxisField = apiResponse.x_axis;
      const rawData = apiResponse.data || [];
      const columns = apiResponse.columns || [];

      if (!xAxisField || !rawData.length || !columns.length) return [];

      // Find value columns (all columns except x_axis)
      const valueColumns = columns.filter(col => col !== xAxisField);

      if (valueColumns.length === 0) return [];

      // Transform data for grouped bar chart (multiple value columns)
      if (valueColumns.length > 1) {
        transformedData = rawData.map((item) => {
          const category = String(item[xAxisField] || '');
          const result: any = { category, originalData: item };
          // Add each value column as a separate field
          valueColumns.forEach(col => {
            result[col] = Number(item[col]) || 0;
          });
          return result;
        });
      } else {
        // Single value column — keep the API column name so axis titles stay in sync with metric changes.
        const valueColumn = valueColumns[0];
        transformedData = rawData.map((item) => ({
          category: String(item[xAxisField] || ''),
          [valueColumn]: Number(item[valueColumn]) || 0,
          originalData: item,
        }));
      }
    } else if (Array.isArray(data)) {
      // Legacy format - already transformed
      transformedData = data;
    }

    // Apply parent-level sorting when requested (sort by total across dimensions or by name)
    const sortByParent = options?.sortSeriesBy || 'none';
    const ascendingParent = !!options?.sortSeriesAscending;
    if (sortByParent && sortByParent !== 'none' && transformedData && transformedData.length) {
      if (sortByParent === 'total_value') {
        const sumValues = (obj: any) => {
          return Object.keys(obj).reduce((acc, k) => {
            if (k === 'category' || k === 'originalData') return acc;
            const n = Number(obj[k]);
            return acc + (Number.isFinite(n) ? n : 0);
          }, 0);
        };
        transformedData = transformedData.slice().sort((a: any, b: any) => {
          const ta = sumValues(a);
          const tb = sumValues(b);
          if (ta !== tb) return ascendingParent ? ta - tb : tb - ta;
          return String(a.category || '').localeCompare(String(b.category || ''));
        });
      } else if (sortByParent === 'name') {
        transformedData = transformedData.slice().sort((a: any, b: any) => {
          const cmp = String(a.category || '').localeCompare(String(b.category || ''));
          return ascendingParent ? cmp : -cmp;
        });
      }
    }

    return transformedData;
  }, [data, options?.sortSeriesBy, options?.sortSeriesAscending]);

  // Drilldown state: when a category is clicked we show its dimensions.
  const [drilldownCategory, setDrilldownCategory] = useState<string | null>(null);
  const [displayData, setDisplayData] = useState<any[]>(chartData);
  const [warningMessage, setWarningMessage] = useState<string | null>(null);
  // Drilldown uses `displayData` to show dimensions; rely on amCharts' scrollbars for zooming.

  const valueField = useMemo(() => {
    if (data && typeof data === 'object' && !Array.isArray(data) && 'columns' in data && 'x_axis' in data) {
      const cols = data.columns || [];
      const xa = data.x_axis;
      const valCols = cols.filter(col => col !== xa);
      return valCols[0] || 'value';
    }
    return 'value';
  }, [data]);

  const xAxisColumn = useMemo(() => {
    if (data && typeof data === 'object' && !Array.isArray(data)) {
      const xa = (data as { x_axis?: string; xAxis?: string }).x_axis ?? (data as { xAxis?: string }).xAxis;
      if (xa) return String(xa);
    }
    if (xAxisProp) return String(xAxisProp);
    return 'category';
  }, [data, xAxisProp]);

  const emitCategoryRowInteraction = useCallback(
    (row: any) => {
      if (!onChartInteraction) return;
      const category = row?.category || '';
      const orig = row?.originalData ?? row;
      const candidateKeys =
        orig && typeof orig === 'object'
          ? Object.keys(orig).filter((k) => !!k && k !== 'value' && k !== 'category' && !k.includes('('))
          : [];
      const inferredField =
        candidateKeys.find((k) => k !== xAxisColumn && orig[k] !== undefined) ?? xAxisColumn;
      const inferredValue =
        orig && inferredField && orig[inferredField] !== undefined ? orig[inferredField] : category;
      const drillFilters = [{ column: inferredField, value: inferredValue }];
      onChartInteraction('category', inferredValue, orig, undefined, drillFilters);
      try {
        if (typeof window !== 'undefined' && window.dispatchEvent) {
          window.dispatchEvent(
            new CustomEvent('pieSliceInteraction', {
              detail: {
                value: inferredValue,
                originalData: orig,
                column: inferredField,
                drillFilters,
              },
            }),
          );
        }
      } catch {
        // ignore
      }
    },
    [onChartInteraction, xAxisColumn],
  );

  const maxVal = useMemo(() => {
    if (!displayData || displayData.length === 0) return 1;
    const values = displayData.map((d: any) => Number(d[valueField]) || 0).filter(v => typeof v === 'number' && !isNaN(v));
    const max = Math.max(...values, 0);
    return max > 0 ? max : 1;
  }, [displayData, valueField]);

  const getCustomBarStyles = (idx: number) => {
    const colorSchemeKey = options?.colorScheme || 'agentic-base';
    const activeScheme = colorSchemes.find((s) => s.value === colorSchemeKey) || colorSchemes[0];
    const activeColors = activeScheme ? activeScheme.colors : [];
    
    let palette: readonly [string, string, string];
    if (activeColors && activeColors.length > 0) {
      const baseColor = activeColors[idx % activeColors.length];
      palette = createShinePaletteFromBase(baseColor);
    } else {
      palette = GROUPED_BAR_SHINE_PALETTES[idx % GROUPED_BAR_SHINE_PALETTES.length];
    }
    
    const [topHex, midHex, botHex] = palette;
    const baseGradient = `linear-gradient(90deg, ${topHex} 0%, ${midHex} 50%, ${botHex} 100%)`;
    
    const r = parseInt(midHex.slice(1, 3), 16) || 0;
    const g = parseInt(midHex.slice(3, 5), 16) || 0;
    const b = parseInt(midHex.slice(5, 7), 16) || 0;
    
    const BAR_SHINE_OVERLAY = "linear-gradient(180deg, rgba(255,255,255,0.16) 0%, rgba(255,255,255,0.04) 42%, rgba(0,0,0,0.045) 100%)";
    
    return {
      fillStyle: {
        backgroundImage: `${BAR_SHINE_OVERLAY}, ${baseGradient}`,
        boxShadow: "inset 0 1px 0 rgba(255,255,255,0.1)",
      } as React.CSSProperties,
      trackStyle: {
        backgroundColor: `rgba(${r}, ${g}, ${b}, 0.12)`,
      } as React.CSSProperties,
    };
  };

  const isHorizontalSingle = useMemo(() => {
    if (barOrientation !== 'horizontal') return false;
    if (isStacked) return false;
    if (data && typeof data === 'object' && !Array.isArray(data) && 'columns' in data && 'x_axis' in data) {
      const cols = data.columns || [];
      const xa = data.x_axis;
      const valCols = cols.filter(col => col !== xa);
      if (valCols.length > 1) return false;
    }
    return displayData && displayData.length > 0;
  }, [displayData, barOrientation, isStacked, data]);

  // Recompute displayData when chartData, drilldownCategory or sorting option changes.
  useEffect(() => {
    // Detect API-style error payloads and surface a friendly message in the chart area.
    setWarningMessage(null);
    try {
      if (data && typeof data === 'object' && !Array.isArray(data) && 'detail' in data) {
        const detail: any = (data as any).detail;
        const hasErrorStatus = detail && (detail.status === false || (detail.status_code && detail.status_code >= 400));
        if (hasErrorStatus && detail.message) {
          let msg = String(detail.message || '');
          try {
            const normalized = msg.replace(/'/g, '"');
            const parsed = JSON.parse(normalized);
            if (parsed && parsed.message) msg = parsed.message;
          } catch (e) { }
          setWarningMessage(msg);
          setDisplayData([]);
          return;
        }
      }
    } catch (err) { }
    if (!drilldownCategory) {
      // If user requested X-axis truncation, apply the min/max window to the parent-level categories.
      try {
        if (options?.truncateXAxis) {
          const minRaw = options?.xAxisMin ?? '';
          const maxRaw = options?.xAxisMax ?? '';

          const findIndexFor = (val: string) => {
            if (!val && val !== '0') return -1;
            const asNum = parseInt(String(val), 10);
            if (!isNaN(asNum)) return asNum; // treat as index
            const idx = chartData.findIndex((d: any) => String(d.category) === String(val));
            return idx;
          };

          const minIdx = Math.max(0, findIndexFor(String(minRaw)));
          const maxIdxRaw = findIndexFor(String(maxRaw));
          const maxIdx = maxIdxRaw >= 0 ? Math.min(chartData.length - 1, maxIdxRaw) : Math.max(chartData.length - 1, minIdx);

          if (chartData && chartData.length && minIdx <= maxIdx) {
            const filtered = chartData.slice(minIdx, maxIdx + 1);
            setDisplayData(filtered);
            return;
          }
        }
      } catch (e) { }

      setDisplayData(chartData);
      return;
    }

    const target = chartData.find((d) => d.category === drilldownCategory);
    if (!target) {
      setDisplayData([]);
      return;
    }

    const valueColumns = Object.keys(target).filter(
      (key) => key !== 'category' && key !== 'originalData' && typeof target[key] === 'number'
    );

    const dims = valueColumns.map((col, idx) => ({
      category: col,
      value: Number(target[col]) || 0,
      originalData: target.originalData || target,
      // preserve original position so we can do a stable (FIFO) tie-breaker
      originalIndex: idx,
    }));

    // Apply sorting based on user-selected mode and direction
    const sortBy = options?.sortSeriesBy || 'none';
    const ascending = !!options?.sortSeriesAscending;
    if (sortBy && sortBy !== 'none') {
      if (sortBy === 'total_value') {
        dims.sort((a, b) => {
          if (a.value !== b.value) return ascending ? a.value - b.value : b.value - a.value;
          return (a.originalIndex ?? 0) - (b.originalIndex ?? 0);
        });
      } else if (sortBy === 'name') {
        dims.sort((a, b) => {
          const cmp = String(a.category || '').localeCompare(String(b.category || ''));
          return ascending ? cmp : -cmp;
        });
      }
    }

    setDisplayData(dims);
  }, [chartData, drilldownCategory, options?.sortSeriesAscending, options?.sortSeriesBy]);

  // No custom slider: displayData managed by drilldown effect and amCharts scrollbars handle zooming.

  useEffect(() => {
    if (!chartRef.current) return;
    // If there's a warning message from API, show it in place of the chart
    const escapeHtml = (unsafe: string) => {
      return unsafe
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
    };

    if (warningMessage) {
      try {
        if (chartRef.current) chartRef.current.innerHTML = `<div style="padding:16px;color:#8a2a2a;background:#fff4f4;border:1px solid #f5c2c7;border-radius:6px">${escapeHtml(warningMessage)}</div>`;
      } catch (e) { }
      return;
    }
    if (!displayData || displayData.length === 0) {
      try {
        if (chartRef.current) chartRef.current.innerHTML = '<div style="padding:16px;color:#666"></div>';
      } catch (e) { }
      return;
    }

    const chartTheme = probeAmChartThemeColors();
    const xAxisColumn = (() => {
      if (data && typeof data === 'object' && !Array.isArray(data)) {
        const xa = (data as { x_axis?: string; xAxis?: string }).x_axis ?? (data as { xAxis?: string }).xAxis;
        if (xa) return String(xa);
      }
      if (xAxisProp) return String(xAxisProp);
      return 'category';
    })();

    const apiColumns = (() => {
      if (columnsProp?.length) return columnsProp;
      if (data && typeof data === 'object' && !Array.isArray(data)) {
        const cols = (data as { columns?: string[] }).columns;
        if (Array.isArray(cols) && cols.length) return cols;
      }
      return undefined;
    })();

    // Clean up existing root if it exists
    if (rootRef.current) {
      rootRef.current.dispose();
      rootRef.current = null;
    }
    setBarDomLegend([]);

    // Create root element
    const root = am5.Root.new(chartRef.current);
    root.setThemes([am5themes_Animated.new(root)]);
    root.autoResize = true;
    rootRef.current = root;
    applyAm5InterfaceTheme(root, chartTheme);

    // Hide amCharts logo
    root._logo?.dispose();

    // Global tooltip is configured per-chart inside each chart creator

    try {
      // eslint-disable-next-line no-console

      if (barOrientation === 'horizontal') {
        createHorizontalBarChart(root, displayData, isStacked, chartTheme, options, xAxisColumn, metricsProp, apiColumns);
      } else {
        createVerticalBarChart(root, displayData, isStacked, chartTheme, options, xAxisColumn, metricsProp, apiColumns);
      }
    } catch (err) {
      // If chart creation fails, log and render a small error placeholder so UI isn't blank
      // eslint-disable-next-line no-console
      console.error('BarChart render error', err);
      try {
        if (chartRef.current) {
          const msg = err && (err as any).message ? String((err as any).message) : String(err);
          chartRef.current.innerHTML = `<div style="padding:16px;color:#8a2a2a;background:#fff4f4;border:1px solid #f5c2c7;border-radius:6px">Chart failed to render: ${escapeHtml(msg)}</div>`;
        }
      } catch (e) { /* ignore */ }
    }

    return () => {
      if (rootRef.current) {
        rootRef.current.dispose();
        rootRef.current = null;
      }
      setBarDomLegend([]);
      try { chartStateRef.current = null; } catch (e) { }
    };
  }, [displayData, isStacked, barOrientation, onChartInteraction, options, theme, data, xAxisProp, columnsProp, metricsProp]);



  const createVerticalBarChart = (
    root: am5.Root,
    data: any[],
    isStacked: boolean,
    chartTheme: AmChartThemePack,
    opts?: Partial<BarCustomizationOptions>,
    xAxisColumn: string = 'category',
    metrics: ChartMetricParam[] = [],
    columnsForTitle?: string[],
    columnWidthPx: number = BAR_COLUMN_WIDTH_GROUPED_PX,
  ) => {
    const foregroundColor = chartTheme.cardForeground;
    const tooltipBg = chartTheme.popover;
    const tooltipFg = chartTheme.popoverFg;
    const panelRing = chartTheme.background;
    const gridLineStroke = chartTheme.muted;

    const chart = root.container.children.push(
      am5xy.XYChart.new(root, {
        panX: true,
        panY: true,
        wheelX: 'panX',
        wheelY: 'panX',
        layout: root.verticalLayout,
      })
    );

    // Merge options: defaults <- global window <- component options <- per-render opts
    const mergedOpts = { ...(barDefaultOptions as any), ...((typeof window !== 'undefined' && (window as any).__chartCustomizationOptions) || {}), ...(options || {}), ...(opts || {}) } as Partial<BarCustomizationOptions>;

    const colorSchemeKey = mergedOpts.colorScheme || 'agentic-base';
    const activeScheme = colorSchemes.find((s) => s.value === colorSchemeKey) || colorSchemes[0];
    const activeColors = activeScheme ? activeScheme.colors : [];

    const getShinePalette = (idx: number): readonly [string, string, string] => {
      if (activeColors && activeColors.length > 0) {
        const baseColor = activeColors[idx % activeColors.length];
        return createShinePaletteFromBase(baseColor);
      }
      return GROUPED_BAR_SHINE_PALETTES[idx % GROUPED_BAR_SHINE_PALETTES.length];
    };

    // Number / currency helpers for vertical chart (use mergedOpts)
    const _nf = (mergedOpts && (mergedOpts as any).numberFormat) || 'short';
    const _currencyFmt = (mergedOpts && (mergedOpts as any).currencyFormat) || '';
    const _currencySym = (mergedOpts && (mergedOpts as any).currencySymbol) || '';
    const _currencyCode = (mergedOpts && (mergedOpts as any).currencyCode) || '';
    let _resolvedSymbol = _currencySym;
    if (!_resolvedSymbol && _currencyCode) {
      const map: Record<string, string> = { USD: '$', EUR: '€', GBP: '£', INR: '₹' };
      _resolvedSymbol = map[_currencyCode] || '';
    }
    const _applyNumberFormat = (val: number) => {
      if (_nf === 'short' || _nf === 'adaptive') return formatNumber(val, { format: 'short' });
      if (_nf === 'full' || _nf === 'raw' || _nf === 'decimal') return formatNumber(val, { format: 'full' });
      if (_nf === 'percent') {
        const abs = Math.abs(val);
        const pct = abs <= 1 ? (val * 100) : val;
        const formatted = pct % 1 === 0 ? String(Math.round(pct)) : pct.toFixed(2).replace(/\.0+$/, '');
        return `${formatted}%`;
      }
      return formatNumber(val, { format: 'short' });
    };
    const formatWithDecimal = (val: number) => {
      const dp = (mergedOpts && typeof (mergedOpts as any).valueDecimalPlaces === 'number') ? Number((mergedOpts as any).valueDecimalPlaces) : undefined;
      if (typeof dp === 'number') return Number(val).toFixed(Math.max(0, dp));
      return _applyNumberFormat(val);
    };
    const _formatWithCurrency = (val: number, numericString: string) => {
      if ((_currencyFmt || '') === 'none' || !_resolvedSymbol) return numericString;
      if (_nf === 'full' && (_currencyFmt || '') !== 'none') {
        try {
          const localeMap: Record<string, string> = { 'USD': 'en-US', 'EUR': 'de-DE', 'GBP': 'en-GB', 'INR': 'en-IN' };
          const locale = localeMap[_currencyCode] || 'en-US';
          return new Intl.NumberFormat(locale, { style: 'currency', currency: _currencyCode || 'USD', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(val);
        } catch (e) { }
      }
      if ((_currencyFmt || '') === 'prefix') return `${_resolvedSymbol} ${numericString}`;
      if ((_currencyFmt || '') === 'suffix') return `${numericString} ${_resolvedSymbol}`;
      return numericString;
    };

    const xRenderer = am5xy.AxisRendererX.new(root, {
      minGridDistance: 30,
      cellStartLocation: 0.1,
      cellEndLocation: 0.9,
    });
    try {
      const xRot = Number((opts && (opts as any).xAxisLabelRotation) ?? (options && (options as any).xAxisLabelRotation) ?? 0);
      xRenderer.labels.template.setAll({ fontSize: CHART_AXIS_TICK_FONT_SIZE, fontWeight: CHART_AXIS_TICK_FONT_WEIGHT, marginTop: 15, maxWidth: 100, textAlign: 'center', oversizedBehavior: 'wrap', rotation: xRot, fill: foregroundColor });
    } catch (e) {
      xRenderer.labels.template.setAll({ fontSize: CHART_AXIS_TICK_FONT_SIZE, fontWeight: CHART_AXIS_TICK_FONT_WEIGHT, marginTop: 15, maxWidth: 100, textAlign: 'center', oversizedBehavior: 'wrap', fill: foregroundColor });
    }

    const xAxis = chart.xAxes.push(
      am5xy.CategoryAxis.new(root, {
        categoryField: 'category',
        renderer: xRenderer,
      })
    );

    xAxis.data.setAll(data);

    // Data zoom: show horizontal scrollbar when options.dataZoom is true (vertical bar chart).
    const dataZoomMinVertical = resolveDataZoomMin(mergedOpts as Record<string, unknown>, 4);
    const verticalBarDataZoom = Boolean(mergedOpts?.dataZoom && data.length > dataZoomMinVertical);
    const defaultVisibleCategoryCountVertical = dataZoomMinVertical;
    try {
      if (verticalBarDataZoom) {
        const initialEnd = Math.min(1, defaultVisibleCategoryCountVertical / data.length);
        const scrollbarX = am5.Scrollbar.new(root, { orientation: 'horizontal' });
        chart.set('scrollbarX', scrollbarX);
        chart.bottomAxesContainer.children.push(scrollbarX);
        try {
          scrollbarX.set('start', 0);
          scrollbarX.set('end', initialEnd);
        } catch (e) { }
      }
    } catch (e) { }

    // Fallback global tooltip: white background, foreground text
    try {
      const globalTooltip = am5.Tooltip.new(root, { getFillFromSprite: false });
      try {
        const bg = globalTooltip.get('background');
        if (bg) bg.setAll({ fill: tooltipBg, strokeWidth: 0 });
        globalTooltip.label.setAll({ fill: tooltipFg, fontSize: 12 });
        try { globalTooltip.label.adapters.add('fill', () => tooltipFg); } catch (e) { }
      } catch (e) { }
      chart.set('tooltip', globalTooltip);
      chart.plotContainer.set('tooltip', globalTooltip);
    } catch (e) { }

    // Determine if logarithmic mode was requested and whether data allows it.
    // If only zeros are present (no negatives), we will treat zeros as a small
    // positive value so log scale can be used without collapsing. If negatives
    // exist, log remains disabled.
    const logRequested = Boolean((opts && typeof (opts as any).logarithmicAxis !== 'undefined') ? (opts as any).logarithmicAxis : options?.logarithmicAxis);
    const numericVals: number[] = [];
    try {
      data.forEach((d: any) => {
        Object.keys(d || {}).forEach((k) => {
          if (k === 'category' || k === 'originalData') return;
          const v = d[k];
          if (typeof v === 'number' && isFinite(v)) numericVals.push(v);
        });
      });
    } catch (e) { }
    const hasNegative = numericVals.some((v) => v < 0);
    const hasZero = numericVals.some((v) => v === 0);
    const minPositive = numericVals.filter((v) => v > 0).reduce((acc, v) => Math.min(acc, v), Number.POSITIVE_INFINITY);
    const canUseLog = !hasNegative && numericVals.length > 0 && numericVals.some((v) => v > 0);
    // If only zeros and positives exist, or only positives, we enable log.
    const logEnabled = logRequested && canUseLog;
    // Compute a small substitute for zeros when needed
    const treatZeroAs = (logEnabled && hasZero) ? (isFinite(minPositive) ? Math.max(minPositive / 100, 1e-9) : 1e-9) : undefined;

    const yRenderer = am5xy.AxisRendererY.new(root, {});
    try {
      const yRot = Number((opts && (opts as any).yAxisLabelRotation) ?? (options && (options as any).yAxisLabelRotation) ?? 0);
      yRenderer.labels.template.setAll({ fontSize: CHART_AXIS_TICK_FONT_SIZE, fontWeight: CHART_AXIS_TICK_FONT_WEIGHT, rotation: yRot, fill: foregroundColor });
    } catch (e) {
      yRenderer.labels.template.setAll({ fontSize: CHART_AXIS_TICK_FONT_SIZE, fontWeight: CHART_AXIS_TICK_FONT_WEIGHT, fill: foregroundColor });
    }

    // Format Y-axis labels according to selected number/currency format
    yRenderer.labels.template.adapters.add('text', (text, target) => {
      try {
        if (!text || typeof text !== 'string') return '';
        const cleanedText = text.replace(/,/g, '').trim();
        if (!/[0-9]/.test(cleanedText)) return '';
        const numValue = parseFloat(cleanedText);
        if (isNaN(numValue)) return '';

        // When using log-scale, prefer adaptive/short formatting for tick labels
        const nf = logEnabled ? 'short' : ((opts && (opts as any).numberFormat) || (options && (options as any).numberFormat) || '');
        const currencyFmt = (opts && (opts as any).currencyFormat) || (options && (options as any).currencyFormat) || '';
        const currencySym = (opts && (opts as any).currencySymbol) || (options && (options as any).currencySymbol) || '';
        const currencyCode = (opts && (opts as any).currencyCode) || (options && (options as any).currencyCode) || '';

        // Resolve a currency symbol if one isn't provided
        let resolvedSymbol = currencySym;
        if (!resolvedSymbol && currencyCode) {
          const map: Record<string, string> = { USD: '$', EUR: '€', GBP: '£', INR: '₹' };
          resolvedSymbol = map[currencyCode] || '';
        }

        const applyNumberFormat = (val: number) => {
          // Map known format values to the formatNumber util
          if (nf === 'short' || nf === 'adaptive') {
            return formatNumber(val, { format: 'short' });
          }
          if (nf === 'full' || nf === 'raw' || nf === 'decimal') {
            return formatNumber(val, { format: 'full' });
          }
          if (nf === 'percent') {
            // If value looks like ratio (0..1) convert to percent
            const abs = Math.abs(val);
            const pct = abs <= 1 ? (val * 100) : val;
            const formatted = pct % 1 === 0 ? String(Math.round(pct)) : pct.toFixed(2).replace(/\.0+$/, '');
            return `${formatted}%`;
          }
          // Fallback
          return formatNumber(val, { format: 'short' });
        };

        let formatted = applyNumberFormat(numValue);

        // Apply currency symbol if requested and format is not percent
        if (resolvedSymbol && nf !== 'percent') {
          if (currencyFmt === 'prefix') formatted = `${resolvedSymbol} ${formatted}`;
          else if (currencyFmt === 'suffix') formatted = `${formatted} ${resolvedSymbol}`;
        }

        return formatted;
      } catch (e) {
        return '';
      }
    });

    const yAxis = chart.yAxes.push(
      am5xy.ValueAxis.new(root, {
        renderer: yRenderer,
        ...(logEnabled ? { logarithmic: true, ...(typeof treatZeroAs !== 'undefined' ? { treatZeroAs } : {}) } : {}),
      })
    );

    // If user requested log but there are negative values, show a small notice
    if (logRequested && !logEnabled && numericVals.length > 0 && numericVals.some((v) => v < 0)) {
      try {
        const note = am5.Label.new(root, { text: 'Log scale disabled: negative values present', fontSize: 11, fill: am5.color(0x666666) });
        note.setAll({ paddingTop: 6, paddingBottom: 6, paddingLeft: 8, paddingRight: 8 });
        chart.children.push(note);
      } catch (e) { }
    }

    const valueFields = resolveChartValueFields(
      data[0],
      columnsForTitle,
      xAxisColumn !== 'category' ? xAxisColumn : undefined,
    );
    const yAxisTitleText = resolveValueAxisTitle(mergedOpts?.yAxisTitle, metrics, valueFields);
    if (yAxisTitleText || logEnabled) {
      attachLeftValueAxisTitle(chart, root, yAxisTitleText, foregroundColor, {
        margin: mergedOpts?.yAxisTitleMargin ?? 10,
        position: mergedOpts?.yAxisTitlePosition || 'left',
        logEnabled,
      });
    }

    // Minor ticks: when enabled, make grid denser and use a light dashed style for extra lines
    try {
      const minorEnabled = Boolean((opts && typeof (opts as any).minorTicks !== 'undefined') ? (opts as any).minorTicks : options?.minorTicks);
      if (minorEnabled) {
        yRenderer.setAll({ minGridDistance: 20 });
        yRenderer.grid.template.setAll({ stroke: gridLineStroke, strokeOpacity: 0.32, strokeDasharray: [2, 2] });
      } else {
        yRenderer.setAll({ minGridDistance: 50 });
        yRenderer.grid.template.setAll({ stroke: gridLineStroke, strokeOpacity: 0.4, strokeDasharray: [] });
      }
    } catch (e) { }
    try {
      xRenderer.grid.template.setAll({ stroke: gridLineStroke, strokeOpacity: 0.26 });
    } catch (e) { }
    try {
      (xRenderer as any).line.template.setAll({ stroke: gridLineStroke, strokeOpacity: 0.88, strokeWidth: 1 });
      (yRenderer as any).line.template.setAll({ stroke: gridLineStroke, strokeOpacity: 0.88, strokeWidth: 1 });
    } catch (e) { }

    // Category tick labels use renderer margin; avoid inflating chart bottom padding.
    chart.set('paddingRight', 0);

    // Ensure there is enough top padding to render labels above the plot area
    const configuredFont = (opts && (opts as any).fontSize) || options?.fontSize || 12;
    const minTopPad = configuredFont + 20; // font + breathing room
    const currentTop = (chart.get('paddingTop') as number) || 0;
    if ((currentTop || 0) < minTopPad) chart.set('paddingTop', minTopPad);
    const labelDy = -(Math.max(12, minTopPad - 8));

    // Check if we have multiple value columns (grouped bar chart)
    const firstItem = data[0];
    const valueColumns = Object.keys(firstItem || {}).filter(
      key => key !== 'category' && key !== 'originalData' && typeof firstItem[key] === 'number'
    );

    // Fills use GROUPED_BAR_SHINE_PALETTES (am5MiniChartBar / am5MiniChartBarSingle)

    if (valueColumns.length > 1) {
      // Create multiple series for grouped bar chart
      // Legend: use series as legend data (amCharts style) so legend colors match bar colors.
      const seriesList: any[] = [];
      let legend: any = null;
      const updateLegendForCategory = (category?: string) => {
        if (!legend) return;
        if (!category) {
          legend.data.setAll(seriesList);
          return;
        }
        const row = data.find((d: any) => d.category === category);
        const filtered = seriesList.filter((s: any) => {
          const name = s.get && s.get('name');
          if (!name || !row) return false;
          const v = row[name];
          return (Number(v) || 0) !== 0;
        });
        legend.data.setAll(filtered);
      };

      valueColumns.forEach((valueColumn, index) => {
        const series = chart.series.push(
          am5xy.ColumnSeries.new(root, {
            name: valueColumn,
            xAxis: xAxis,
            yAxis: yAxis,
            valueYField: valueColumn,
            categoryXField: 'category',
            stacked: isStacked,
          })
        );

        const shinePalette = getShinePalette(index);
        const [, midHex] = shinePalette;
        try {
          series.set('fill', am5.color(midHex));
        } catch (e) { }
        try {
          series.columns.template.adapters.add('fillGradient', () =>
            barColumnShineGradient(root, shinePalette, 90),
          );
          series.columns.template.setAll({
            ...verticalBarTopCornerRadius(isStacked, index, valueColumns.length),
            strokeWidth: 1,
            stroke: panelRing,
            strokeOpacity: 0.42,
            fillOpacity: 0.96,
            width: columnWidthPx,
            cursorOverStyle: 'pointer',
          });

          const tt = am5.Tooltip.new(root, { getFillFromSprite: false, autoTextColor: false });
          try {
            const bg = tt.get('background');
            if (bg) bg.setAll({ fill: am5.color(midHex), fillOpacity: 0.95, strokeWidth: 0 });
            tt.label.setAll({ fontSize: 12, textAlign: 'left' });
            attachSeriesLinkedTooltipContrast(tt, am5);
            primeSeriesLinkedTooltipFill(tt, am5.color(midHex), am5);
          } catch (e) { }
          series.set('tooltip', tt);

          series.columns.template.events.on('pointerover', (ev) => {
            const col = ev.target;
            const visual = col.get('fillGradient') || col.get('fill') || am5.color(midHex);
            primeSeriesLinkedTooltipFill(tt, visual, am5);
          });
        } catch (e) { }

        // Format tooltip with K/M/B — include series (dimension) name + category
        series.columns.template.adapters.add('tooltipText', (text, target) => {
          if (target.dataItem) {
            const dataContext = target.dataItem.dataContext as any;
            if (dataContext && typeof dataContext[valueColumn] === 'number') {
              const numeric = formatWithDecimal(Number(dataContext[valueColumn]) || 0);
              const formattedValue = _formatWithCurrency(Number(dataContext[valueColumn]) || 0, numeric);
              const seriesName = String(valueColumn || series.get('name') || '');
              const categoryName = dataContext.category ? String(dataContext.category) : '';
              return seriesName && categoryName
                ? `${seriesName} — ${categoryName}: ${formattedValue}`
                : `${seriesName || categoryName}: ${formattedValue}`;
            }
          }
          return text || '';
        });

        series.data.setAll(data);
        seriesList.push(series);

        // Add a single, stacking-aware data label per visible bar (top of bar)
        try {
          const showLabels = Boolean((opts && typeof (opts as any).showValue !== 'undefined') ? (opts as any).showValue : options?.showValue);
          if (showLabels) {
            const lastIndex = valueColumns.length - 1;
            // For stacked charts, only show one label per category — on the topmost (last) series.
            if (isStacked) {
              if (index === lastIndex) {
                series.bullets.push((root, series, dataItem) => {
                  const label = am5.Label.new(root, {
                    centerX: am5.p50,
                    centerY: am5.p0,
                    dy: labelDy,
                    fill: foregroundColor,
                    fontSize: (opts && (opts as any).fontSize) || options?.fontSize || 10,
                    textAlign: 'center',
                  });
                  try {
                    const ctx = (dataItem && (dataItem.dataContext as any)) || {};
                    const total = valueColumns.reduce((s, c) => s + (Number(ctx[c]) || 0), 0);
                    const numeric = formatWithDecimal(Number(total) || 0);
                    label.set('text', _formatWithCurrency(Number(total) || 0, numeric));
                  } catch (e) { }
                  return am5.Bullet.new(root, { sprite: label, locationY: 1 });
                });
              }
            } else {
              // Non-stacked grouped chart: label per series/bar (top aligned)
              series.bullets.push((root, series, dataItem) => {
                const label = am5.Label.new(root, {
                  centerX: am5.p50,
                  centerY: am5.p0,
                  dy: labelDy,
                  fill: foregroundColor,
                  fontSize: (opts && (opts as any).fontSize) || options?.fontSize || 10,
                  textAlign: 'center',
                });
                try {
                  const ctx = (dataItem && (dataItem.dataContext as any)) || {};
                  const v = (ctx && ctx[valueColumn]) ?? (dataItem && (dataItem.get('valueY') as number)) ?? 0;
                  const numeric = formatWithDecimal(Number(v) || 0);
                  label.set('text', _formatWithCurrency(Number(v) || 0, numeric));
                } catch (e) { }
                return am5.Bullet.new(root, { sprite: label, locationY: 1 });
              });
            }
          }
        } catch (e) { }

        series.columns.template.events.on('click', (ev) => {
          const dataItem = ev.target.dataItem;
          if (dataItem && dataItem.dataContext) {
            const context = dataItem.dataContext as any;
            const cat = context.category;
            const orig = context.originalData ?? context;
            const candidateKeys = orig && typeof orig === 'object'
              ? Object.keys(orig).filter((k) => !!k && k !== 'value' && k !== 'category' && !k.includes('('))
              : [];
            const inferredField = candidateKeys.find((k) => k !== xAxisColumn && orig[k] !== undefined) ?? xAxisColumn;
            const inferredValue = (orig && inferredField && orig[inferredField] !== undefined) ? orig[inferredField] : cat;
            const drillFilters = [{ column: inferredField, value: inferredValue }];
            // Update legend to show only dimensions for this category
            updateLegendForCategory(cat);
            // Do not auto-enter drilldown on click; only notify host
            if (onChartInteraction) onChartInteraction('category', inferredValue);
            try {
              if (typeof window !== 'undefined' && (window as any).dispatchEvent) {
                window.dispatchEvent(new CustomEvent('pieSliceInteraction', { detail: { value: inferredValue, originalData: orig, column: inferredField, drillFilters } }));
              }
            } catch (e) { /* ignore */ }
          }
        });

        series.appear();
      });


      // Add legend (only if enabled in options) — amCharts style: legend data = series, colors from bars
      try {
        const showLegend = Boolean((opts && typeof (opts as any).showLegend !== 'undefined') ? (opts as any).showLegend : options?.showLegend);
        const legendOrientationRaw = (opts && (opts as any).legendOrientation) || options?.legendOrientation || 'left';
        const legendOrientation = String(legendOrientationRaw || 'left').toLowerCase();
        if (showLegend && seriesList.length > 1) {
          const created = am5.Legend.new(root, {});
          try { created.setAll({ visible: true, opacity: 1 }); } catch (e) { }
          try { console.debug('BarChart: created grouped-vertical legend', { legendOrientation, seriesCount: seriesList.length }); } catch (e) { }
          try {
            if (legendOrientation === 'left') {
              created.set('layout', am5.VerticalLayout.new(root, {}));
              try { root.container.children.push(created); } catch (e) { try { chart.leftAxesContainer.children.push(created); } catch (ee) { } }
              created.setAll({ centerY: am5.p0, y: 0, width: 200, paddingLeft: 8 });
              try {
                (created.markers.template as any).setAll({ width: 10, height: 10, cornerRadius: 4 });
                created.labels.template.setAll({ maxWidth: 140, oversizedBehavior: 'wrap', fontSize: 11, textAlign: 'left' });
                created.itemContainers.template.setAll({ paddingLeft: 8, paddingRight: 8 });
                try { chart.set('paddingLeft', Math.max((chart.get('paddingLeft') as number) || 0, 220)); } catch (e) { }
              } catch (e) { }
            } else if (legendOrientation === 'right') {
              created.set('layout', am5.VerticalLayout.new(root, {}));
              try { root.container.children.push(created); } catch (e) { try { chart.rightAxesContainer.children.push(created); } catch (ee) { } }
              created.setAll({ centerY: am5.p0, y: 0, centerX: am5.p100, x: am5.p100, width: 200, paddingRight: 8 });
              try {
                (created.markers.template as any).setAll({ width: 10, height: 10, cornerRadius: 4 });
                created.labels.template.setAll({ maxWidth: 140, oversizedBehavior: 'wrap', fontSize: 11, textAlign: 'left' });
                created.itemContainers.template.setAll({ paddingLeft: 8, paddingRight: 8 });
                try { chart.set('paddingRight', Math.max((chart.get('paddingRight') as number) || 0, 220)); } catch (e) { }
              } catch (e) { }
            } else if (legendOrientation === 'top') {
              created.set('layout', am5.HorizontalLayout.new(root, {}));
              try { chart.topAxesContainer.children.push(created); } catch (e) { chart.children.push(created); }
              created.setAll({ centerX: am5.p50, x: am5.p50, marginBottom: 12, width: am5.percent(100) });
            } else {
              created.set('layout', am5.HorizontalLayout.new(root, {}));
              try { chart.bottomAxesContainer.children.push(created); } catch (e) { chart.children.push(created); }
              created.setAll({ centerX: am5.p50, x: am5.p50, marginTop: 15, width: am5.percent(100) });
            }
          } catch (e) { }
          legend = created;
          try { legend.data.setAll(seriesList); } catch (e) { }
          // Legend markers: use series fill (same as bar color) — amCharts style
          try {
            (legend.markers.template as any).adapters.add('fill', (fill: any, target: any) => {
              try {
                const comp = target?.dataItem?.dataContext;
                if (comp && typeof comp.get === 'function') {
                  const sFill = comp.get('fill');
                  if (sFill) return sFill;
                }
              } catch (e) { }
              return fill;
            });
            (legend.markers.template as any).adapters.add('stroke', (st: any, target: any) => {
              try {
                const comp = target?.dataItem?.dataContext;
                if (comp && typeof comp.get === 'function') {
                  const sFill = comp.get('fill');
                  if (sFill) return sFill;
                }
              } catch (e) { }
              return st;
            });
          } catch (e) { }
          // Legend item click: toggle series visibility (dataContext = series when data is seriesList)
          try {
            (legend.itemContainers.template as any).events.on('click', (ev: any) => {
              try {
                const di = ev.target && (ev.target.dataItem || ev.target.dataContext) || ev.dataItem || ev.target;
                const targetSeries = di && (di.dataContext || (di.get && di.get('dataContext')));
                if (targetSeries && typeof targetSeries.get === 'function') {
                  try { targetSeries.set('visible', !targetSeries.get('visible')); } catch (e) { }
                }
              } catch (e) { }
            });
          } catch (e) { }
          try { (legend as any).setAll && (legend as any).setAll({ width: am5.percent(100), scrollable: false }); } catch (e) { }
          try {
            try { legend.data.setAll(seriesList); } catch (e) { }
            try { (legend as any).setAll && (legend as any).setAll({ scrollable: false }); } catch (e) { }
          } catch (e) { }
          // Legend pagination + toggle state (skip pagination for left/right vertical legends)
          try {
            const fullLegendItems: any[] = seriesList.slice();
            const isVerticalLegend = legendOrientation === 'left' || legendOrientation === 'right';
            if (isVerticalLegend) {
              // Show full list vertically without pagination controls
              try { legend.data.setAll(fullLegendItems); } catch (e) { }
              try { (legend as any).setAll && (legend as any).setAll({ scrollable: false, layout: am5.VerticalLayout.new(root, {}), width: 200 }); } catch (e) { }
              try { legend.labels.template.setAll({ oversizedBehavior: 'wrap', maxWidth: 160, fontSize: 11 }); } catch (e) { }
              try { legend.itemContainers.template.setAll({ paddingTop: 6, paddingBottom: 6 }); } catch (e) { }

              // Ensure legend re-measures and parent layouts update
              try { if ((legend as any).markDirty) (legend as any).markDirty(); if ((legend as any).invalidate) (legend as any).invalidate(); } catch (e) { }

              // Wire toggle events for items (same as pagination flow)
              const hiddenMap: Record<string, boolean> = {};
              try {
                (legend.itemContainers.template as any).events.on('click', (ev: any) => {
                  try {
                    const di = ev.target && (ev.target.dataItem || ev.target.dataContext) || ev.dataItem || ev.target;
                    const ctx = di && (di.dataContext || (di.get && di.get('dataContext')));
                    const name = ctx && ctx.name;
                    if (!name) return;
                    let targetSeries: any = null;
                    try { (chart.series as any).values.forEach((s: any) => { if (String(s.get && s.get('name') || s.name) === String(name)) targetSeries = s; }); } catch (e) { }
                    if (!targetSeries) {
                      try { (chart.series as any).forEach((s: any) => { if (String(s.get && s.get('name') || s.name) === String(name)) targetSeries = s; }); } catch (e) { }
                    }
                    if (!targetSeries) return;
                    const currentlyHidden = !!hiddenMap[name];
                    hiddenMap[name] = !currentlyHidden;
                    if (hiddenMap[name]) {
                      try { targetSeries.set('visible', false); } catch (e) { }
                      try { targetSeries.columns.template.setAll({ visible: false, fillOpacity: 0, strokeOpacity: 0, interactive: false }); } catch (e) { }
                    } else {
                      try { targetSeries.set('visible', true); } catch (e) { }
                      try {
                        try {
                          targetSeries.columns.template.setAll({
                            visible: true,
                            interactive: true,
                            fill: undefined,
                            stroke: panelRing,
                            strokeOpacity: 0.42,
                            fillOpacity: 0.96,
                          });
                        } catch (e) { }
                      } catch (e) { }
                    }
                  } catch (e) { }
                });
              } catch (e) { }
            } else {
              // For horizontal legends (default), show the full legend without pagination.
              try { legend.data.setAll(fullLegendItems); } catch (e) { }
              try { legend.labels.template.setAll({ oversizedBehavior: 'wrap', maxWidth: 160, fontSize: 11 }); } catch (e) { }
              try { legend.itemContainers.template.setAll({ paddingTop: 6, paddingBottom: 6 }); } catch (e) { }
            }
          } catch (e) { }
          try {
            const _di = (created as any).dataItems as any;
            if (_di) {
              if (typeof _di.each === 'function') {
                _di.each((di: any) => {
                  try {
                    const ctx = (di && (di.get ? di.get('dataContext') : di.dataContext)) || {};
                    const m = (di && (di.get ? di.get('marker') : di.marker));
                    const f = ctx && (ctx.__color || ctx.fill);
                    if (m && f) {
                      try { m.set && m.set('fill', f); } catch (e) { }
                      try { m.set && m.set('stroke', f); } catch (e) { }
                      try {
                        const children = (m.children || (m.get && m.get('children')) || []);
                        if (children && typeof children.forEach === 'function') {
                          children.forEach((c: any) => {
                            try { c.set && c.set('fill', f); } catch (e) { }
                            try { c.set && c.set('stroke', f); } catch (e) { }
                          });
                        }
                      } catch (e) { }
                    }
                  } catch (e) { }
                });
              } else if (Array.isArray(_di)) {
                _di.forEach((di: any) => {
                  try {
                    const ctx = (di && (di.get ? di.get('dataContext') : di.dataContext)) || {};
                    const m = (di && (di.get ? di.get('marker') : di.marker));
                    const f = ctx && (ctx.__color || ctx.fill);
                    if (m && f) { try { m.set('fill', f); } catch (e) { } try { m.set('stroke', f); } catch (e) { } }
                  } catch (e) { }
                });
              }
            }
          } catch (e) { }
          try { console.debug('BarChart: grouped-vertical legend data set', legend.data && legend.data.length); } catch (e) { }
          try { legend.labels.template.setAll({ fontSize: 11, fontWeight: '500', fill: foregroundColor }); } catch (e) { }
          try { legend.labels.template.set('text', '{name}'); } catch (e) { }
          try { legend.markers.template.setAll({ width: 10, height: 10 }); } catch (e) { }
          try {
            try {
              const tmpl: any = (legend.markers.template as any);
              let markerChild: any = tmpl.children && tmpl.children.length ? tmpl.children[0] : undefined;
              if (!markerChild) {
                markerChild = am5.Rectangle.new(root, { width: 10, height: 10, cornerRadius: 3 });
                tmpl.children = tmpl.children || [];
                tmpl.children.push(markerChild);
              }
              try { markerChild.adapters && markerChild.adapters.add('fill', (fill: any, target: any) => { try { const di = target && target.dataItem; const ctx = di && di.dataContext; const f = ctx && (ctx.__color || ctx.fill); if (f) { try { return (typeof f === 'object' && f) ? f : am5.color(f); } catch (e) { } } } catch (e) { } return fill; }); } catch (e) { }
              try { markerChild.adapters && markerChild.adapters.add('stroke', (st: any, target: any) => { try { const di = target && target.dataItem; const ctx = di && di.dataContext; const f = ctx && (ctx.__color || ctx.fill); if (f) { try { return (typeof f === 'object' && f) ? f : am5.color(f); } catch (e) { } } } catch (e) { } return st; }); } catch (e) { }
            } catch (e) { }
          } catch (e) { }
          try {
            (legend.markers.template as any).adapters.add('fill', (fill: any, target: any) => {
              try {
                const di = target && target.dataItem;
                const ctx = di && di.dataContext;
                const f = ctx && (ctx.__color || ctx.fill);
                if (f) { try { return (typeof f === 'object' && f) ? f : am5.color(f); } catch (e) { return fill; } }
              } catch (e) { }
              return fill;
            });
          } catch (e) { }
          try {
            (legend.markers.template as any).adapters.add('stroke', (st: any, target: any) => {
              try {
                const di = target && target.dataItem;
                const ctx = di && di.dataContext;
                const f = ctx && (ctx.__color || ctx.fill);
                if (f) { try { return (typeof f === 'object' && f) ? f : am5.color(f); } catch (e) { return st; } }
              } catch (e) { }
              return st;
            });
          } catch (e) { }
          try {
            try {
              const tmpl: any = (legend.markers.template as any);
              let markerChild: any = tmpl.children && tmpl.children.length ? tmpl.children[0] : undefined;
              if (!markerChild) {
                markerChild = am5.Rectangle.new(root, { width: 10, height: 10, cornerRadius: 3 });
                tmpl.children = tmpl.children || [];
                tmpl.children.push(markerChild);
              }
              try { markerChild.adapters && markerChild.adapters.add('fill', (fill: any, target: any) => { try { const di = target && target.dataItem; const ctx = di && di.dataContext; const f = ctx && (ctx.__color || ctx.fill); if (f) { try { return (typeof f === 'object' && f) ? f : am5.color(f); } catch (e) { } } } catch (e) { } return fill; }); } catch (e) { }
              try { markerChild.adapters && markerChild.adapters.add('stroke', (st: any, target: any) => { try { const di = target && target.dataItem; const ctx = di && di.dataContext; const f = ctx && (ctx.__color || ctx.fill); if (f) { try { return (typeof f === 'object' && f) ? f : am5.color(f); } catch (e) { } } } catch (e) { } return st; }); } catch (e) { }
            } catch (e) { }
          } catch (e) { }
          try {
            try {
              const tmpl: any = (legend.markers.template as any);
              let markerChild: any = tmpl.children && tmpl.children.length ? tmpl.children[0] : undefined;
              if (!markerChild) {
                markerChild = am5.Rectangle.new(root, { width: 10, height: 10, cornerRadius: 3 });
                tmpl.children = tmpl.children || [];
                tmpl.children.push(markerChild);
              }
              try { markerChild.adapters && markerChild.adapters.add('fill', (fill: any, target: any) => { try { const di = target && target.dataItem; const ctx = di && di.dataContext; const f = ctx && (ctx.__color || ctx.fill); if (f) { try { return (typeof f === 'object' && f) ? f : am5.color(f); } catch (e) { } } } catch (e) { } return fill; }); } catch (e) { }
              try { markerChild.adapters && markerChild.adapters.add('stroke', (st: any, target: any) => { try { const di = target && target.dataItem; const ctx = di && di.dataContext; const f = ctx && (ctx.__color || ctx.fill); if (f) { try { return (typeof f === 'object' && f) ? f : am5.color(f); } catch (e) { } } } catch (e) { } return st; }); } catch (e) { }
            } catch (e) { }
          } catch (e) { }
          try {
            (legend.markers.template as any).adapters.add('fill', (fill: any, target: any) => {
              try {
                const di = target && target.dataItem;
                const ctx = di && di.dataContext;
                const f = ctx && (ctx.__color || ctx.fill);
                if (f) { try { return (typeof f === 'object' && f) ? f : am5.color(f); } catch (e) { return fill; } }
              } catch (e) { }
              return fill;
            });
          } catch (e) { }
          try {
            (legend.markers.template as any).adapters.add('stroke', (st: any, target: any) => {
              try {
                const di = target && target.dataItem;
                const ctx = di && di.dataContext;
                const f = ctx && (ctx.__color || ctx.fill);
                if (f) { try { return (typeof f === 'object' && f) ? f : am5.color(f); } catch (e) { return st; } }
              } catch (e) { }
              return st;
            });
          } catch (e) { }

          try { legend.itemContainers.template.setAll({ paddingTop: 6, paddingBottom: 6 }); } catch (e) { }
          try { legend.labels.template.setAll({ maxWidth: 160, oversizedBehavior: 'wrap' }); } catch (e) { }
          try { legend.labels.template.set('tooltipText', '{name}'); } catch (e) { }
          try { (legend.markers.template as any).setAll({ width: 10, height: 10, cornerRadius: 3, strokeWidth: 1 }); } catch (e) { }
          try { legend.itemContainers.template.setAll({ interactive: true }); } catch (e) { }
          try { (created as any).setAll && (created as any).setAll({ scrollable: false }); } catch (e) { }
          try { chart.plotContainer.events.on('click', () => { legend.data.setAll(seriesList); setDrilldownCategory(null); }); } catch (e) { }

          if (legend) {
            try {
              legend.set('visible', false);
              legend.set('opacity', 0);
              try {
                legend.set('forceHidden', true);
              } catch (e) { }
              try {
                legend.set('height', 0);
              } catch (e) { }
            } catch (e) { }
            setBarDomLegend(
              seriesList.map((s: any, index: number) => {
                const pal = getShinePalette(index);
                const midHex = pal[1];
                return {
                  id: String(s.get?.('name') ?? index),
                  line: String(s.get?.('name') ?? ''),
                  color: am5ColorToCssHex(s.get?.('fill'), midHex),
                };
              }),
            );
          }
        }
      } catch (e) { }
    } else {
      // Single series bar chart
      const valueField = valueColumns[0] || 'value';
      const series = chart.series.push(
        am5xy.ColumnSeries.new(root, {
          name: valueField,
          xAxis: xAxis,
          yAxis: yAxis,
          valueYField: valueField,
          categoryXField: 'category',
          stacked: isStacked,
        })
      );

      try {
        const defaultPalette = getShinePalette(0);
        const [, defaultMid] = defaultPalette;
        series.set('fill', am5.color(defaultMid));
        series.columns.template.adapters.add('fillGradient', (_g, target) => {
          const ctxRow = target.dataItem?.dataContext as { category?: string } | undefined;
          const cat = String(ctxRow?.category ?? '');
          let idx = data.findIndex((row: any) => String(row.category) === cat);
          if (idx < 0) idx = 0;
          const pal = getShinePalette(idx);
          return barColumnShineGradient(root, pal, 90);
        });
        series.columns.template.setAll({
          ...verticalBarTopCornerRadius(isStacked, 0, 1),
          strokeWidth: 1,
          stroke: panelRing,
          strokeOpacity: 0.42,
          fillOpacity: 0.96,
          width: columnWidthPx,
          cursorOverStyle: 'pointer',
        });
        const tt = am5.Tooltip.new(root, { getFillFromSprite: false, autoTextColor: false });
        try {
          const bg = tt.get('background');
          if (bg) bg.setAll({ fill: am5.color(defaultMid), fillOpacity: 0.95, strokeWidth: 0 });
          tt.label.setAll({ fontSize: 12, textAlign: 'left' });
          attachSeriesLinkedTooltipContrast(tt, am5);
          primeSeriesLinkedTooltipFill(tt, am5.color(defaultMid), am5);
        } catch (e) { }
        series.set('tooltip', tt);

        series.columns.template.events.on('pointerover', (ev) => {
          const col = ev.target;
          const visual = col.get('fillGradient') || col.get('fill') || am5.color(defaultMid);
          primeSeriesLinkedTooltipFill(tt, visual, am5);
        });
      } catch (e) { }

      // Format tooltip with K/M/B — include series name when available
      series.columns.template.adapters.add('tooltipText', (text, target) => {
        if (target.dataItem) {
          const dataContext = target.dataItem.dataContext as any;
          if (dataContext && typeof dataContext[valueField] === 'number') {
            const numeric = formatWithDecimal(Number(dataContext[valueField]) || 0);
            const formattedValue = _formatWithCurrency(Number(dataContext[valueField]) || 0, numeric);
            const seriesName = String(valueField || series.get('name') || '');
            const categoryName = dataContext.category ? String(dataContext.category) : '';
            return seriesName && categoryName
              ? `${seriesName} — ${categoryName}: ${formattedValue}`
              : `${seriesName || categoryName}: ${formattedValue}`;
          }
        }
        return text || '';
      });

      series.data.setAll(data);

      // Add formatted data labels for single-series vertical chart
      try {
        const showLabels = Boolean((opts && typeof (opts as any).showValue !== 'undefined') ? (opts as any).showValue : options?.showValue);
        if (showLabels) {
          series.bullets.push((root, series, dataItem) => {
            const label = am5.Label.new(root, {
              centerX: am5.p50,
              centerY: am5.p0,
              dy: labelDy,
              fill: foregroundColor,
              fontSize: (opts && (opts as any).fontSize) || options?.fontSize || 10,
              textAlign: 'center',
            });
            try {
              const ctx = (dataItem && (dataItem.dataContext as any)) || {};
              const v = (ctx && ctx[valueField]) ?? (dataItem && (dataItem.get('valueY') as number)) ?? 0;
              const numeric = formatWithDecimal(Number(v) || 0);
              label.set('text', _formatWithCurrency(Number(v) || 0, numeric));
            } catch (e) { }
            return am5.Bullet.new(root, { sprite: label, locationY: 1 });
          });
        }
      } catch (e) { }

      series.columns.template.events.on('click', (ev) => {
        const dataItem = ev.target.dataItem;
        if (dataItem && dataItem.dataContext) {
          const context = dataItem.dataContext as any;
          const orig = context.originalData ?? context;
          const cat = context.category;
          const candidateKeys = orig && typeof orig === 'object'
            ? Object.keys(orig).filter((k) => !!k && k !== 'value' && k !== 'category' && !k.includes('('))
            : [];
          const inferredField = candidateKeys.find((k) => k !== xAxisColumn && orig[k] !== undefined) ?? xAxisColumn;
          const inferredValue = (orig && inferredField && orig[inferredField] !== undefined) ? orig[inferredField] : cat;
          const drillFilters = [{ column: inferredField, value: inferredValue }];
          // Do not auto-enter drilldown on click; only notify host
          if (onChartInteraction) onChartInteraction('category', inferredValue);
          try {
            if (typeof window !== 'undefined' && (window as any).dispatchEvent) {
              window.dispatchEvent(new CustomEvent('pieSliceInteraction', { detail: { value: inferredValue, originalData: orig, column: inferredField, drillFilters } }));
            }
          } catch (e) { /* ignore */ }
        }
      });

      series.appear();
      // Single-series bar: legend is redundant (one metric / one color) — omit even if showLegend is on.
      try {
        const showLegend = Boolean((opts && typeof (opts as any).showLegend !== 'undefined') ? (opts as any).showLegend : options?.showLegend);
        const omitSingleSeriesLegend = true;
        const legendOrientationRaw = (opts && (opts as any).legendOrientation) || options?.legendOrientation || 'left';
        const legendOrientation = String(legendOrientationRaw || 'left').toLowerCase();
        if (showLegend && !omitSingleSeriesLegend) {
          const created = am5.Legend.new(root, {});
          try { created.setAll({ visible: true, opacity: 1 }); } catch (e) { }
          try { console.debug('BarChart: created single-vertical legend', { legendOrientation }); } catch (e) { }
          try {
            if (legendOrientation === 'left') {
              created.set('layout', am5.VerticalLayout.new(root, {}));
              try { root.container.children.push(created); } catch (e) { try { chart.leftAxesContainer.children.push(created); } catch (ee) { } }
              created.setAll({ centerY: am5.p0, y: 0, width: 200, paddingLeft: 8 });
              try {
                (created.markers.template as any).setAll({ width: 10, height: 10, cornerRadius: 4 });
                created.labels.template.setAll({ maxWidth: 140, oversizedBehavior: 'wrap', fontSize: 11, textAlign: 'left' });
                created.itemContainers.template.setAll({ paddingLeft: 8, paddingRight: 8 });
                try { chart.set('paddingLeft', Math.max((chart.get('paddingLeft') as number) || 0, 220)); } catch (e) { }
              } catch (e) { }
            } else if (legendOrientation === 'right') {
              created.set('layout', am5.VerticalLayout.new(root, {}));
              try { root.container.children.push(created); } catch (e) { try { chart.rightAxesContainer.children.push(created); } catch (ee) { } }
              created.setAll({ centerY: am5.p0, y: 0, centerX: am5.p100, x: am5.p100, width: 200, paddingRight: 8 });
              try {
                (created.markers.template as any).setAll({ width: 10, height: 10, cornerRadius: 4 });
                created.labels.template.setAll({ maxWidth: 140, oversizedBehavior: 'wrap', fontSize: 11, textAlign: 'left' });
                created.itemContainers.template.setAll({ paddingLeft: 8, paddingRight: 8 });
                try { chart.set('paddingRight', Math.max((chart.get('paddingRight') as number) || 0, 220)); } catch (e) { }
              } catch (e) { }
            } else if (legendOrientation === 'top') {
              created.set('layout', am5.HorizontalLayout.new(root, {}));
              try { chart.topAxesContainer.children.push(created); } catch (e) { chart.children.push(created); }
              created.setAll({ centerX: am5.p50, x: am5.p50, marginBottom: 12, width: am5.percent(100) });
            } else {
              created.set('layout', am5.HorizontalLayout.new(root, {}));
              try { chart.bottomAxesContainer.children.push(created); } catch (e) { chart.children.push(created); }
              created.setAll({ centerX: am5.p50, x: am5.p50, marginTop: 15, width: am5.percent(100) });
            }
          } catch (e) { }
          try { created.data.setAll([series]); } catch (e) { }
          try { (created as any).setAll && (created as any).setAll({ width: am5.percent(100), scrollable: false }); } catch (e) { }
          // Legend markers: use series fill (same as bar color) — amCharts style
          try {
            (created.markers.template as any).adapters.add('fill', (fill: any, target: any) => {
              try {
                const comp = target?.dataItem?.dataContext;
                if (comp && typeof comp.get === 'function') {
                  const sFill = comp.get('fill');
                  if (sFill) return sFill;
                }
              } catch (e) { }
              return fill;
            });
            (created.markers.template as any).adapters.add('stroke', (st: any, target: any) => {
              try {
                const comp = target?.dataItem?.dataContext;
                if (comp && typeof comp.get === 'function') {
                  const sFill = comp.get('fill');
                  if (sFill) return sFill;
                }
              } catch (e) { }
              return st;
            });
          } catch (e) { }
          try {
            try { created.data.setAll([series]); } catch (e) { }
            try { (created as any).setAll && (created as any).setAll({ scrollable: false }); } catch (e) { }

            try {
              (created.itemContainers.template as any).events.on('click', (ev: any) => {
                try {
                  const di = ev.target && (ev.target.dataItem || ev.target.dataContext) || ev.dataItem || ev.target;
                  const targetSeries = di && (di.dataContext || (di.get && di.get('dataContext')));
                  if (targetSeries && typeof targetSeries.get === 'function') {
                    try { targetSeries.set('visible', !targetSeries.get('visible')); } catch (e) { }
                  }
                } catch (e) { }
              });
            } catch (e) { }
          } catch (e) { }
          try { console.debug('BarChart: single-vertical legend data set', created.data && created.data.length); } catch (e) { }
          try { created.labels.template.setAll({ fontSize: 11, fontWeight: '500', fill: foregroundColor }); } catch (e) { }
          try { created.labels.template.setAll({ maxWidth: 160, oversizedBehavior: 'wrap' }); } catch (e) { }
          try { created.labels.template.set('tooltipText', '{name}'); } catch (e) { }
          try { (created.markers.template as any).setAll({ width: 12, height: 12, cornerRadius: 3, strokeWidth: 1 }); } catch (e) { }
          try {
            try {
              const tmpl: any = (created.markers.template as any);
              let markerChild: any = tmpl.children && tmpl.children.length ? tmpl.children[0] : undefined;
              if (!markerChild) {
                markerChild = am5.Rectangle.new(root, { width: 10, height: 10, cornerRadius: 3 });
                tmpl.children = tmpl.children || [];
                tmpl.children.push(markerChild);
              }
              try { markerChild.adapters && markerChild.adapters.add('fill', (fill: any, target: any) => { try { const di = target && target.dataItem; const ctx = di && di.dataContext; const f = ctx && (ctx.__color || ctx.fill); if (f) { try { return (typeof f === 'object' && f) ? f : am5.color(f); } catch (e) { } } } catch (e) { } return fill; }); } catch (e) { }
              try { markerChild.adapters && markerChild.adapters.add('stroke', (st: any, target: any) => { try { const di = target && target.dataItem; const ctx = di && di.dataContext; const f = ctx && (ctx.__color || ctx.fill); if (f) { try { return (typeof f === 'object' && f) ? f : am5.color(f); } catch (e) { } } } catch (e) { } return st; }); } catch (e) { }
            } catch (e) { }
          } catch (e) { }
          try { created.itemContainers.template.setAll({ paddingTop: 6, paddingBottom: 6, interactive: true }); } catch (e) { }
          try { (created as any).setAll && (created as any).setAll({ scrollable: false }); } catch (e) { }
        }
      } catch (e) { }
    }

    // Compute visible numeric domain from the filtered `data` and apply to Y axis (vertical case)
    try {
      const allVals: number[] = [];
      data.forEach((d: any) => {
        if (!d) return;
        Object.keys(d).forEach((k) => {
          if (k === 'category' || k === 'originalData') return;
          const v = d[k];
          if (typeof v === 'number' && isFinite(v)) allVals.push(v);
        });
      });
      if (allVals.length) {
        let minVal = Math.min(...allVals);
        let maxVal = Math.max(...allVals);

        // If user explicitly requested truncation for the Y axis, prefer provided bounds
        const opt = (k: string) => {
          if (opts && typeof (opts as any)[k] !== 'undefined') return (opts as any)[k];
          if (options && typeof (options as any)[k] !== 'undefined') return (options as any)[k];
          return undefined;
        };
        const userTruncate = Boolean(opt('truncateAxis') || opt('truncateXAxis'));
        let rawMin = opt('axisMin');
        let rawMax = opt('axisMax');
        // allow xAxisMin/xAxisMax to act as value-axis bounds when truncateXAxis was used in UI
        if ((rawMin === undefined || rawMin === '') && Boolean(opt('truncateXAxis'))) rawMin = opt('xAxisMin');
        if ((rawMax === undefined || rawMax === '') && Boolean(opt('truncateXAxis'))) rawMax = opt('xAxisMax');

        const parseBound = (v: any) => {
          if (v === null || typeof v === 'undefined' || v === '') return null;
          const n = Number(String(v));
          return Number.isFinite(n) ? n : null;
        };

        if (userTruncate) {
          const pMin = parseBound(rawMin);
          const pMax = parseBound(rawMax);
          // If both provided and reversed, swap them
          if (pMin !== null && pMax !== null && pMin > pMax) {
            const tmp = pMin; // swap
            // assign swapped
            minVal = pMax as number;
            maxVal = tmp as number;
          } else {
            if (pMin !== null) minVal = pMin;
            if (pMax !== null) maxVal = pMax;
          }
        }

        if (logEnabled) {
          if (minVal <= 0) minVal = (typeof treatZeroAs !== 'undefined') ? treatZeroAs! : Math.max(1e-9, Math.min(...allVals.filter(v => v > 0)));
        }

        {
          const padded = computePaddedValueAxisDomain(allVals, minVal, maxVal, logEnabled, userTruncate, rawMin, rawMax);
          minVal = padded.minVal;
          maxVal = padded.maxVal;
        }

        const explicitMaxBoundY = userTruncate && parseBound(rawMax) !== null;
        try {
          // Apply min/max. Only enforce strictMinMax when both bounds are explicit
          try { (yAxis as any).set('min', minVal); } catch (e) { }
          try { (yAxis as any).set('max', maxVal); } catch (e) { }
          try { (yAxis as any).set('extraMin', 0); } catch (e) { }
          try { (yAxis as any).set('extraMax', explicitMaxBoundY ? 0 : 0.08); } catch (e) { }
          const bothBoundsProvided = (userTruncate && parseBound(rawMin) !== null && parseBound(rawMax) !== null);
          try { (yAxis as any).set('strictMinMax', bothBoundsProvided); } catch (e) { }
          // If both bounds present, zoom directly to them; otherwise ask amCharts to choose the complementary bound
          try { (yAxis as any).zoomToValues(minVal, maxVal); } catch (e) { }

          // Try to force amCharts to recompute ticks/labels/layout. These methods
          // may not exist on some builds/versions; calls are wrapped in try/catch.
          try { (yAxis as any).invalidate(); } catch (e) { }
          try { (chart as any).invalidateData && (chart as any).invalidateData(); } catch (e) { }
          try { (chart as any).validate && (chart as any).validate(); } catch (e) { }
        } catch (e) { }
      }
    } catch (e) { }

    if (verticalBarDataZoom) {
      const mergedForTruncate = { ...(options ?? {}), ...(opts ?? {}) } as Record<string, unknown>;
      const truncateOpts = resolveChartAxisTruncateOptions(mergedForTruncate);
      attachChartScrollbarYRangeSync(root, chart, xAxis, yAxis, {
        rows: data,
        valueKeys: valueFields,
        logEnabled,
        treatZeroAs,
        userTruncate: truncateOpts.userTruncate,
        rawMin: truncateOpts.rawMin,
        rawMax: truncateOpts.rawMax,
        skipWhenBothBoundsFixed: truncateOpts.bothBoundsFixed,
        afterCategoryZoom: () => {
          try {
            (xAxis as any).zoomToIndexes?.(
              0,
              Math.min(defaultVisibleCategoryCountVertical - 1, data.length - 1),
            );
          } catch (e) { }
        },
      });
    }

    // Category-axis name: centered below x tick labels (after legend/scrollbar layout).
    const xAxisTitle = resolveCategoryAxisTitle(mergedOpts?.xAxisTitle, xAxisColumn);
    attachBottomCategoryAxisTitle(chart, root, xAxisTitle, foregroundColor, mergedOpts?.xAxisTitleMargin ?? 2);
  };

  const createHorizontalBarChart = (
    root: am5.Root,
    data: any[],
    isStacked: boolean,
    chartTheme: AmChartThemePack,
    opts?: Partial<BarCustomizationOptions>,
    xAxisColumn: string = 'category',
    metrics: ChartMetricParam[] = [],
    columnsForTitle?: string[],
    groupedBarHeightPx: number = BAR_COLUMN_WIDTH_GROUPED_PX,
    singleBarHeightPx: number = BAR_COLUMN_WIDTH_HORIZONTAL_SINGLE_PX,
  ) => {
    const firstItem = data[0];
    const valueColumns = Object.keys(firstItem || {}).filter(
      key => key !== 'category' && key !== 'originalData' && typeof firstItem[key] === 'number'
    );

    const foregroundColor = chartTheme.cardForeground;
    const tooltipBg = chartTheme.popover;
    const tooltipFg = chartTheme.popoverFg;
    const panelRing = chartTheme.background;
    const gridLineStroke = chartTheme.muted;

    const chart = root.container.children.push(
      am5xy.XYChart.new(root, {
        panX: true,
        panY: true,
        wheelX: 'panX',
        wheelY: 'panX',
        layout: root.verticalLayout,
      })
    );

    // Determine if logarithmic mode was requested and whether data allows it
    // Determine if logarithmic mode was requested and whether data allows it.
    // If only zeros are present (no negatives), we will treat zeros as a small
    // positive value so log scale can be used without collapsing. If negatives
    // exist, log remains disabled.
    const logRequested = Boolean((opts && typeof (opts as any).logarithmicAxis !== 'undefined') ? (opts as any).logarithmicAxis : options?.logarithmicAxis);
    const numericValsHoriz: number[] = [];
    try {
      data.forEach((d: any) => {
        Object.keys(d || {}).forEach((k) => {
          if (k === 'category' || k === 'originalData') return;
          const v = d[k];
          if (typeof v === 'number' && isFinite(v)) numericValsHoriz.push(v);
        });
      });
    } catch (e) { }
    const hasNegativeHoriz = numericValsHoriz.some((v) => v < 0);
    const hasZeroHoriz = numericValsHoriz.some((v) => v === 0);
    const minPositiveHoriz = numericValsHoriz.filter((v) => v > 0).reduce((acc, v) => Math.min(acc, v), Number.POSITIVE_INFINITY);
    const canUseLogHoriz = !hasNegativeHoriz && numericValsHoriz.length > 0 && numericValsHoriz.some((v) => v > 0);
    const logEnabledHoriz = logRequested && canUseLogHoriz;
    const treatZeroAsHoriz = (logEnabledHoriz && hasZeroHoriz) ? (isFinite(minPositiveHoriz) ? Math.max(minPositiveHoriz / 100, 1e-9) : 1e-9) : undefined;

    // Merge options: defaults <- global window <- component options <- per-render opts
    const mergedOpts = { ...(barDefaultOptions as any), ...((typeof window !== 'undefined' && (window as any).__chartCustomizationOptions) || {}), ...(options || {}), ...(opts || {}) } as Partial<BarCustomizationOptions>;

    const colorSchemeKey = mergedOpts.colorScheme || 'agentic-base';
    const activeScheme = colorSchemes.find((s) => s.value === colorSchemeKey) || colorSchemes[0];
    const activeColors = activeScheme ? activeScheme.colors : [];

    const getShinePalette = (idx: number): readonly [string, string, string] => {
      if (activeColors && activeColors.length > 0) {
        const baseColor = activeColors[idx % activeColors.length];
        return createShinePaletteFromBase(baseColor);
      }
      return GROUPED_BAR_SHINE_PALETTES[idx % GROUPED_BAR_SHINE_PALETTES.length];
    };

    // Number / currency helpers for horizontal chart (use mergedOpts)
    const _nf = logEnabledHoriz ? 'short' : ((mergedOpts && (mergedOpts as any).numberFormat) || 'short');
    const _currencyFmt = (mergedOpts && (mergedOpts as any).currencyFormat) || '';
    const _currencySym = (mergedOpts && (mergedOpts as any).currencySymbol) || '';
    const _currencyCode = (mergedOpts && (mergedOpts as any).currencyCode) || '';
    let _resolvedSymbol = _currencySym;
    if (!_resolvedSymbol && _currencyCode) {
      const map: Record<string, string> = { USD: '$', EUR: '€', GBP: '£', INR: '₹' };
      _resolvedSymbol = map[_currencyCode] || '';
    }
    const _applyNumberFormat = (val: number) => {
      if (_nf === 'short' || _nf === 'adaptive') return formatNumber(val, { format: 'short' });
      if (_nf === 'full' || _nf === 'raw' || _nf === 'decimal') return formatNumber(val, { format: 'full' });
      if (_nf === 'percent') {
        const abs = Math.abs(val);
        const pct = abs <= 1 ? (val * 100) : val;
        const formatted = pct % 1 === 0 ? String(Math.round(pct)) : pct.toFixed(2).replace(/\.0+$/, '');
        return `${formatted}%`;
      }
      return formatNumber(val, { format: 'short' });
    };
    const formatWithDecimal = (val: number) => {
      const dp = (mergedOpts && typeof (mergedOpts as any).valueDecimalPlaces === 'number') ? Number((mergedOpts as any).valueDecimalPlaces) : undefined;
      if (typeof dp === 'number') return Number(val).toFixed(Math.max(0, dp));
      return _applyNumberFormat(val);
    };
    const _formatWithCurrency = (val: number, numericString: string) => {
      if ((_currencyFmt || '') === 'none' || !_resolvedSymbol) return numericString;
      if (_nf === 'full' && (_currencyFmt || '') !== 'none') {
        try {
          const localeMap: Record<string, string> = { 'USD': 'en-US', 'EUR': 'de-DE', 'GBP': 'en-GB', 'INR': 'en-IN' };
          const locale = localeMap[_currencyCode] || 'en-US';
          return new Intl.NumberFormat(locale, { style: 'currency', currency: _currencyCode || 'USD', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(val);
        } catch (e) { }
      }
      if ((_currencyFmt || '') === 'prefix') return `${_resolvedSymbol} ${numericString}`;
      if ((_currencyFmt || '') === 'suffix') return `${numericString} ${_resolvedSymbol}`;
      return numericString;
    };

    // Calculate margin based on longest category name
    const maxCategoryLength = Math.max(...data.map(d => String(d.category || '').length), 0);
    const categoryMargin = Math.min(Math.max(maxCategoryLength * 4, 40), 150); // Min 60, max 150 for horizontal

    const yRenderer = am5xy.AxisRendererY.new(root, {
      minGridDistance: 30,
      cellStartLocation: 0.1,
      cellEndLocation: 0.9,
    });
    try {
      const yRot = Number((mergedOpts && (mergedOpts as any).yAxisLabelRotation) ?? 0);
      yRenderer.labels.template.setAll({ centerX: am5.p50, centerY: am5.p50, fontSize: CHART_AXIS_TICK_FONT_SIZE, fontWeight: CHART_AXIS_TICK_FONT_WEIGHT, maxWidth: categoryMargin, textAlign: 'end', oversizedBehavior: 'truncate', rotation: yRot, fill: foregroundColor });
    } catch (e) {
      yRenderer.labels.template.setAll({ centerX: am5.p50, centerY: am5.p50, fontSize: CHART_AXIS_TICK_FONT_SIZE, fontWeight: CHART_AXIS_TICK_FONT_WEIGHT, maxWidth: categoryMargin, textAlign: 'end', oversizedBehavior: 'truncate', fill: foregroundColor });
    }

    const yAxis = chart.yAxes.push(
      am5xy.CategoryAxis.new(root, {
        categoryField: 'category',
        renderer: yRenderer,
      })
    );

    yAxis.data.setAll(data);

    // Data zoom: show vertical scrollbar when options.dataZoom is true (horizontal bar chart).
    const dataZoomMinHorizontal = resolveDataZoomMin(mergedOpts as Record<string, unknown>, 6);
    const isGrouped = valueColumns.length > 1;
    const horizontalBarDataZoom = Boolean(
      mergedOpts?.dataZoom &&
      (isGrouped ? (data.length * valueColumns.length > dataZoomMinHorizontal) : (data.length > dataZoomMinHorizontal))
    );
    const defaultVisibleCategoryCountHorizontal = isGrouped
      ? Math.max(2, Math.floor(dataZoomMinHorizontal / valueColumns.length))
      : dataZoomMinHorizontal;
    try {
      if (horizontalBarDataZoom) {
        const initialEnd = Math.min(1, defaultVisibleCategoryCountHorizontal / data.length);
        const scrollbarY = am5.Scrollbar.new(root, { orientation: 'vertical' });
        chart.set('scrollbarY', scrollbarY);
        chart.rightAxesContainer.children.push(scrollbarY);
        try {
          scrollbarY.set('start', 0);
          scrollbarY.set('end', initialEnd);
        } catch (e) { }
      }
    } catch (e) { }

    const xRenderer = am5xy.AxisRendererX.new(root, {});
    try {
      const xRot = Number((mergedOpts && (mergedOpts as any).xAxisLabelRotation) ?? 0);
      xRenderer.labels.template.setAll({ fontSize: CHART_AXIS_TICK_FONT_SIZE, fontWeight: CHART_AXIS_TICK_FONT_WEIGHT, centerX: am5.p50, centerY: am5.p50, oversizedBehavior: 'truncate', maxWidth: categoryMargin, rotation: xRot, fill: foregroundColor });
    } catch (e) {
      xRenderer.labels.template.setAll({ fontSize: CHART_AXIS_TICK_FONT_SIZE, fontWeight: CHART_AXIS_TICK_FONT_WEIGHT, centerX: am5.p50, centerY: am5.p50, oversizedBehavior: 'truncate', maxWidth: categoryMargin, fill: foregroundColor });
    }

    try {
      xRenderer.labels.template.adapters.add('text', (text, target) => {
        try {
          if (!text || typeof text !== 'string') return '';
          const cleanedText = text.replace(/,/g, '').trim();
          if (!/[0-9]/.test(cleanedText)) return '';
          const numValue = parseFloat(cleanedText);
          if (isNaN(numValue)) return '';
          const numeric = formatWithDecimal(numValue);
          return _formatWithCurrency(numValue, numeric);
        } catch (e) {
          return '';
        }
      });
    } catch (e) { }

    const xAxis = chart.xAxes.push(
      am5xy.ValueAxis.new(root, {
        renderer: xRenderer,
        ...(logEnabledHoriz ? { logarithmic: true, ...(typeof treatZeroAsHoriz !== 'undefined' ? { treatZeroAs: treatZeroAsHoriz } : {}) } : {}),
      })
    );

    // Axis baselines + grids (muted-foreground reads clearly on light and dark card backgrounds)
    try {
      const minorEnabledH = Boolean((opts && typeof (opts as any).minorTicks !== 'undefined') ? (opts as any).minorTicks : options?.minorTicks);
      if (minorEnabledH) {
        xRenderer.grid.template.setAll({ stroke: gridLineStroke, strokeOpacity: 0.34, strokeDasharray: [2, 2] });
      } else {
        xRenderer.grid.template.setAll({ stroke: gridLineStroke, strokeOpacity: 0.42, strokeDasharray: [] });
      }
      yRenderer.grid.template.setAll({ stroke: gridLineStroke, strokeOpacity: 0.28 });
    } catch (e) { }
    try {
      (xRenderer as any).line.template.setAll({ stroke: gridLineStroke, strokeOpacity: 0.88, strokeWidth: 1 });
      (yRenderer as any).line.template.setAll({ stroke: gridLineStroke, strokeOpacity: 0.88, strokeWidth: 1 });
    } catch (e) { }

    const horizValueFields = resolveChartValueFields(
      data[0],
      columnsForTitle,
      xAxisColumn !== 'category' ? xAxisColumn : undefined,
    );
    if (drilldownCategory) {
      const drillTitle = (mergedOpts?.yAxisTitle || '').trim() || 'Total Value';
      attachBottomValueAxisTitle(chart, root, drillTitle, foregroundColor, mergedOpts?.yAxisTitleMargin ?? 6, logEnabledHoriz);
    } else {
      const valueTitle = resolveValueAxisTitle(mergedOpts?.yAxisTitle, metrics, horizValueFields);
      if (valueTitle || logEnabledHoriz) {
        attachBottomValueAxisTitle(chart, root, valueTitle, foregroundColor, mergedOpts?.yAxisTitleMargin ?? 6, logEnabledHoriz);
      }
    }

    if (logRequested && !logEnabledHoriz && numericValsHoriz.length > 0 && numericValsHoriz.some((v) => v < 0)) {
      try {
        const note = am5.Label.new(root, { text: 'Log scale disabled: negative values present', fontSize: 11, fill: am5.color(0x666666) });
        note.setAll({ paddingTop: 6, paddingBottom: 6, paddingLeft: 8, paddingRight: 8 });
        chart.children.push(note);
      } catch (e) { }
    }

    // Adjust chart padding for long category names — use top padding for horizontal layout
    chart.set('paddingTop', categoryMargin);

    // Ensure there is enough right padding so horizontal labels placed at the
    // end of bars have white space to render in. Estimate based on font and
    // longest formatted value in the data (capped to avoid huge padding).
    try {
      const configuredFont = (opts && (opts as any).fontSize) || options?.fontSize || 12;
      const maxLabelChars = Math.max(...data.map((d: any) => {
        try {
          if (!d) return 0;
          if (valueColumns && valueColumns.length > 1) {
            // Take the max length of any single column value, not the sum
            return Math.max(...valueColumns.map(c => String(formatWithDecimal(Number(d[c]) || 0)).length));
          }
          const preview = valueColumns && valueColumns.length ? String(formatWithDecimal(Number(d[valueColumns[0]]) || 0)) : '';
          return preview.length;
        } catch (e) { return 0; }
      }), 0);
      const estCharPx = Math.max(5, configuredFont * 0.45);
      const estimatedRightPad = Math.min(150, Math.max(10, Math.ceil(maxLabelChars * estCharPx)));
      chart.set('paddingRight', estimatedRightPad);
    } catch (e) { }

    // Fallback global tooltip: white background, black text to ensure consistency
    try {
      const globalTooltip = am5.Tooltip.new(root, { getFillFromSprite: false });
      try {
        const bg = globalTooltip.get('background');
        if (bg) bg.setAll({ fill: tooltipBg, strokeWidth: 0 });
        globalTooltip.label.setAll({ fill: tooltipFg, fontSize: 12 });
        try { globalTooltip.label.adapters.add('fill', () => tooltipFg); } catch (e) { }
      } catch (e) { }
      chart.set('tooltip', globalTooltip);
      chart.plotContainer.set('tooltip', globalTooltip);
    } catch (e) { }

    // Check if we have multiple value columns (grouped bar chart)

    // Fills use GROUPED_BAR_SHINE_PALETTES (am5MiniChartBar / am5MiniChartBarSingle)

    if (valueColumns.length > 1) {
      // Create multiple series for grouped bar chart — legend uses series (amCharts style), colors match bars
      const seriesList: any[] = [];
      let legend: any = null;
      const updateLegendForCategory = (category?: string) => {
        if (!legend) return;
        if (!category) {
          legend.data.setAll(seriesList);
          return;
        }
        const row = data.find((d: any) => d.category === category);
        const filtered = seriesList.filter((s: any) => {
          const name = s.get && s.get('name');
          if (!name || !row) return false;
          const v = row[name];
          return (Number(v) || 0) !== 0;
        });
        legend.data.setAll(filtered);
      };

      valueColumns.forEach((valueColumn, index) => {
        const series = chart.series.push(
          am5xy.ColumnSeries.new(root, {
            name: valueColumn,
            xAxis: xAxis,
            yAxis: yAxis,
            valueXField: valueColumn,
            categoryYField: 'category',
            stacked: isStacked,
            baseAxis: yAxis,
          })
        );

        const shinePaletteH = getShinePalette(index);
        const [, midHexH] = shinePaletteH;
        try {
          series.set('fill', am5.color(midHexH));
        } catch (e) { }
        try {
          series.columns.template.adapters.add('fillGradient', () =>
            barColumnShineGradient(root, shinePaletteH, 0),
          );
          series.columns.template.setAll({
            ...horizontalBarEndCornerRadius(isStacked, index, valueColumns.length),
            strokeWidth: 1,
            stroke: panelRing,
            strokeOpacity: 0.42,
            fillOpacity: 0.96,
            height: groupedBarHeightPx,
            cursorOverStyle: 'pointer',
          });

          const tt = am5.Tooltip.new(root, { getFillFromSprite: false, autoTextColor: false });
          try {
            const bg = tt.get('background');
            if (bg) bg.setAll({ fill: am5.color(midHexH), fillOpacity: 0.95, strokeWidth: 0 });
            tt.label.setAll({ fontSize: 12, textAlign: 'left' });
            attachSeriesLinkedTooltipContrast(tt, am5);
            primeSeriesLinkedTooltipFill(tt, am5.color(midHexH), am5);
          } catch (e) { }
          series.set('tooltip', tt);

          series.columns.template.events.on('pointerover', (ev) => {
            const col = ev.target;
            const visual = col.get('fillGradient') || col.get('fill') || am5.color(midHexH);
            primeSeriesLinkedTooltipFill(tt, visual, am5);
          });
        } catch (e) { }

        // Format tooltip with K/M/B
        series.columns.template.adapters.add('tooltipText', (text, target) => {
          if (target.dataItem) {
            const dataContext = target.dataItem.dataContext as any;
            if (dataContext && typeof dataContext[valueColumn] === 'number') {
              const formattedValue = formatNumber(dataContext[valueColumn], { format: 'short' });
              return `${dataContext.category || ''}: ${formattedValue}`;
            }
          }

          // Compute visible numeric domain from the filtered `data` and apply to X axis (horizontal case)
          try {
            const allVals: number[] = [];
            data.forEach((d: any) => {
              if (!d) return;
              Object.keys(d).forEach((k) => {
                if (k === 'category' || k === 'originalData') return;
                const v = d[k];
                if (typeof v === 'number' && isFinite(v)) allVals.push(v);
              });
            });
            if (allVals.length) {
              let minVal = Math.min(...allVals);
              let maxVal = Math.max(...allVals);

              const opt = (k: string) => {
                if (opts && typeof (opts as any)[k] !== 'undefined') return (opts as any)[k];
                if (options && typeof (options as any)[k] !== 'undefined') return (options as any)[k];
                return undefined;
              };
              const userTruncate = Boolean(opt('truncateAxis') || opt('truncateXAxis'));
              let rawMin = opt('axisMin');
              let rawMax = opt('axisMax');
              if ((rawMin === undefined || rawMin === '') && Boolean(opt('truncateXAxis'))) rawMin = opt('xAxisMin');
              if ((rawMax === undefined || rawMax === '') && Boolean(opt('truncateXAxis'))) rawMax = opt('xAxisMax');
              const parseBound = (v: any) => {
                if (v === null || typeof v === 'undefined' || v === '') return null;
                const n = Number(String(v));
                return Number.isFinite(n) ? n : null;
              };
              if (userTruncate) {
                const pMin = parseBound(rawMin);
                const pMax = parseBound(rawMax);
                if (pMin !== null && pMax !== null && pMin > pMax) {
                  const tmp = pMin;
                  minVal = pMax as number;
                  maxVal = tmp as number;
                } else {
                  if (pMin !== null) minVal = pMin;
                  if (pMax !== null) maxVal = pMax;
                }
              }

              if (logEnabledHoriz) {
                // Ensure minVal is positive for log axis
                if (minVal <= 0) minVal = (typeof treatZeroAsHoriz !== 'undefined') ? treatZeroAsHoriz! : Math.max(1e-9, Math.min(...allVals.filter(v => v > 0)));
              }
              {
                const padded = computePaddedValueAxisDomain(allVals, minVal, maxVal, logEnabledHoriz, userTruncate, rawMin, rawMax);
                minVal = padded.minVal;
                maxVal = padded.maxVal;
              }
              const explicitMaxBoundHorizTooltip = userTruncate && parseBound(rawMax) !== null;
              try {
                try { (xAxis as any).set('min', minVal); } catch (e) { }
                try { (xAxis as any).set('max', maxVal); } catch (e) { }
                try { (xAxis as any).set('extraMin', 0); } catch (e) { }
                try { (xAxis as any).set('extraMax', explicitMaxBoundHorizTooltip ? 0 : 0.08); } catch (e) { }
                const bothBounds = (userTruncate && parseBound(rawMin) !== null && parseBound(rawMax) !== null);
                try { (xAxis as any).set('strictMinMax', bothBounds); } catch (e) { }
                try { (xAxis as any).zoomToValues(minVal, maxVal); } catch (e) { }
                try { (xAxis as any).invalidate(); } catch (e) { }
                try { (chart as any).invalidateData && (chart as any).invalidateData(); } catch (e) { }
                try { (chart as any).validate && (chart as any).validate(); } catch (e) { }
              } catch (e) { }
            }
          } catch (e) { }
          return text || '';
        });

        series.data.setAll(data);
        seriesList.push(series);

        // Add stacking-aware data labels for grouped horizontal chart (single label per visible bar)
        try {
          const showLabels = Boolean((opts && typeof (opts as any).showValue !== 'undefined') ? (opts as any).showValue : options?.showValue);
          if (showLabels) {
            const lastIndex = valueColumns.length - 1;
            if (isStacked) {
              if (index === lastIndex) {
                series.bullets.push((root, series, dataItem) => {
                  const label = am5.Label.new(root, {
                    centerY: am5.p50,
                    centerX: am5.p0,
                    dx: 8,
                    fill: foregroundColor,
                    fontSize: (opts && (opts as any).fontSize) || options?.fontSize || 10,
                    textAlign: 'start',
                  });
                  try {
                    const ctx = (dataItem && (dataItem.dataContext as any)) || {};
                    const total = valueColumns.reduce((s, c) => s + (Number(ctx[c]) || 0), 0);
                    label.set('text', formatNumber(Number(total) || 0, { format: (opts && (opts as any).numberFormat) || options?.numberFormat || 'adaptive' }));
                  } catch (e) { }
                  return am5.Bullet.new(root, { sprite: label, locationX: 1 });
                });
              }
            } else {
              series.bullets.push((root, series, dataItem) => {
                const label = am5.Label.new(root, {
                  centerY: am5.p50,
                  centerX: am5.p0,
                  dx: 8,
                  fill: foregroundColor,
                  fontSize: (opts && (opts as any).fontSize) || options?.fontSize || 10,
                  textAlign: 'start',
                });
                try {
                  const ctx = (dataItem && (dataItem.dataContext as any)) || {};
                  const v = (ctx && ctx[valueColumn]) ?? (dataItem && (dataItem.get('valueX') as number)) ?? 0;
                  const numeric = formatWithDecimal(Number(v) || 0);
                  label.set('text', _formatWithCurrency(Number(v) || 0, numeric));
                } catch (e) { }
                return am5.Bullet.new(root, { sprite: label, locationX: 1 });
              });
            }
          }
        } catch (e) { }

        series.columns.template.events.on('click', (ev) => {
          const dataItem = ev.target.dataItem;
          if (dataItem && dataItem.dataContext) {
            const context = dataItem.dataContext as any;
            const cat = context.category;
            const orig = context.originalData ?? context;
            const candidateKeys = orig && typeof orig === 'object'
              ? Object.keys(orig).filter((k) => !!k && k !== 'value' && k !== 'category' && !k.includes('('))
              : [];
            const inferredField = candidateKeys.find((k) => k !== xAxisColumn && orig[k] !== undefined) ?? xAxisColumn;
            const inferredValue = (orig && inferredField && orig[inferredField] !== undefined) ? orig[inferredField] : cat;
            const drillFilters = [{ column: inferredField, value: inferredValue }];
            updateLegendForCategory(cat);
            // Do not auto-enter drilldown on click; only notify host
            if (onChartInteraction) onChartInteraction('category', inferredValue);
            try {
              if (typeof window !== 'undefined' && (window as any).dispatchEvent) {
                window.dispatchEvent(new CustomEvent('pieSliceInteraction', { detail: { value: inferredValue, originalData: orig, column: inferredField, drillFilters } }));
              }
            } catch (e) { /* ignore */ }
          }
        });

        series.appear();
      });

      // Add legend (only if enabled in options) — amCharts style: legend data = series, colors from bars
      try {
        const showLegend = Boolean((opts && typeof (opts as any).showLegend !== 'undefined') ? (opts as any).showLegend : options?.showLegend);
        const legendOrientationRaw = (opts && (opts as any).legendOrientation) || options?.legendOrientation || 'left';
        const legendOrientation = String(legendOrientationRaw || 'left').toLowerCase();
        if (showLegend && seriesList.length > 1) {
          const created = am5.Legend.new(root, {});
          try { created.setAll({ visible: true, opacity: 1 }); } catch (e) { }
          try { console.debug('BarChart: created grouped-horizontal legend', { legendOrientation, seriesCount: seriesList.length }); } catch (e) { }
          try {
            if (legendOrientation === 'left') {
              created.set('layout', am5.VerticalLayout.new(root, {}));
              try { root.container.children.push(created); } catch (e) { try { chart.leftAxesContainer.children.push(created); } catch (ee) { } }
              created.setAll({ centerY: am5.p0, y: 0, width: 200, paddingLeft: 8 });
              try {
                (created.markers.template as any).setAll({ width: 14, height: 14, cornerRadius: 6 });
                created.labels.template.setAll({ maxWidth: 140, oversizedBehavior: 'wrap', fontSize: 11, textAlign: 'left' });
                created.itemContainers.template.setAll({ paddingLeft: 8, paddingRight: 8 });
                try { chart.set('paddingLeft', Math.max((chart.get('paddingLeft') as number) || 0, 220)); } catch (e) { }
              } catch (e) { }
            } else if (legendOrientation === 'right') {
              created.set('layout', am5.VerticalLayout.new(root, {}));
              try { root.container.children.push(created); } catch (e) { try { chart.rightAxesContainer.children.push(created); } catch (ee) { } }
              created.setAll({ centerY: am5.p0, y: 0, centerX: am5.p100, x: am5.p100, width: 200, paddingRight: 8 });
              try {
                (created.markers.template as any).setAll({ width: 14, height: 14, cornerRadius: 6 });
                created.labels.template.setAll({ maxWidth: 140, oversizedBehavior: 'wrap', fontSize: 11, textAlign: 'left' });
                created.itemContainers.template.setAll({ paddingLeft: 8, paddingRight: 8 });
                try { chart.set('paddingRight', Math.max((chart.get('paddingRight') as number) || 0, 220)); } catch (e) { }
              } catch (e) { }
            } else if (legendOrientation === 'top') {
              created.set('layout', am5.HorizontalLayout.new(root, {}));
              try { chart.topAxesContainer.children.push(created); } catch (e) { chart.children.push(created); }
              created.setAll({ centerX: am5.p50, x: am5.p50, marginBottom: 12, width: am5.percent(100) });
            } else {
              created.set('layout', am5.HorizontalLayout.new(root, {}));
              try { chart.bottomAxesContainer.children.push(created); } catch (e) { chart.children.push(created); }
              created.setAll({ centerX: am5.p50, x: am5.p50, marginTop: 15, width: am5.percent(100) });
            }
          } catch (e) { }
          legend = created;
          try { legend.data.setAll(seriesList); } catch (e) { }
          try {
            (legend.markers.template as any).adapters.add('fill', (fill: any, target: any) => {
              try {
                const comp = target?.dataItem?.dataContext;
                if (comp && typeof comp.get === 'function') {
                  const sFill = comp.get('fill');
                  if (sFill) return sFill;
                }
              } catch (e) { }
              return fill;
            });
            (legend.markers.template as any).adapters.add('stroke', (st: any, target: any) => {
              try {
                const comp = target?.dataItem?.dataContext;
                if (comp && typeof comp.get === 'function') {
                  const sFill = comp.get('fill');
                  if (sFill) return sFill;
                }
              } catch (e) { }
              return st;
            });
          } catch (e) { }
          try { console.debug('BarChart: grouped-horizontal legend data set', legend.data && legend.data.length); } catch (e) { }
          try { chart.plotContainer.events.on('click', () => { legend.data.setAll(seriesList); setDrilldownCategory(null); }); } catch (e) { }
          try { legend.labels.template.setAll({ fontSize: 11, fontWeight: '500', fill: foregroundColor }); } catch (e) { }
          try { legend.labels.template.set('text', '{name}'); } catch (e) { }
          try { legend.markers.template.setAll({ width: 10, height: 10 }); } catch (e) { }

          if (legend) {
            try {
              legend.set('visible', false);
              legend.set('opacity', 0);
              try {
                legend.set('forceHidden', true);
              } catch (e) { }
              try {
                legend.set('height', 0);
              } catch (e) { }
            } catch (e) { }
            setBarDomLegend(
              seriesList.map((s: any, index: number) => {
                const pal = getShinePalette(index);
                const midHex = pal[1];
                return {
                  id: String(s.get?.('name') ?? index),
                  line: String(s.get?.('name') ?? ''),
                  color: am5ColorToCssHex(s.get?.('fill'), midHex),
                };
              }),
            );
          }
        }
      } catch (e) { }
    } else {
      // Single series bar chart
      const valueField = valueColumns[0] || 'value';
      const series = chart.series.push(
        am5xy.ColumnSeries.new(root, {
          name: valueField,
          xAxis: xAxis,
          yAxis: yAxis,
          valueXField: valueField,
          categoryYField: 'category',
          stacked: isStacked,
          baseAxis: yAxis,
        })
      );

      try {
        const defaultPaletteH = getShinePalette(0);
        const [, defaultMidH] = defaultPaletteH;
        series.set('fill', am5.color(defaultMidH));
        series.columns.template.adapters.add('fillGradient', (_g, target) => {
          const ctxRow = target.dataItem?.dataContext as { category?: string } | undefined;
          const cat = String(ctxRow?.category ?? '');
          let idx = data.findIndex((row: any) => String(row.category) === cat);
          if (idx < 0) idx = 0;
          const pal = getShinePalette(idx);
          return barColumnShineGradient(root, pal, 0);
        });
        series.columns.template.setAll({
          ...horizontalBarEndCornerRadius(isStacked, 0, 1),
          strokeWidth: 1,
          stroke: panelRing,
          strokeOpacity: 0.42,
          fillOpacity: 0.96,
          height: singleBarHeightPx,
          cursorOverStyle: 'pointer',
        });
        const tt = am5.Tooltip.new(root, { getFillFromSprite: false, autoTextColor: false });
        try {
          const bg = tt.get('background');
          if (bg) bg.setAll({ fill: am5.color(defaultMidH), fillOpacity: 0.95, strokeWidth: 0 });
          tt.label.setAll({ fontSize: 12, textAlign: 'left' });
          attachSeriesLinkedTooltipContrast(tt, am5);
          primeSeriesLinkedTooltipFill(tt, am5.color(defaultMidH), am5);
        } catch (e) { }
        series.set('tooltip', tt);

        series.columns.template.events.on('pointerover', (ev) => {
          const col = ev.target;
          const visual = col.get('fillGradient') || col.get('fill') || am5.color(defaultMidH);
          primeSeriesLinkedTooltipFill(tt, visual, am5);
        });
      } catch (e) { }

      // Format tooltip with K/M/B
      series.columns.template.adapters.add('tooltipText', (text, target) => {
        if (target.dataItem) {
          const dataContext = target.dataItem.dataContext as any;
          if (dataContext && typeof dataContext[valueField] === 'number') {
            const formattedValue = formatNumber(dataContext[valueField], { format: 'short' });
            return `${dataContext.category || ''}: ${formattedValue}`;
          }
        }
        return text || '';
      });

      series.data.setAll(data);

      // Add formatted data labels for single-series horizontal chart
      try {
        const showLabels = Boolean((opts && typeof (opts as any).showValue !== 'undefined') ? (opts as any).showValue : options?.showValue);
        if (showLabels) {
          series.bullets.push((root, series, dataItem) => {
            const label = am5.Label.new(root, {
              centerY: am5.p50,
              centerX: am5.p0,
              dx: 8,
              fill: foregroundColor,
              fontSize: (opts && (opts as any).fontSize) || options?.fontSize || 8,
              textAlign: 'start',
            });
            try {
              const ctx = (dataItem && (dataItem.dataContext as any)) || {};
              const v = (ctx && ctx[valueField]) ?? (dataItem && (dataItem.get('valueX') as number)) ?? 0;
              const numeric = formatWithDecimal(Number(v) || 0);
              label.set('text', _formatWithCurrency(Number(v) || 0, numeric));
            } catch (e) { }
            return am5.Bullet.new(root, { sprite: label, locationX: 1 });
          });
        }
      } catch (e) { }

      series.columns.template.events.on('click', (ev) => {
        const dataItem = ev.target.dataItem;
        if (dataItem && dataItem.dataContext) {
          const context = dataItem.dataContext as any;
          const orig = context.originalData ?? context;
          const cat = context.category;
          const candidateKeys = orig && typeof orig === 'object'
            ? Object.keys(orig).filter((k) => !!k && k !== 'value' && k !== 'category' && !k.includes('('))
            : [];
          const inferredField = candidateKeys.find((k) => k !== xAxisColumn && orig[k] !== undefined) ?? xAxisColumn;
          const inferredValue = (orig && inferredField && orig[inferredField] !== undefined) ? orig[inferredField] : cat;
          const drillFilters = [{ column: inferredField, value: inferredValue }];
          if (onChartInteraction) onChartInteraction('category', inferredValue);
          try {
            if (typeof window !== 'undefined' && (window as any).dispatchEvent) {
              window.dispatchEvent(new CustomEvent('pieSliceInteraction', { detail: { value: inferredValue, originalData: orig, column: inferredField, drillFilters } }));
            }
          } catch (e) { /* ignore */ }
        }
      });

      series.appear();
    }

    // Compute visible numeric domain from the filtered `data` and apply to X axis (horizontal case)
    try {
      const allValsX: number[] = [];
      data.forEach((d: any) => {
        if (!d) return;
        Object.keys(d).forEach((k) => {
          if (k === 'category' || k === 'originalData') return;
          const v = d[k];
          if (typeof v === 'number' && isFinite(v)) allValsX.push(v);
        });
      });
      if (allValsX.length) {
        let minValX = Math.min(...allValsX);
        let maxValX = Math.max(...allValsX);

        // Respect user-requested truncation for the value (X) axis in horizontal charts
        const opt = (k: string) => {
          if (opts && typeof (opts as any)[k] !== 'undefined') return (opts as any)[k];
          if (options && typeof (options as any)[k] !== 'undefined') return (options as any)[k];
          return undefined;
        };
        const userTruncate = Boolean(opt('truncateAxis') || opt('truncateXAxis'));
        let rawMin = opt('axisMin');
        let rawMax = opt('axisMax');
        if ((rawMin === undefined || rawMin === '') && Boolean(opt('truncateXAxis'))) rawMin = opt('xAxisMin');
        if ((rawMax === undefined || rawMax === '') && Boolean(opt('truncateXAxis'))) rawMax = opt('xAxisMax');

        const parseBound = (v: any) => {
          if (v === null || typeof v === 'undefined' || v === '') return null;
          const n = Number(String(v));
          return Number.isFinite(n) ? n : null;
        };

        if (userTruncate) {
          const pMin = parseBound(rawMin);
          const pMax = parseBound(rawMax);
          if (pMin !== null && pMax !== null && pMin > pMax) {
            const tmp = pMin;
            minValX = pMax as number;
            maxValX = tmp as number;
          } else {
            if (pMin !== null) minValX = pMin;
            if (pMax !== null) maxValX = pMax;
          }
        }

        if (logEnabledHoriz) {
          if (minValX <= 0) minValX = (typeof treatZeroAsHoriz !== 'undefined') ? treatZeroAsHoriz! : Math.max(1e-9, Math.min(...allValsX.filter(v => v > 0)));
        }

        {
          const padded = computePaddedValueAxisDomain(allValsX, minValX, maxValX, logEnabledHoriz, userTruncate, rawMin, rawMax);
          minValX = padded.minVal;
          maxValX = padded.maxVal;
        }

        const explicitMaxBoundHoriz = userTruncate && parseBound(rawMax) !== null;
        try {
          try { (xAxis as any).set('min', minValX); } catch (e) { }
          try { (xAxis as any).set('max', maxValX); } catch (e) { }
          try { (xAxis as any).set('extraMin', 0); } catch (e) { }
          try { (xAxis as any).set('extraMax', explicitMaxBoundHoriz ? 0 : 0.08); } catch (e) { }
          const bothBounds = (userTruncate && parseBound(rawMin) !== null && parseBound(rawMax) !== null);
          try { (xAxis as any).set('strictMinMax', bothBounds); } catch (e) { }
          try { (xAxis as any).zoomToValues(minValX, maxValX); } catch (e) { }
          try { (xAxis as any).invalidate(); } catch (e) { }
          try { (chart as any).invalidateData && (chart as any).invalidateData(); } catch (e) { }
          try { (chart as any).validate && (chart as any).validate(); } catch (e) { }
        } catch (e) { }
      }
    } catch (e) { }

    if (horizontalBarDataZoom) {
      const mergedForTruncate = { ...(options ?? {}), ...(opts ?? {}) } as Record<string, unknown>;
      const truncateOpts = resolveChartAxisTruncateOptions(mergedForTruncate);
      attachChartScrollbarYRangeSync(root, chart, yAxis, xAxis, {
        rows: data,
        valueKeys: horizValueFields,
        categoryOnYAxis: true,
        logEnabled: logEnabledHoriz,
        treatZeroAs: treatZeroAsHoriz,
        userTruncate: truncateOpts.userTruncate,
        rawMin: truncateOpts.rawMin,
        rawMax: truncateOpts.rawMax,
        skipWhenBothBoundsFixed: truncateOpts.bothBoundsFixed,
        afterCategoryZoom: () => {
          try {
            (yAxis as any).zoomToIndexes?.(
              0,
              Math.min(defaultVisibleCategoryCountHorizontal - 1, data.length - 1),
            );
          } catch (e) { }
        },
      });
    }

    if (!drilldownCategory) {
      const categoryAxisTitle = resolveCategoryAxisTitle(mergedOpts?.xAxisTitle, xAxisColumn);
      attachLeftCategoryAxisTitle(
        chart,
        root,
        categoryAxisTitle,
        foregroundColor,
        mergedOpts?.xAxisTitleMargin ?? 8,
        categoryMargin,
      );
      try {
        yRenderer.labels.template.setAll({ marginLeft: 6 });
      } catch (e) { }
    }

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
    // expose in-place chart controls for zooming updates
    try {
      chartStateRef.current = {
        chart,
        xAxis,
        yAxis,
        series: (chart.series as any)?.values || [],
        legend: (chart.children as any)?.find?.((c: any) => c && typeof c.data !== 'undefined') || null,
      };
    } catch (e) { }
  };

  const legendOrientation = String((options && (options as any).legendOrientation) || 'bottom').toLowerCase();

  return (
    <div className={`relative flex h-full w-full min-h-0 ${legendOrientation === 'left' ? 'flex-row-reverse' :
      legendOrientation === 'right' ? 'flex-row' :
        legendOrientation === 'top' ? 'flex-col-reverse' :
          'flex-col'
      } max-w-full overflow-hidden`}>
      <div className="relative min-h-0 flex-1 w-full max-w-full overflow-hidden">
        <div className="absolute top-2 right-2 z-20 flex items-center gap-1 pr-22">
          <Label htmlFor="bar-orientation" className="text-xs font-medium text-foreground">
            Vertical
          </Label>
          <Switch
            id="bar-orientation"
            checked={barOrientation === 'horizontal'}
            onCheckedChange={(checked) => {
              const orient = checked ? 'horizontal' : 'vertical';
              setBarOrientation(orient);
              const nextOptions = { ...options, horizontal: checked };
              setOptions(nextOptions);
              if (typeof window !== 'undefined') {
                (window as any).__chartCustomizationOptions = nextOptions;
                window.dispatchEvent(new CustomEvent('chartCustomizationChanged', { detail: nextOptions }));
              }
            }}
            className="
              h-4 w-7 data-[state=checked]:bg-primary data-[state=unchecked]:bg-muted [&>span]:h-3 [&>span]:w-3 [&>span]:translate-x-0.5 data-[state=checked]:[&>span]:translate-x-3 "
          />
          <Label htmlFor="bar-orientation" className="text-xs font-medium text-foreground">
            Horizontal
          </Label>
        </div>
        {isScorecard ? (
          <div className="h-full w-full overflow-y-auto pr-2 pt-8">
            <div className="flex h-auto min-h-0 min-w-0 w-full flex-col overflow-visible text-foreground p-1.5 gap-1.5">
              <div className="flex min-h-0 min-w-0 flex-col gap-1.5 lg:flex-row lg:items-stretch lg:gap-2">
                <aside className="flex shrink-0 flex-col justify-between gap-1.5 rounded-lg border border-border/60 bg-background/35 dark:bg-background/25 w-full p-2.5 lg:w-60 lg:max-w-none lg:min-h-0 lg:self-stretch">
                  <div className="space-y-0.5">
                    <p className="font-semibold leading-tight text-base">{tableName}</p>
                    <p className="bg-gradient-to-r from-indigo-700 via-violet-700 to-cyan-800 bg-clip-text font-semibold tabular-nums tracking-tight text-transparent dark:from-indigo-500 dark:via-violet-500 dark:to-cyan-600 text-4xl">
                      {formatScore(trustMain)}
                    </p>
                    <p className="text-muted-foreground leading-snug text-xs">
                      Overall trust score across completeness, validity, referential integrity, freshness, and duplicate risk.
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {rowCount != null ? (
                      <Badge variant="outline" className="gap-1 rounded-full border-border/60 font-medium tabular-nums text-foreground text-xs">
                        <Rows3 className="size-3 shrink-0 text-muted-foreground" aria-hidden />
                        {formatCount(rowCount)} Rows
                      </Badge>
                    ) : null}
                    {columnCount != null ? (
                      <Badge variant="outline" className="gap-1 rounded-full border-border/60 font-medium tabular-nums text-foreground text-xs">
                        <Columns3 className="size-3 shrink-0 text-muted-foreground" aria-hidden />
                        {formatCount(columnCount)} Columns
                      </Badge>
                    ) : null}
                    <Badge variant="outline" className="gap-1 rounded-full border-border/60 font-medium tabular-nums text-foreground text-xs">
                      <CircleAlert className="size-3 shrink-0 text-muted-foreground" aria-hidden />
                      {formatCount(critical)} Critical
                    </Badge>
                    <Badge variant="outline" className="gap-1 rounded-full border-border/60 font-medium tabular-nums text-foreground text-xs">
                      <AlertTriangle className="size-3 shrink-0 text-muted-foreground" aria-hidden />
                      {formatCount(warnings)} {warnings === 1 ? "Warning" : "Warnings"}
                    </Badge>
                  </div>
                </aside>

                <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-1.5">
                  {bars.map(({ field, label, value }) => {
                    const widthPct = Math.min(100, Math.max(0, value));
                    return (
                      <div
                        key={field}
                        onClick={() => onChartInteraction?.(field, value)}
                        className={cn(
                          "grid min-w-0 items-center rounded-md bg-background/40 py-1.5 dark:bg-background/30 grid-cols-[7.5rem_1fr_minmax(7.5rem,max-content)] gap-x-3 px-1.5 cursor-pointer hover:bg-accent/10"
                        )}
                      >
                        <span className="min-w-0 truncate text-left font-semibold text-foreground/90 text-xs" title={label}>
                          {label}
                        </span>
                        <div className="min-h-0 min-w-0 w-full overflow-hidden rounded-full ring-1 ring-inset ring-black/[0.04] dark:ring-white/[0.06] h-2.5" style={scorecardBarTrackStyle(field, value)}>
                          <div
                            className="h-full rounded-full transition-[width] duration-500 ease-out"
                            style={{
                              width: `${widthPct}%`,
                              ...scorecardBarFillStyle(field, value),
                            }}
                          />
                        </div>
                        <span className="min-w-0 justify-self-end text-right tabular-nums font-semibold text-foreground text-xs">
                          {formatScore(value)}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        ) : isHorizontalSingle ? (
          <div className="h-full w-full overflow-y-auto pr-2 pt-8">
            <div className="flex h-auto min-h-0 min-w-0 w-full flex-col overflow-visible text-foreground p-1.5 gap-1.5">
              <div className="flex min-h-0 min-w-0 flex-col gap-1.5">
                {displayData.map((d: any, idx) => {
                  const category = d.category || '';
                  const value = Number(d[valueField]) || 0;
                  const widthPct = maxVal > 0 ? Math.min(100, Math.max(0, (value / maxVal) * 100)) : 0;
                  const { fillStyle, trackStyle } = getCustomBarStyles(idx);
                  return (
                    <div
                      key={category}
                      onClick={() => emitCategoryRowInteraction(d)}
                      className={cn(
                        "grid min-w-0 items-center rounded-md bg-background/40 py-1.5 dark:bg-background/30 grid-cols-[7.5rem_1fr_minmax(7.5rem,max-content)] gap-x-3 px-1.5 cursor-pointer hover:bg-accent/10"
                      )}
                    >
                      <span className="min-w-0 truncate text-left font-semibold text-foreground/90 text-xs" title={category}>
                        {category}
                      </span>
                      <div className="min-h-0 min-w-0 w-full overflow-hidden rounded-full ring-1 ring-inset ring-black/[0.04] dark:ring-white/[0.06] h-2.5" style={trackStyle}>
                        <div
                          className="h-full rounded-full transition-[width] duration-500 ease-out"
                          style={{
                            width: `${widthPct}%`,
                            ...fillStyle,
                          }}
                        />
                      </div>
                      <span className="min-w-0 justify-self-end text-right tabular-nums font-semibold text-foreground text-xs">
                        {formatScore(value)}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        ) : (
          <div ref={chartRef} className="h-full w-full" />
        )}
      </div>
      <ChartDomScrollLegend
        visible={barDomLegend.length > 0 && !isScorecard && !isHorizontalSingle}
        items={barDomLegend}
        orientation={legendOrientation as any}
      />
    </div>
  );
}

