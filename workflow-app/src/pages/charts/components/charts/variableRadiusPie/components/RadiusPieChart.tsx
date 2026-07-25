import { useEffect, useRef } from 'react';
import * as React from 'react';
import * as am5 from '@amcharts/amcharts5';
import * as am5percent from '@amcharts/amcharts5/percent';
import am5themes_Animated from '@amcharts/amcharts5/themes/Animated';
import { formatNumber } from '@/utils/numberFormatters';
import type { ChartCustomizationOptions } from '../../pie/customize/pieCustomizeTypes';
import { defaultOptions, colorSchemes } from '../../pie/customize/PieCustomizePanel';
import { createShinePaletteFromBase, donutColors } from '@/pages/ExploratoryAnalysis/AgenticSemantics/am5MiniChartConstants';
import { shineRadialGradient } from '@/pages/ExploratoryAnalysis/AgenticSemantics/am5MiniChartHelpers';
import { useTheme } from '@/context/theme';
import { applyAm5InterfaceTheme, probeAmChartThemeColors } from '../../amChartThemeColors';
import { ChartDomScrollLegend, type ChartDomScrollLegendItem } from '../../ChartDomScrollLegend';

type RadiusPieDatum = { category: string; value: number; originalData: unknown };
type SortSliceBy = 'none' | 'asc' | 'desc';

function sortRadiusPieData(data: RadiusPieDatum[], sortBy: SortSliceBy): RadiusPieDatum[] {
  if (sortBy === 'none') return data.map((d) => ({ ...d }));
  const dir = sortBy === 'asc' ? 1 : -1;
  return [...data].sort((a, b) => {
    const diff = dir * ((a.value ?? 0) - (b.value ?? 0));
    if (diff !== 0) return diff;
    return String(a.category ?? '').localeCompare(String(b.category ?? ''));
  });
}

export type RadiusPieDrilldownPayload = {
  field: string;
  value: unknown;
  originalData?: unknown;
  eventDimensionFields?: string[];
  eventDrillFilters?: Array<{ column: string; value: unknown }>;
};

export interface RadiusPieChartProps {
  data: Array<{ category: string; value: number; originalData: unknown }>;
  onChartInteraction?: (field: string, value: unknown) => void;
  customizationOptions?: ChartCustomizationOptions;
}

