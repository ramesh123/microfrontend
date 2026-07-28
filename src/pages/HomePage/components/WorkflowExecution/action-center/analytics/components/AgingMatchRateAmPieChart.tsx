import { useEffect, useMemo, useRef } from 'react';
import * as am5 from '@amcharts/amcharts5';
import * as am5percent from '@amcharts/amcharts5/percent';
import am5themes_Animated from '@amcharts/amcharts5/themes/Animated';
import {
  createShinePaletteFromBase,
} from '@/pages/ExploratoryAnalysis/AgenticSemantics/am5MiniChartConstants';
import { shineRadialGradient } from '@/pages/ExploratoryAnalysis/AgenticSemantics/am5MiniChartHelpers';
import {
  applyAm5InterfaceTheme,
  probeAmChartThemeColors,
} from '@/pages/charts/components/charts/amChartThemeColors';

export interface AgingMatchRatePieSlice {
  category: string;
  value: number;
  color: string;
}

interface AgingMatchRateAmPieChartProps {
  data: AgingMatchRatePieSlice[];
  height?: number;
  className?: string;
}

function DonutSideLegend({ slices, total }: { slices: AgingMatchRatePieSlice[]; total: number }) {
  return (
    <div className="flex min-w-0 flex-col justify-center gap-3 py-1 pr-1">
      {slices.map((slice) => {
        const pct = total > 0 ? ((slice.value / total) * 100).toFixed(1) : '0.0';
        return (
          <div key={slice.category} className="flex items-start gap-2">
            <span
              className="mt-0.5 h-3 w-3 shrink-0 rounded-[3px]"
              style={{ backgroundColor: slice.color }}
            />
            <div className="min-w-0 leading-snug">
              <p className="text-[11px] font-semibold text-foreground">{slice.category}</p>
              <p className="text-[10px] text-muted-foreground tabular-nums">
                ({pct}%)
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}

/** Donut pie styled like charts/PieChart.tsx (amCharts 5 + shine gradients). */
export function AgingMatchRateAmPieChart({
  data,
  height = 152,
  className,
}: AgingMatchRateAmPieChartProps) {
  const chartRef = useRef<HTMLDivElement>(null);
  const rootRef = useRef<am5.Root | null>(null);

  const validData = useMemo(
    () =>
      data
        .filter((d) => Number.isFinite(d.value) && d.value > 0)
        .map((d) => ({
          category: d.category,
          value: d.value,
          color: d.color,
          originalData: { category: d.category, value: d.value, color: d.color },
        })),
    [data],
  );

  const total = useMemo(
    () => validData.reduce((sum, row) => sum + row.value, 0),
    [validData],
  );

  const colorByCategory = useMemo(
    () => new Map(validData.map((d) => [d.category, d.color])),
    [validData],
  );

  useEffect(() => {
    if (!chartRef.current || validData.length === 0) return undefined;

    const chartTheme = probeAmChartThemeColors(chartRef.current);

    const root = am5.Root.new(chartRef.current);
    root.setThemes([am5themes_Animated.new(root)]);
    root.autoResize = true;
    root._logo?.dispose();
    applyAm5InterfaceTheme(root, chartTheme);
    rootRef.current = root;

    const outerRadiusPercent = 88;
    const innerRadiusPercent = 50;
    const sliceSeparatorStrokeWidth = 2;

    const chart = root.container.children.push(
      am5percent.PieChart.new(root, {
        layout: root.verticalLayout,
        centerY: am5.p50,
        y: am5.p50,
        innerRadius: am5.percent(innerRadiusPercent),
        radius: am5.percent(outerRadiusPercent),
        width: am5.percent(100),
        height: am5.percent(100),
        paddingTop: 0,
        paddingBottom: 0,
        paddingLeft: 0,
        paddingRight: 0,
      }),
    );

    const series = chart.series.push(
      am5percent.PieSeries.new(root, {
        valueField: 'value',
        categoryField: 'category',
        legendValueText: '',
      }),
    );

    series.slices.template.setAll({
      stroke: chartTheme.background,
      strokeWidth: sliceSeparatorStrokeWidth,
      strokeOpacity: 1,
      shadowColor: am5.color(0x000000),
      shadowBlur: 3,
      shadowOpacity: 0.08,
      shadowOffsetX: 0,
      shadowOffsetY: 1,
    });

    series.slices.template.adapters.add('fillGradient', (_fillGradient, target) => {
      const di = target.dataItem;
      if (!di) return undefined;
      const ctx = di.dataContext as { color?: string; category?: string } | undefined;
      const base =
        ctx?.color ??
        colorByCategory.get(ctx?.category ?? '') ??
        '#9333ea';
      return shineRadialGradient(root, am5, createShinePaletteFromBase(base));
    });

    const sliceLabelFontSize = 12;
    const labelRadius = (outerRadiusPercent / 100) * 1.06;

    series.labels.template.setAll({
      fontSize: sliceLabelFontSize,
      fontWeight: '500',
      fill: chartTheme.foreground,
      inside: false,
      textType: 'regular',
      centerX: am5.p50,
      centerY: am5.p50,
      textAlign: 'center',
      radius: labelRadius,
      maxWidth: 88,
      oversizedBehavior: 'wrap',
    });
    series.labels.template.set('forceInactive', false);

    series.labels.template.adapters.add('text', (_text, target) => {
      const di = target.dataItem;
      if (!di) return '';
      const ctx = di.dataContext as { category?: string; value?: number };
      const value = Number(ctx?.value ?? 0);
      const pct = total > 0 ? ((value / total) * 100).toFixed(2) : '0.00';
      return `${ctx?.category ?? ''}: ${pct}%`;
    });

    series.ticks.template.setAll({
      visible: true,
      stroke: chartTheme.muted,
      strokeOpacity: 0.4,
      length: 8,
    });
    series.ticks.template.set('forceInactive', false);

    series.slices.template.adapters.add('tooltipText', (_text, target) => {
      const di = target.dataItem;
      if (!di) return '';
      const ctx = di.dataContext as { category?: string; value?: number };
      const value = Number(ctx?.value ?? 0);
      const pct = total > 0 ? ((value / total) * 100).toFixed(1) : '0.0';
      return `${ctx?.category ?? ''}: ${pct}%`;
    });

    series.data.setAll(validData);

    series.appear(800, 100);
    chart.appear(800, 100);

    const resizeObserver = new ResizeObserver(() => root.resize());
    resizeObserver.observe(chartRef.current);

    return () => {
      resizeObserver.disconnect();
      root.dispose();
      rootRef.current = null;
    };
  }, [validData, total, colorByCategory]);

  if (validData.length === 0) {
    return null;
  }

  return (
    <div className={className}>
      <div className="flex items-center gap-2" style={{ height }}>
        <div className="relative h-full min-w-0 flex-[3]">
          <div ref={chartRef} className="h-full w-full" />
        </div>
        <div className="flex h-full flex-[2] min-w-[7.5rem] max-w-[9.5rem] items-center">
          <DonutSideLegend
            slices={validData.map((d) => ({
              category: d.category,
              value: d.value,
              color: d.color,
            }))}
            total={total}
          />
        </div>
      </div>
    </div>
  );
}
