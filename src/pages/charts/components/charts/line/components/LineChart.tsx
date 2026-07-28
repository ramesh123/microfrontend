import { useEffect, useRef, useMemo, useState } from 'react';
import * as am5 from '@amcharts/amcharts5';
import * as am5xy from '@amcharts/amcharts5/xy';
import am5themes_Animated from '@amcharts/amcharts5/themes/Animated';
import { formatNumber } from '@/utils/numberFormatters';
import { computePaddedValueAxisDomain } from '@/utils/chartValueAxisDomain';
import { createShinePaletteFromBase } from '@/pages/ExploratoryAnalysis/AgenticSemantics/am5MiniChartConstants';
import {
  neatChartHexAtIndex,
  shineLinearGradient,
  shineRadialGradient,
} from '@/pages/ExploratoryAnalysis/AgenticSemantics/am5MiniChartHelpers';
import { createSeriesLinkedTooltipWithText, primeSeriesLinkedTooltipFill } from '@/pages/ExploratoryAnalysis/AgenticSemantics/am5MiniChartTooltip';
import type { LineCustomizationOptions } from '../customize/lineCustomizeTypes';
import { defaultOptions as lineDefaultOptions } from '../customize/lineCustomizeTypes';
import { resolveCartesianCurveStyle } from '../../cartesian/customize/cartesianCurveStyleUi';
import {
  DEFAULT_LINE_THICKNESS,
  resolveLineThickness,
} from '../../cartesian/customize/cartesianLineThicknessUi';
import { colorSchemes } from '../../pie';
import { useTheme } from '@/context/theme';
import { applyAm5InterfaceTheme, probeAmChartThemeColors } from '../../amChartThemeColors';
import { ChartDomScrollLegend, type ChartDomScrollLegendItem } from '../../ChartDomScrollLegend';
import {
  attachBottomCategoryAxisTitle,
  attachLeftValueAxisTitle,
  resolveCategoryAxisTitle,
  resolveValueAxisTitle,
  resolveChartValueFields,
  type ChartMetricParam,
} from '../../chartAxisTitleUtils';
import {
  attachChartScrollbarYRangeSync,
  resolveChartAxisTruncateOptions,
  resolveDataZoomMin,
} from '../../chartScrollbarYAxisSync';

interface LineChartProps {
  data: Array<{ category: string; value: number; originalData: any }> | any[];
  onChartInteraction?: (field: string, value: any, originalData?: any, eventDimensionFields?: string[], eventDrillFilters?: Array<{ column: string; value: any }>) => void;
  columns?: string[];
  x_axis?: string;
  metrics?: ChartMetricParam[];
  customizationOptions?: Partial<LineCustomizationOptions> | null;
}