/** amCharts 5 variable-radius pie (slice radius ∝ value). */
export function RadiusPieChart({
  data,
  onChartInteraction,
  customizationOptions,
}: RadiusPieChartProps) {
  const { theme } = useTheme();
  const chartRef = useRef<HTMLDivElement>(null);
  const rootRef = useRef<am5.Root | null>(null);
  const chartLiveRefs = useRef<{
    series: am5percent.PieSeries;
    showLegend: boolean;
    showSideLegend: boolean;
    formatLegendLine: (ctx: { category?: string; value?: number }) => string;
  } | null>(null);
  const chartHasAppearedRef = useRef(false);
  const onChartInteractionRef = useRef(onChartInteraction);
  const [customizationState, setCustomizationState] = React.useState<ChartCustomizationOptions | undefined>(
    customizationOptions,
  );
  const [domLegend, setDomLegend] = React.useState<ChartDomScrollLegendItem[]>([]);

  React.useEffect(() => {
    onChartInteractionRef.current = onChartInteraction;
  }, [onChartInteraction]);

  React.useEffect(() => {
    const handleCustomizationChange = (event: CustomEvent) => {
      setCustomizationState(event.detail);
    };
    if (typeof window !== 'undefined') {
      window.addEventListener('chartCustomizationChanged', handleCustomizationChange as EventListener);
      if ((window as { __chartCustomizationOptions?: ChartCustomizationOptions }).__chartCustomizationOptions) {
        setCustomizationState((window as { __chartCustomizationOptions?: ChartCustomizationOptions }).__chartCustomizationOptions);
      }
    }
    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener('chartCustomizationChanged', handleCustomizationChange as EventListener);
      }
    };
  }, []);

  React.useEffect(() => {
    if (customizationOptions) {
      setCustomizationState(customizationOptions);
    } else if (typeof window !== 'undefined' && (window as { __chartCustomizationOptions?: ChartCustomizationOptions }).__chartCustomizationOptions) {
      setCustomizationState((window as { __chartCustomizationOptions?: ChartCustomizationOptions }).__chartCustomizationOptions);
    }
  }, [customizationOptions]);

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
    };
  }, []);

  useEffect(() => {
    if (!chartRef.current || !data?.length) return;

    const options =
      customizationState ||
      customizationOptions ||
      (typeof window !== 'undefined'
        ? (window as { __chartCustomizationOptions?: ChartCustomizationOptions }).__chartCustomizationOptions
        : null) ||
      defaultOptions;

    const colorSchemeKey = options.colorScheme || 'agentic-base';
    const activeScheme = colorSchemes.find((s) => s.value === colorSchemeKey) || colorSchemes[0];
    const activeColors = activeScheme ? activeScheme.colors : donutColors;

    const sortSliceBy: SortSliceBy = options.sortSliceBy ?? 'desc';

    const validData = sortRadiusPieData(
      data
        .filter((d) => {
          const n = Number(d?.value);
          return d && Number.isFinite(n) && n > 0;
        })
        .map((d) => ({
          category: String(d.category ?? ''),
          value: Number(d.value),
          originalData: d.originalData,
        })),
      sortSliceBy,
    );

    if (validData.length === 0) {
      console.warn('No valid data points for radius pie chart. Data:', data);
      return;
    }

    const labelType = options.labelType || 'percentage';
    const chartTotal = () => validData.reduce((sum, item) => sum + (item.value || 0), 0);

    const formatSliceMetricLine = (ctx: { value?: number }): string => {
      const value = ctx.value ?? 0;
      const total = chartTotal();
      const pct = total > 0 ? ((value / total) * 100).toFixed(2) : '0.00';
      const formatted =
        typeof value === 'number' ? formatNumber(value, { format: 'short' }) : String(value);
      switch (labelType) {
        case 'percentage':
          return `${pct}%`;
        case 'value':
          return formatted;
        case 'both':
          return `${formatted} (${pct}%)`;
        case 'none':
          return '';
        default:
          return formatted;
      }
    };

    const formatMultilineSliceLabel = (ctx: { category?: string; value?: number }): string => {
      if (labelType === 'none') return '';
      const name = ctx.category || '';
      const metricLine = formatSliceMetricLine(ctx);
      if (!name) return metricLine;
      if (!metricLine) return name;
      return `${name}\n${metricLine}`;
    };

    const formatLegendLine = (ctx: { category?: string; value?: number }): string => {
      const category = ctx.category || '';
      const value = ctx.value ?? 0;
      const total = validData.reduce((sum, item) => sum + (item.value || 0), 0);
      const pct = total > 0 ? ((value / total) * 100).toFixed(2) : '0.00';
      const formatted =
        typeof value === 'number' ? formatNumber(value, { format: 'short' }) : String(value);
      switch (labelType) {
        case 'percentage':
          return `${category}: ${pct}%`;
        case 'value':
          return `${category}: ${formatted}`;
        case 'both':
          return `${category}: ${formatted} (${pct}%)`;
        case 'none':
          return category;
        default:
          return `${category}: ${formatted}`;
      }
    };

    const buildSideLegendItem = (
      ctx: { category?: string; value?: number },
      idx: number,
      total: number,
    ): ChartDomScrollLegendItem => {
      const category = ctx.category || '';
      const value = ctx.value ?? 0;
      const formatted =
        typeof value === 'number' ? formatNumber(value, { format: 'short' }) : String(value);
      const pct = total > 0 ? ((value / total) * 100).toFixed(1) : '0.0';
      return {
        id: String(category || idx),
        line: formatLegendLine(ctx),
        label: category,
        valueLine: `${formatted} (${pct}%)`,
        color: activeColors[idx % activeColors.length],
      };
    };

    const isStreamRefresh =
      typeof window !== 'undefined' && Boolean((window as any).__chartStreamSilentRefresh);

    if (isStreamRefresh && rootRef.current && chartLiveRefs.current?.series) {
      try {
        (window as any).__chartStreamSilentRefresh = false;
      } catch {
        /* ignore */
      }

      const live = chartLiveRefs.current;
      validData.forEach((d) => {
        if (!d.originalData) d.originalData = { ...d };
        else d.originalData = { ...(d.originalData as object) };
      });
      live.series.data.setAll(validData);

      const refreshedTotal = validData.reduce((sum, item) => sum + (item.value || 0), 0);

      if (options.showSideLegend === true) {
        setDomLegend(validData.map((d, idx) => buildSideLegendItem(d, idx, refreshedTotal)));
      } else if (live.showLegend && options.showLegend !== false) {
        setDomLegend(
          validData.map((d, idx) => ({
            id: String(d.category ?? idx),
            line: formatLegendLine(d),
            color: activeColors[idx % activeColors.length],
          })),
        );
      } else {
        setDomLegend([]);
      }

      return;
    }

    chartLiveRefs.current = null;
    if (rootRef.current) {
      try {
        rootRef.current.dispose();
      } catch {
        /* ignore */
      }
      rootRef.current = null;
    }
    setDomLegend([]);

    const chartTheme = probeAmChartThemeColors();
    let root: am5.Root;
    try {
      root = am5.Root.new(chartRef.current);
      root.setThemes([am5themes_Animated.new(root)]);
      root.autoResize = true;
      root._logo?.dispose();
      applyAm5InterfaceTheme(root, chartTheme);
      rootRef.current = root;
    } catch (error) {
      console.error('Error creating radius pie root:', error);
      return;
    }

    const outerRadiusPercent = options.outerRadius ?? 88;
    const showSideLegend = options.showSideLegend === true;
    const showLegend = showSideLegend ? false : options.showLegend !== false;
    const showLabels = options.showLabels !== false;
    const labelLine = options.labelLine !== false;
    const showTotal = options.showTotal === true;

    const chart = root.container.children.push(
      am5percent.PieChart.new(root, {
        layout: root.verticalLayout,
        centerY: am5.p50,
        y: am5.p50,
        radius: am5.percent(outerRadiusPercent),
        width: am5.percent(100),
        height: am5.percent(100),
      }),
    );

    const series = chart.series.push(
      am5percent.PieSeries.new(root, {
        alignLabels: true,
        calculateAggregates: true,
        valueField: 'value',
        categoryField: 'category',
        legendValueText: '',
      }),
    );

    series.slices.template.setAll({
      stroke: chartTheme.background,
      strokeWidth: 3,
      strokeOpacity: 1,
      cursorOverStyle: 'pointer',
    });

    series.labelsContainer.set('paddingTop', 30);

    series.get('colors')?.set(
      'colors',
      activeColors.map((c) => am5.color(c)),
    );

    series.slices.template.adapters.add('fillGradient', (_fillGradient, target) => {
      const di = target.dataItem;
      if (!di) return undefined;
      const idx = series.dataItems.indexOf(di as (typeof series.dataItems)[number]);
      if (idx < 0) return undefined;
      const base = activeColors[idx % activeColors.length];
      return shineRadialGradient(root, am5, createShinePaletteFromBase(base));
    });

    // Variable slice radius: larger values → larger radius (amCharts demo pattern)
    series.slices.template.adapters.add('radius', (radius, target) => {
      const dataItem = target.dataItem;
      const high = series.getPrivate('valueHigh');
      if (dataItem && typeof high === 'number' && high > 0) {
        const value =
          Number((dataItem as unknown as { get: (key: string, fallback?: number) => number }).get('valueWorking', 0)) ||
          Number((dataItem.dataContext as { value?: number })?.value) ||
          0;
        return (radius as number) * (value / high);
      }
      return radius;
    });

    const effectiveShowLabels = showLabels !== false && labelType !== 'none';
    const effectiveLabelLine = labelLine !== false;

    if (!effectiveShowLabels) {
      series.labels.template.setAll({
        visible: false,
        forceHidden: true,
      });
      series.ticks.template.setAll({
        visible: false,
        forceHidden: true,
        strokeOpacity: 0,
        length: 0,
      });
    } else {
      series.labels.template.setAll({
        visible: true,
        forceHidden: false,
        fontSize: 12,
        fontWeight: '400',
        fill: chartTheme.cardForeground,
        textAlign: 'center',
        textType: 'regular',
        centerX: am5.p50,
        centerY: am5.p50,
        radius: effectiveLabelLine ? (outerRadiusPercent / 100) * 1.08 : undefined,
      });

      series.ticks.template.setAll({
        visible: effectiveLabelLine,
        strokeOpacity: 0.5,
        length: 10,
      });

      series.labels.template.adapters.add('text', (_text, target) => {
        const ctx = target.dataItem?.dataContext as { category?: string; value?: number } | undefined;
        if (!ctx) return '';
        return formatMultilineSliceLabel(ctx);
      });
    }

    validData.forEach((d) => {
      if (!d.originalData) d.originalData = { ...d };
      else d.originalData = { ...(d.originalData as object) };
    });

    series.data.setAll(validData);

    // Calculate total value
    const total = validData.reduce((sum, item) => sum + (item.value || 0), 0);

    // Helper function to get currency info
    const getCurrencyInfo = (): { code: string; locale: string; symbol: string } => {
      const currencyOption = options.currencySymbol || '$ (USD)';
      const codeMatch = currencyOption.match(/\(([A-Z]{3})\)/);
      const code = codeMatch ? codeMatch[1] : 'USD';
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
      const symbolMatch = currencyOption.match(/^([^\s(]+)/);
      const symbol = symbolMatch ? symbolMatch[1] : '$';
      return { code, locale, symbol };
    };

    // Add total label if showTotal is enabled
    if (showTotal) {
      const { symbol } = getCurrencyInfo();
      let formattedTotal = String(total);
      if (typeof total === 'number') {
        if (options.numberFormat === 'short') {
          formattedTotal = formatNumber(total, { format: 'short' });
        } else if (options.numberFormat === 'full') {
          formattedTotal = total.toLocaleString();
        } else if (options.numberFormat === 'decimal') {
          formattedTotal = total.toFixed(2);
        } else {
          formattedTotal = formatNumber(total, { format: 'short' });
        }

        if (options.currencyFormat !== 'none') {
          if (options.currencyFormat === 'prefix') {
            formattedTotal = `${symbol}${formattedTotal}`;
          } else if (options.currencyFormat === 'suffix') {
            formattedTotal = `${formattedTotal} ${symbol}`;
          }
        }
      }

      chart.children.push(
        am5.Label.new(root, {
          text: `Total: ${formattedTotal}`,
          fontSize: 14,
          fontWeight: '600',
          fill: chartTheme.cardForeground,
          centerX: am5.p50,
          centerY: am5.p50,
          x: am5.p50,
          y: am5.p50,
        })
      );
    }

    const buildSlicePayload = (ctx: {
      category?: string;
      value?: number;
      originalData?: unknown;
    }): RadiusPieDrilldownPayload => {
      const orig = (ctx.originalData ?? ctx) as Record<string, unknown>;
      const category = ctx.category;
      const keys = Object.keys(orig).filter((k) => k !== 'value' && k !== 'category');
      const field = keys.find((k) => orig[k] !== undefined && String(orig[k]) === String(category)) ?? 'category';
      const value = orig[field] ?? category;
      return {
        field,
        value,
        originalData: orig,
        eventDrillFilters: [{ column: field, value }],
      };
    };

    series.slices.template.events.on('click', (ev) => {
      const ctx = ev.target.dataItem?.dataContext as { category?: string; value?: number; originalData?: unknown };
      if (!ctx) return;
      const payload = buildSlicePayload(ctx);
      onChartInteractionRef.current?.(payload.field, payload.value);
      try {
        window.dispatchEvent(new CustomEvent('pieSliceInteraction', { detail: payload }));
      } catch {
        /* ignore */
      }
    });

    if (showSideLegend) {
      setDomLegend(validData.map((d, idx) => buildSideLegendItem(d, idx, total)));
    } else if (showLegend) {
      setDomLegend(
        validData.map((d, idx) => ({
          id: String(d.category ?? idx),
          line: formatLegendLine(d),
          color: activeColors[idx % activeColors.length],
        })),
      );
    }

    chartLiveRefs.current = {
      series,
      showLegend,
      showSideLegend,
      formatLegendLine,
    };

    if (!chartHasAppearedRef.current) {
      series.appear(1000, 100);
      chartHasAppearedRef.current = true;
    }

    return () => {
      setDomLegend([]);
    };
  }, [data, customizationOptions, customizationState, theme]);

  const optionsRaw = customizationState || customizationOptions || (typeof window !== 'undefined' ? (window as any).__chartCustomizationOptions : null) || defaultOptions;
  const showSideLegend = optionsRaw.showSideLegend === true;
  const legendOrientation = showSideLegend
    ? (optionsRaw.sideLegendOrientation || 'right')
    : (optionsRaw.legendOrientation || 'bottom');

  return (
    <div className={`relative flex h-full w-full min-h-0 ${
      legendOrientation === 'left' ? 'flex-row-reverse' :
      legendOrientation === 'right' ? 'flex-row' :
      legendOrientation === 'top' ? 'flex-col-reverse' :
      'flex-col'
    }`}>
      <div ref={chartRef} className="min-h-0 flex-1 w-full" />
      <ChartDomScrollLegend
        visible={domLegend.length > 0}
        items={domLegend}
        orientation={legendOrientation}
        variant={showSideLegend ? 'side-detailed' : 'default'}
      />
    </div>
  );
}
