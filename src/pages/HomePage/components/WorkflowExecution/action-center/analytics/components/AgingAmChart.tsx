import { useEffect, useMemo, useRef } from 'react';
import * as am5 from '@amcharts/amcharts5';
import * as am5xy from '@amcharts/amcharts5/xy';
import am5themes_Animated from '@amcharts/amcharts5/themes/Animated';
import { BarChart3 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTheme } from '@/context/theme';
import {
  BAR_COLUMN_LOCATION_X,
  BAR_COLUMN_OPEN_LOCATION_X,
} from '@/pages/ExploratoryAnalysis/AgenticSemantics/am5MiniChartHelpers';
import {
  amChartLabelForeground,
  applyAm5InterfaceTheme,
  createAmChartForegroundFillAdapter,
  probeAmChartThemeColors,
} from '@/pages/charts/components/charts/amChartThemeColors';
import {
  attachAgingCategoryZoombar,
  collectNumericValuesFromRows,
} from '../utils/agingAmChartScrollbar';
import { getValueAxisRange } from '@/pages/ExploratoryAnalysis/AgenticSemantics/am5MiniChartHelpers';

/** Series fill colours — matched / unmatched / reversal. */
const AGING_AM_BAR_COLORS_BY_KEY: Record<string, string> = {
  matched_count: '#3b82f6',
  unmatched_count: '#e11d48',
  reversal_count: '#8b5cf6',
  matched_amount: '#3b82f6',
  unmatched_amount: '#e11d48',
  reversal_amount: '#8b5cf6',
};

const AGING_AM_BAR_COLOR_FALLBACK = ['#3b82f6', '#e11d48', '#8b5cf6'] as const;

function resolveAmBarSeriesColor(line: AgingAmBarLine, index: number): string {
  return (
    AGING_AM_BAR_COLORS_BY_KEY[line.dataKey] ??
    AGING_AM_BAR_COLOR_FALLBACK[index % AGING_AM_BAR_COLOR_FALLBACK.length]
  );
}

interface AgingAmBarLine {
  dataKey: string;
  name: string;
  color: string;
}

export interface AgingAmBarClickPayload {
  row: Record<string, string | number>;
  dataKey: string;
}

interface AgingAmBarChartProps {
  data: Record<string, string | number>[];
  lines: AgingAmBarLine[];
  height?: number | '100%';
  yMin?: number;
  yMax?: number;
  onBarClick?: (payload: AgingAmBarClickPayload) => void;
}