export function LineChart({ data, onChartInteraction, columns, x_axis, metrics: metricsProp = [], customizationOptions }: LineChartProps) {
  const { theme } = useTheme();
  const chartRef = useRef<HTMLDivElement>(null);
  const rootRef = useRef<am5.Root | null>(null);
  const [lineDomLegend, setLineDomLegend] = useState<ChartDomScrollLegendItem[]>([]);
  const [options, setOptions] = useState<Partial<LineCustomizationOptions>>(() => {
    if (customizationOptions) return customizationOptions as any;
    if (typeof window !== 'undefined') return (window as any).__chartCustomizationOptions || lineDefaultOptions;
    return lineDefaultOptions as any;
  });

  // Keep options in sync with prop or window events
  useEffect(() => {
    if (customizationOptions) {
      setOptions(customizationOptions as any);
      return;
    }
    if (typeof window === 'undefined') return;
    const winOpts = (window as any).__chartCustomizationOptions;
    if (winOpts) setOptions(winOpts);
    const handler = (e: any) => {
      try { setOptions(e?.detail || (window as any).__chartCustomizationOptions || {}); } catch (err) {}
    };
    window.addEventListener('chartCustomizationChanged', handler);
    return () => { window.removeEventListener('chartCustomizationChanged', handler); };
  }, [customizationOptions]);

  // Transform data to chart format
  const { chartData, seriesFields, categoryField } = useMemo(() => {
    // Check if we have multi-series data (columns and x_axis provided)
    if (columns && columns.length > 1 && x_axis && Array.isArray(data)) {
      const xAxisField = x_axis;
      const valueColumns = columns.filter(col => col !== xAxisField);
      
      if (valueColumns.length === 0) {
        return { chartData: [], seriesFields: [], categoryField: 'category' };
      }
      
      // Transform data to include all series fields
      const transformedData = data.map((item) => {
        const result: any = { [xAxisField]: String(item[xAxisField] || '') };
        valueColumns.forEach(col => {
          result[col] = Number(item[col]) || 0;
        });
        result.originalData = item;
        return result;
      });
      
      return {
        chartData: transformedData,
        seriesFields: valueColumns,
        categoryField: xAxisField,
      };
    }
    
    // Legacy single-series format
    if (Array.isArray(data) && data.length > 0 && 'category' in data[0]) {
      return {
        chartData: data,
        seriesFields: ['value'],
        categoryField: 'category',
      };
    }
    
    return { chartData: [], seriesFields: [], categoryField: 'category' };
  }, [data, columns, x_axis]);

  // Allow sorting of series (dimensions) according to customization options
  const sortedSeriesFields = useMemo(() => {
    try {
      const sf = Array.isArray(seriesFields) ? seriesFields.slice() : [];
      const mode = (options && (options as any).sortSeriesBy) || 'none';
      const asc = Boolean((options && (options as any).sortSeriesAscending));
      if (mode === 'total_value') {
        const totals: Record<string, number> = {};
        sf.forEach((f) => { totals[f] = chartData.reduce((s: number, r: any) => s + (Number(r[f]) || 0), 0); });
        sf.sort((a, b) => {
          const ta = totals[a] || 0;
          const tb = totals[b] || 0;
          if (ta !== tb) return asc ? ta - tb : tb - ta;
          return String(a || '').localeCompare(String(b || ''));
        });
      } else if (mode === 'name') {
        sf.sort((a, b) => {
          const cmp = String(a || '').localeCompare(String(b || ''));
          return asc ? cmp : -cmp;
        });
      }
      return sf;
    } catch (e) { return seriesFields; }
  }, [seriesFields, chartData, options?.sortSeriesBy, options?.sortSeriesAscending]);

  useEffect(() => {
    if (rootRef.current) {
      try {
        rootRef.current.dispose();
      } catch {
        /* ignore */
      }
      rootRef.current = null;
    }
    setLineDomLegend([]);

    if (!chartRef.current || !chartData || chartData.length === 0) return;

    const chartTheme = probeAmChartThemeColors();
    const foregroundColor = chartTheme.cardForeground;
    const gridLineStroke = chartTheme.muted;
    const valueLabelBg = chartTheme.card;

    const colorSchemeKey = options?.colorScheme || 'agentic-base';
    const activeScheme = colorSchemes.find((s) => s.value === colorSchemeKey) || colorSchemes[0];
    const activeColors = activeScheme ? activeScheme.colors : [];

    const getSchemeColor = (idx: number) => {
      if (activeColors && activeColors.length > 0) {
        return activeColors[idx % activeColors.length];
      }
      return neatChartHexAtIndex(idx);
    };

    // Create root element
    const root = am5.Root.new(chartRef.current);
    root.setThemes([am5themes_Animated.new(root)]);
    root.autoResize = true;
    rootRef.current = root;
    applyAm5InterfaceTheme(root, chartTheme);

    // Hide amCharts logo
    root._logo?.dispose();

    // Determine legend placement early
    const showLegend =
      sortedSeriesFields.length > 1 &&
      Boolean((options && typeof options.showLegend !== 'undefined') ? options.showLegend : true);
    const legendOrientationRaw = (options && (options as any).legendOrientation) || 'bottom';
    const legendOrientation = String(legendOrientationRaw || 'bottom').toLowerCase();

    const chart = root.container.children.push(
      am5xy.XYChart.new(root, {
        panX: true,
        panY: true,
        wheelX: 'panX',
        wheelY: 'panX',
        layout: root.verticalLayout,
      })
    );

    // Create axes
    const xRenderer = am5xy.AxisRendererX.new(root, { minGridDistance: 30 });
    try {
      const xRot = Number((options as any)?.xAxisLabelRotation ?? 0);
      const xAxisFontSize = Number((options && (options as any).xAxisFontSize) ?? (options && (options as any).fontSize) ?? 9);
      const xAxisVisible = !isNaN(xAxisFontSize) && Number(xAxisFontSize) > 0;
      xRenderer.labels.template.setAll({ fontSize: xAxisFontSize, rotation: xRot, fill: foregroundColor, visible: xAxisVisible });
    } catch (e) {
      const xAxisFontSize = Number((options && (options as any).xAxisFontSize) ?? (options && (options as any).fontSize) ?? 9);
      const xAxisVisible = !isNaN(xAxisFontSize) && Number(xAxisFontSize) > 0;
      xRenderer.labels.template.setAll({ fontSize: xAxisFontSize, fill: foregroundColor, visible: xAxisVisible });
    }

    const xAxis = chart.xAxes.push(
      am5xy.CategoryAxis.new(root, {
        categoryField: categoryField,
        renderer: xRenderer,
      })
    );

    // Apply truncate X axis option if requested
    let effectiveChartData = chartData;
    try {
      if (options?.truncateXAxis) {
        const minRaw = options?.xAxisMin ?? '';
        const maxRaw = options?.xAxisMax ?? '';
        const findIndexFor = (val: string) => {
          if (!val && val !== '0') return -1;
          const asNum = parseInt(String(val), 10);
          if (!isNaN(asNum)) return asNum;
          const idx = chartData.findIndex((d: any) => String(d[categoryField]) === String(val));
          return idx;
        };
        const minIdx = Math.max(0, findIndexFor(String(minRaw)));
        const maxIdxRaw = findIndexFor(String(maxRaw));
        const maxIdx = maxIdxRaw >= 0 ? Math.min(chartData.length - 1, maxIdxRaw) : Math.max(chartData.length - 1, minIdx);
        if (chartData && chartData.length && minIdx <= maxIdx) {
          effectiveChartData = chartData.slice(minIdx, maxIdx + 1);
        }
      }
    } catch (e) {}

    xAxis.data.setAll(effectiveChartData);

    // Determine log axis capability and settings
    const numericVals: number[] = [];
    try {
      effectiveChartData.forEach((d: any) => {
        if (!d) return;
        Object.keys(d).forEach((k) => {
          if (k === categoryField || k === 'originalData') return;
          const v = d[k];
          if (typeof v === 'number' && isFinite(v)) numericVals.push(v);
        });
      });
    } catch (e) {}

    const logRequested = Boolean(options?.logarithmicAxis);
    const hasNegative = numericVals.some((v) => v < 0);
    const hasZero = numericVals.some((v) => v === 0);
    const minPositive = numericVals.filter((v) => v > 0).reduce((acc, v) => Math.min(acc, v), Number.POSITIVE_INFINITY);
    const canUseLog = !hasNegative && numericVals.length > 0 && numericVals.some((v) => v > 0);
    const logEnabled = logRequested && canUseLog;
    const treatZeroAs = (logEnabled && hasZero) ? (isFinite(minPositive) ? Math.max(minPositive / 100, 1e-9) : 1e-9) : undefined;

    const yRenderer = am5xy.AxisRendererY.new(root, {});
    try {
      const yRot = Number((options as any)?.yAxisLabelRotation ?? 0);
      const yAxisFontSize = Number((options && (options as any).yAxisFontSize) ?? (options && (options as any).fontSize) ?? 11);
      const yAxisVisible = !isNaN(yAxisFontSize) && Number(yAxisFontSize) > 0;
      yRenderer.labels.template.setAll({ fontSize: yAxisFontSize, rotation: yRot, fill: foregroundColor, visible: yAxisVisible });
    } catch (e) {
      const yAxisFontSize = Number((options && (options as any).yAxisFontSize) ?? (options && (options as any).fontSize) ?? 11);
      const yAxisVisible = !isNaN(yAxisFontSize) && Number(yAxisFontSize) > 0;
      yRenderer.labels.template.setAll({ fontSize: yAxisFontSize, fill: foregroundColor, visible: yAxisVisible });
    }

    // Format Y-axis labels with selected number format
    const rawNf = options?.numberFormat as string | undefined;
    const _currencyFmt = (options && (options as any).currencyFormat) || '';
    const _currencySym = (options && (options as any).currencySymbol) || '';
    const _currencyCode = (options && (options as any).currencyCode) || '';
    let _resolvedSymbol = _currencySym;
    if (!_resolvedSymbol && _currencyCode) {
      const map: Record<string, string> = { USD: '$', EUR: '€', GBP: '£', INR: '₹' };
      _resolvedSymbol = map[_currencyCode] || '';
    }

    const applyNumberFormat = (val: number) => {
      const nfRaw = rawNf || 'short';
      // produce raw numeric string according to nfRaw
      let numericString: string;
      if (nfRaw === 'short' || nfRaw === 'adaptive') numericString = formatNumber(val, { format: 'short' });
      else if (nfRaw === 'full' || nfRaw === 'raw' || nfRaw === 'decimal') numericString = formatNumber(val, { format: 'full' });
      else if (nfRaw === 'percent') {
        const abs = Math.abs(val);
        const pct = abs <= 1 ? (val * 100) : val;
        const formatted = pct % 1 === 0 ? String(Math.round(pct)) : pct.toFixed(2).replace(/\.0+$/, '');
        numericString = `${formatted}%`;
      } else {
        numericString = formatNumber(val, { format: 'short' });
      }
      // Apply currency formatting if requested
      try {
        const currencyFmt = (_currencyFmt || '') as string;
        const currencyCode = (_currencyCode || '') as string;
        if ((currencyFmt || '') === 'none' || !_resolvedSymbol) return numericString;

        // When number format is 'full' prefer Intl for currency rendering
        if ((nfRaw === 'full' || nfRaw === 'raw' || nfRaw === 'decimal') && currencyCode) {
          try {
            const localeMap: Record<string, string> = { 'USD': 'en-US', 'EUR': 'de-DE', 'GBP': 'en-GB', 'INR': 'en-IN' };
            const locale = localeMap[currencyCode] || 'en-US';
            return new Intl.NumberFormat(locale, { style: 'currency', currency: currencyCode || 'USD', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(val);
          } catch (e) {
            // fallthrough to prefix/suffix
          }
        }

        if (currencyFmt === 'prefix') return `${_resolvedSymbol} ${numericString}`;
        if (currencyFmt === 'suffix') return `${numericString} ${_resolvedSymbol}`;
      } catch (e) {}

      return numericString;
    };

    yRenderer.labels.template.adapters.add('text', (text, target) => {
      if (text && typeof text === 'string') {
        const cleanedText = text.replace(/,/g, '').trim();
        const numMatch = cleanedText.match(/^[\d.-]+$/);
        if (numMatch) {
          const numValue = parseFloat(numMatch[0]);
          if (!isNaN(numValue)) {
            return applyNumberFormat(numValue);
          }
        }
      }
      return text || '';
    });

    const yAxis = chart.yAxes.push(am5xy.ValueAxis.new(root, { renderer: yRenderer, ...(logEnabled ? { logarithmic: true, ...(typeof treatZeroAs !== 'undefined' ? { treatZeroAs } : {}) } : {}) }));

    // Minor ticks: when enabled, make grid denser and use a light dashed style for extra lines
    try {
      const minorEnabled = Boolean((options && typeof (options as any).minorTicks !== 'undefined') ? (options as any).minorTicks : false);
      if (minorEnabled) {
        yRenderer.setAll({ minGridDistance: 20 });
        yRenderer.grid.template.setAll({ stroke: gridLineStroke, strokeOpacity: 0.32, strokeDasharray: [2, 2] });
      } else {
        yRenderer.setAll({ minGridDistance: 50 });
        yRenderer.grid.template.setAll({ stroke: gridLineStroke, strokeOpacity: 0.4, strokeDasharray: [] });
      }
    } catch (e) {}
    try {
      xRenderer.grid.template.setAll({ stroke: gridLineStroke, strokeOpacity: 0.26 });
    } catch (e) {}
    try {
      (xRenderer as any).line.template.setAll({ stroke: gridLineStroke, strokeOpacity: 0.88, strokeWidth: 1 });
      (yRenderer as any).line.template.setAll({ stroke: gridLineStroke, strokeOpacity: 0.88, strokeWidth: 1 });
    } catch (e) {}

    // Compute visible numeric domain from the filtered `effectiveChartData` and apply to Y axis
    try {
      const allVals: number[] = [];
      effectiveChartData.forEach((d: any) => {
        if (!d) return;
        Object.keys(d).forEach((k) => {
          if (k === categoryField || k === 'originalData') return;
          const v = d[k];
          if (typeof v === 'number' && isFinite(v)) allVals.push(v);
        });
      });
      if (allVals.length) {
        let minVal = Math.min(...allVals);
        let maxVal = Math.max(...allVals);

        const opt = (k: string) => {
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

        if (logEnabled) {
          if (minVal <= 0) minVal = (typeof treatZeroAs !== 'undefined') ? treatZeroAs! : Math.max(1e-9, Math.min(...allVals.filter(v => v > 0)));
        }

        {
          const padded = computePaddedValueAxisDomain(allVals, minVal, maxVal, logEnabled, userTruncate, rawMin, rawMax);
          minVal = padded.minVal;
          maxVal = padded.maxVal;
        }

        // Top-only scale extension (amCharts `extraMax`): extra headroom / tick at high end; does not extend the bottom.
        const explicitMaxBound = userTruncate && parseBound(rawMax) !== null;
        try {
          yAxis.set('extraMax', explicitMaxBound ? 0 : 0.08);
        } catch (e) {}

        try { yAxis.set('min', minVal); } catch (e) {}
        try { yAxis.set('max', maxVal); } catch (e) {}
      }
    } catch (e) {}

    const yAxisTitleText = resolveValueAxisTitle(
      options?.yAxisTitle,
      metricsProp,
      resolveChartValueFields(chartData[0], columns, x_axis || categoryField),
    );
    if (yAxisTitleText || logEnabled) {
      attachLeftValueAxisTitle(chart, root, yAxisTitleText, foregroundColor, {
        margin: options?.yAxisTitleMargin ?? 10,
        position: options?.yAxisTitlePosition || 'left',
        logEnabled,
      });
    }

    // Line colours: neatChartHexAtIndex + shine gradients (am5MiniChartLine)

    const lineCurveStyle = resolveCartesianCurveStyle(options as LineCustomizationOptions, 'lineCurveStyle');
    const lineThickness = resolveLineThickness(
      (options as LineCustomizationOptions)?.lineThickness,
      DEFAULT_LINE_THICKNESS,
    );

    // Create series for each field
    const seriesArray: Array<am5xy.SmoothedXLineSeries | am5xy.LineSeries> = [];
    
    sortedSeriesFields.forEach((field, index) => {
      const shinePalette = createShinePaletteFromBase(getSchemeColor(index)) as readonly [string, string, string];
      const midColor = am5.color(shinePalette[1]);
      const bulletRadial = shineRadialGradient(root, am5, shinePalette);

      const lineTooltip = createSeriesLinkedTooltipWithText(
        root,
        am5,
        (di) => {
          const vy = Number(di.get?.('valueY'));
          const ctx = (di as { dataContext?: Record<string, unknown> }).dataContext;
          const resolvedVy = Number.isFinite(vy)
            ? vy
            : Number(ctx?.[field]);
          if (!Number.isFinite(resolvedVy)) return '';
          const formattedValue = applyNumberFormat(resolvedVy);
          const cat = String(ctx?.[categoryField] ?? di.get?.('categoryX') ?? '');
          return cat ? `${cat}\n${field}: ${formattedValue}` : `${field}: ${formattedValue}`;
        },
        {
          pointerOrientation: 'vertical',
          fontSize: 12,
          labelText: `{categoryX}\n{name}: {valueY.formatNumber('#,###.##')}`,
        },
      );

      const seriesCommon = {
        name: field,
        xAxis,
        yAxis,
        valueYField: field,
        categoryXField: categoryField,
        tooltip: lineTooltip as unknown as am5.Tooltip,
      };

      const series =
        lineCurveStyle === 'linear'
          ? chart.series.push(am5xy.LineSeries.new(root, seriesCommon))
          : chart.series.push(
              am5xy.SmoothedXLineSeries.new(root, {
                ...seriesCommon,
                tension: 0.3,
              }),
            );

      try {
        const strokeGradient = shineLinearGradient(root, am5, shinePalette, 0);
        series.strokes.template.setAll({ strokeWidth: lineThickness, strokeGradient, interactive: true });
        series.set('stroke', midColor);
        series.set('fill', midColor);
        series.fills.template.setAll({ visible: false });
        series.strokes.template.events.on('pointerover', (ev) => {
          primeSeriesLinkedTooltipFill(lineTooltip, midColor, am5);
          const di = (ev.target as { dataItem?: unknown }).dataItem;
          if (di) {
            (lineTooltip as { dataItem?: unknown }).dataItem = di;
          }
          (lineTooltip as am5.Tooltip).show();
        });
        series.strokes.template.events.on('pointerout', () => {
          (lineTooltip as am5.Tooltip).hide();
        });
      } catch (e) {
        series.strokes.template.setAll({ strokeWidth: lineThickness, strokeOpacity: 0.9, interactive: true });
        series.strokes.template.events.on('pointerover', (ev) => {
          primeSeriesLinkedTooltipFill(lineTooltip, midColor, am5);
          const di = (ev.target as { dataItem?: unknown }).dataItem;
          if (di) {
            (lineTooltip as { dataItem?: unknown }).dataItem = di;
          }
          (lineTooltip as am5.Tooltip).show();
        });
        series.strokes.template.events.on('pointerout', () => {
          (lineTooltip as am5.Tooltip).hide();
        });
      }

      // Bullets — interactive hit target; tooltip stays on series (one tooltip per series)
      series.bullets.push(() => {
        const container = am5.Container.new(root, {
          interactive: true,
          cursorOverStyle: 'pointer',
        });
        const circle = am5.Circle.new(root, {
          radius: 5,
          fillGradient: bulletRadial,
          strokeWidth: Math.max(1, lineThickness),
          stroke: root.interfaceColors.get('background'),
        });
        container.children.push(circle);
        container.events.on('pointerover', (ev) => {
          primeSeriesLinkedTooltipFill(lineTooltip, midColor, am5);
          const di = (ev.target as { dataItem?: unknown }).dataItem;
          if (di) {
            (lineTooltip as { dataItem?: unknown }).dataItem = di;
          }
          (lineTooltip as am5.Tooltip).show();
        });
        container.events.on('pointerout', () => {
          (lineTooltip as am5.Tooltip).hide();
        });
        try {
          const buildPayload = (di: any) => {
            const ctx = di && (di.dataContext || (di.get && di.get('dataContext')));
            if (!ctx) return null;
            const val = ctx[categoryField];
            if (val === undefined) return null;
            const orig = ctx.originalData ?? ctx;
            const eventDrillFilters = categoryField ? [{ column: categoryField, value: val }] : undefined;
            const eventDimensionFields = categoryField ? [categoryField] : undefined;
            return { field: categoryField, value: val, originalData: orig, eventDimensionFields, eventDrillFilters };
          };
          container.events.on('click', (ev: any) => {
            try {
              const di = ev?.target?.dataItem;
              const payload = buildPayload(di);
              const val = payload?.value;
              if (val === undefined) return;
              try {
                if (typeof onChartInteraction === 'function') {
                  onChartInteraction(categoryField, val, payload?.originalData, payload?.eventDimensionFields, payload?.eventDrillFilters);
                }
              } catch (e) { /* ignore */ }
              try {
                if (typeof window !== 'undefined') {
                  window.dispatchEvent(new CustomEvent('pieSliceInteraction', {
                    detail: {
                      value: val,
                      originalData: payload?.originalData,
                      column: categoryField,
                      dimensionFields: payload?.eventDimensionFields,
                      drillFilters: payload?.eventDrillFilters,
                    },
                  }));
                }
              } catch (e) { /* ignore */ }
            } catch (e) { /* ignore */ }
          });
        } catch (e) { /* ignore attach errors */ }
        return am5.Bullet.new(root, { sprite: container });
      });

      try {
        const showLabels = Boolean((options && typeof options.showValue !== 'undefined') ? options.showValue : false);
        if (showLabels) {
          series.bullets.push((root, series, dataItem) => {
            const label = am5.Label.new(root, {
              centerX: am5.p50,
              centerY: am5.p100,
              dy: -14,
              fill: foregroundColor,
              textAlign: 'center',
              paddingLeft: 6,
              paddingRight: 6,
              paddingTop: 2,
              paddingBottom: 2,
            });
            const seriesLabelFont = Number((options && (options as any).fontSize) ?? 12);
            try { label.setAll({ fontSize: seriesLabelFont, visible: !isNaN(seriesLabelFont) && seriesLabelFont > 0 }); } catch (e) {}
            try {
              label.set('background', am5.RoundedRectangle.new(root, { fill: valueLabelBg, fillOpacity: 0.92, cornerRadiusTL: 6, cornerRadiusTR: 6, cornerRadiusBL: 6, cornerRadiusBR: 6 } as any));
              (label as any).set('zIndex', 1000);
              const ctx = (dataItem && (dataItem.dataContext as any)) || {};
              const v = (ctx && ctx[field]) ?? (dataItem && (dataItem.get('valueY') as number)) ?? 0;
              label.set('text', applyNumberFormat(Number(v) || 0));
            } catch (e) {}
            return am5.Bullet.new(root, { sprite: label, locationY: 0 });
          });
        }
      } catch (e) {}

      series.data.setAll(effectiveChartData);

      // Add click handler
      if (onChartInteraction) {
        series.events.on('click', (ev) => {
          const dataItem = ev.target.dataItem;
          if (dataItem && dataItem.dataContext) {
            const context = dataItem.dataContext as any;
            const val = context[categoryField];
            const orig = context.originalData ?? context;
            const eventDrillFilters = categoryField ? [{ column: categoryField, value: val }] : undefined;
            const eventDimensionFields = categoryField ? [categoryField] : undefined;
            onChartInteraction(categoryField, val, orig, eventDimensionFields, eventDrillFilters);
          }
        });
      }

      series.appear();
      seriesArray.push(series);
    });

    if (seriesArray.length > 0) {
      chart.set(
        'cursor',
        am5xy.XYCursor.new(root, {
          xAxis,
          yAxis,
          snapToSeries: seriesArray,
        }),
      );
      const cursor = chart.get('cursor');
      if (cursor) {
        cursor.lineX?.setAll({ visible: true, strokeOpacity: 0.35 });
        cursor.lineY?.setAll({ visible: false });
      }
    }

    // Data zoom: show horizontal scrollbar when options.dataZoom is true
    try {
      const dataZoomMin = resolveDataZoomMin(options as Record<string, unknown>, 6);
      if (options?.dataZoom && effectiveChartData.length > dataZoomMin) {
        const defaultVisibleCategoryCount = dataZoomMin;
        const initialEnd = Math.min(1, defaultVisibleCategoryCount / effectiveChartData.length);
        const scrollbarX = am5.Scrollbar.new(root, { orientation: 'horizontal' });
        chart.set('scrollbarX', scrollbarX);
        chart.bottomAxesContainer.children.push(scrollbarX);
        try {
          scrollbarX.set('start', 0);
          scrollbarX.set('end', initialEnd);
        } catch (e) {}
        const truncateOpts = resolveChartAxisTruncateOptions(options as Record<string, unknown>);
        attachChartScrollbarYRangeSync(root, chart, xAxis, yAxis, {
          rows: effectiveChartData,
          valueKeys: sortedSeriesFields,
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
                Math.min(defaultVisibleCategoryCount - 1, effectiveChartData.length - 1),
              );
            } catch (e) {}
          },
        });
      }
    } catch (e) {}

    // Add legend when legend is requested in customization (or default for multiple series)
    try {
      if (showLegend && sortedSeriesFields.length >= 1) {
        setLineDomLegend(
          sortedSeriesFields.map((field, index) => ({
            id: field,
            line: String(field),
            color: getSchemeColor(index),
          })),
        );
      } else {
        setLineDomLegend([]);
      }
    } catch (e) {}

    const xAxisTitle = resolveCategoryAxisTitle(options?.xAxisTitle, x_axis || categoryField);
    attachBottomCategoryAxisTitle(chart, root, xAxisTitle, foregroundColor, options?.xAxisTitleMargin ?? 6);

    const isStreamRefresh =
      typeof window !== 'undefined' && Boolean((window as any).__chartStreamSilentRefresh);
    if (isStreamRefresh) {
      try {
        (window as any).__chartStreamSilentRefresh = false;
      } catch {
        /* ignore */
      }
    } else if (options && options.animation === false) {
      chart.appear(0, 0);
    } else {
      chart.appear(1000, 100);
    }

    const layoutResizeFrame = requestAnimationFrame(() => root.resize());
    const layoutResizeTimer = window.setTimeout(() => root.resize(), 400);

    return () => {
      cancelAnimationFrame(layoutResizeFrame);
      window.clearTimeout(layoutResizeTimer);
      const el = chartRef.current;
      if (rootRef.current) {
        rootRef.current.dispose();
        rootRef.current = null;
      }
      setLineDomLegend([]);
    };
  }, [chartData, onChartInteraction, sortedSeriesFields, categoryField, options, theme, x_axis, metricsProp, columns]);

  const legendOrientation = String((options && (options as any).legendOrientation) || 'bottom').toLowerCase();

  return (
    <div className={`relative flex h-full w-full min-h-0 ${
      legendOrientation === 'left' ? 'flex-row-reverse' :
      legendOrientation === 'right' ? 'flex-row' :
      legendOrientation === 'top' ? 'flex-col-reverse' :
      'flex-col'
    } max-w-full overflow-hidden`}>
      <div ref={chartRef} className="relative h-full min-h-0 flex-1 w-full max-w-full overflow-hidden" />
      <ChartDomScrollLegend
        visible={lineDomLegend.length > 0}
        items={lineDomLegend}
        orientation={legendOrientation as any}
      />
    </div>
  );
}