export function AgingAmBarChart({
  data,
  lines,
  height = 280,
  yMin,
  yMax,
  onBarClick,
}: AgingAmBarChartProps) {
  const { theme } = useTheme();
  const chartRef = useRef<HTMLDivElement>(null);
  const rootRef = useRef<am5.Root | null>(null);
  const onBarClickRef = useRef(onBarClick);
  onBarClickRef.current = onBarClick;

  const chartData = useMemo(
    () =>
      data.map((row) => {
        const point: Record<string, string | number> = {
          statement_date: String(row.statement_date ?? ''),
        };
        lines.forEach((line) => {
          point[line.dataKey] = Number(row[line.dataKey]) || 0;
        });
        return point;
      }),
    [data, lines],
  );

  const containerClassName =
    height === '100%' ? 'h-full w-full min-h-0' : 'w-full';
  const containerStyle = typeof height === 'number' ? { height } : undefined;

  useEffect(() => {
    if (!chartRef.current || chartData.length === 0 || lines.length === 0) {
      return undefined;
    }

    const host = chartRef.current;
    const chartTheme = probeAmChartThemeColors(host);
    const labelColor = amChartLabelForeground(host);
    const labelFillAdapter = createAmChartForegroundFillAdapter(host);

    const root = am5.Root.new(host);
    root.setThemes([am5themes_Animated.new(root)]);
    root.autoResize = true;
    root._logo?.dispose();
    applyAm5InterfaceTheme(root, chartTheme);
    rootRef.current = root;

    const chart = root.container.children.push(
      am5xy.XYChart.new(root, {
        panX: false,
        panY: false,
        wheelX: 'none',
        wheelY: 'none',
        layout: root.verticalLayout,
        paddingTop: 8,
        paddingBottom: 0,
        paddingLeft: 0,
        paddingRight: 8,
      }),
    );

    chart.set('cursor', am5xy.XYCursor.new(root, { behavior: 'none' }));
    (chart as am5xy.XYChart & { set: (key: string, value: unknown) => void }).set('clustered', true);

    const barWidthPx = 20;
    const barPillRadius = barWidthPx / 2;

    const xRenderer = am5xy.AxisRendererX.new(root, {
      minGridDistance: 28,
      cellStartLocation: 0.05,
      cellEndLocation: 0.95,
    });
    xRenderer.grid.template.set('visible', false);

    xRenderer.labels.template.setAll({
      fontSize: 11,
      fill: labelColor,
      fillOpacity: 1,
      oversizedBehavior: 'truncate',
      maxWidth: 80,
    });
    xRenderer.labels.template.adapters.add('fill', labelFillAdapter);

    const xAxis = chart.xAxes.push(
      am5xy.CategoryAxis.new(root, {
        categoryField: 'statement_date',
        renderer: xRenderer,
      }),
    );
    xAxis.data.setAll(chartData);

    const yRenderer = am5xy.AxisRendererY.new(root, {});
    yRenderer.grid.template.setAll({
      stroke: chartTheme.border,
      strokeOpacity: 0.35,
    });
    yRenderer.labels.template.setAll({
      fontSize: 11,
      fill: labelColor,
      fillOpacity: 1,
    });
    yRenderer.labels.template.adapters.add('fill', labelFillAdapter);

    let resolvedYMin = yMin;
    let resolvedYMax = yMax;
    if (resolvedYMin == null || resolvedYMax == null) {
      const values = collectNumericValuesFromRows(
        chartData,
        lines.map((line) => line.dataKey),
      );
      const autoRange = getValueAxisRange(values, { paddingPercent: 0.08, minSpanFraction: 0.08 });
      if (resolvedYMin == null) resolvedYMin = autoRange.min;
      if (resolvedYMax == null) resolvedYMax = autoRange.max;
    }

    const yAxis = chart.yAxes.push(
      am5xy.ValueAxis.new(root, {
        min: resolvedYMin,
        max: resolvedYMax,
        renderer: yRenderer,
      }),
    );

    const legend = chart.children.push(
      am5.Legend.new(root, {
        centerX: am5.p50,
        x: am5.p50,
        marginTop: 6,
        marginBottom: 0,
      }),
    );
    legend.labels.template.setAll({
      fontSize: 9,
      fill: labelColor,
      fillOpacity: 1,
    });
    legend.labels.template.adapters.add('fill', labelFillAdapter);
    legend.markers.template.setAll({
      width: 14,
      height: 14,
    });
    try {
      (legend.markers.template as unknown as { setAll: (v: Record<string, unknown>) => void }).setAll({
        cornerRadiusTL: 3,
        cornerRadiusTR: 3,
        cornerRadiusBL: 3,
        cornerRadiusBR: 3,
      });
    } catch {
      /* marker shape may vary by amCharts version */
    }
    legend.valueLabels.template.set('forceHidden', true);

    const seriesList: am5xy.ColumnSeries[] = [];

    lines.forEach((line, index) => {
      const seriesColor = resolveAmBarSeriesColor(line, index);

      const series = chart.series.push(
        am5xy.ColumnSeries.new(root, {
          name: line.name,
          xAxis,
          yAxis,
          valueYField: line.dataKey,
          categoryXField: 'statement_date',
          tooltip: am5.Tooltip.new(root, {
            labelText: `[fontSize:11px]{name}: {valueY.formatNumber('#,###.##')}`,
            pointerOrientation: 'horizontal',
          }),
        }),
      );

      series.setAll({
        openLocationX: BAR_COLUMN_OPEN_LOCATION_X,
        locationX: BAR_COLUMN_LOCATION_X,
        clustered: true,
        stacked: false,
        fill: am5.color(seriesColor),
      });

      series.columns.template.setAll({
        centerX: am5.p0,
        cornerRadiusTL: barPillRadius,
        cornerRadiusTR: barPillRadius,
        cornerRadiusBL: 0,
        cornerRadiusBR: 0,
        strokeOpacity: 0,
        fillOpacity: 0.98,
        fill: am5.color(seriesColor),
        width: barWidthPx,
        shadowColor: am5.color(0x000000),
        shadowBlur: 12,
        shadowOpacity: 0.42,
        shadowOffsetX: 0,
        shadowOffsetY: 4,
      });
      series.columns.template.setAll({
        interactive: true,
        cursorOverStyle: 'pointer',
      });

      series.columns.template.events.on('click', (ev) => {
        const row = ev.target.dataItem?.dataContext;
        if (row && onBarClickRef.current) {
          onBarClickRef.current({
            row: row as Record<string, string | number>,
            dataKey: line.dataKey,
          });
        }
      });

      series.data.setAll(chartData);
      seriesList.push(series);
    });

    legend.data.setAll(seriesList);

    const hasZoombar = attachAgingCategoryZoombar(
      root,
      chart,
      xAxis,
      chartData.length,
      chartTheme.muted,
    );
    if (hasZoombar) {
      chart.set('paddingBottom', 8);
    }

    chart.appear(600, 100);

    const resizeObserver = new ResizeObserver(() => root.resize());
    resizeObserver.observe(chartRef.current);

    return () => {
      resizeObserver.disconnect();
      root.dispose();
      rootRef.current = null;
    };
  }, [chartData, lines, yMin, yMax, theme]);

  if (chartData.length === 0) {
    return (
      <div
        className={cn(
          'flex flex-col items-center justify-center gap-2 text-muted-foreground',
          containerClassName,
        )}
        style={containerStyle}
      >
        <BarChart3 className="h-10 w-10 opacity-30" />
        <p className="text-xs">No trend data for this period</p>
      </div>
    );
  }

  return (
    <div className={containerClassName} style={containerStyle}>
      <div ref={chartRef} className="h-full w-full text-foreground" />
    </div>
  );
}
