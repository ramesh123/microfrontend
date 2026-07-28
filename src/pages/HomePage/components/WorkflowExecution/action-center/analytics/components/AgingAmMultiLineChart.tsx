import { useEffect, useMemo, useRef } from 'react';
import * as am5 from '@amcharts/amcharts5';
import * as am5xy from '@amcharts/amcharts5/xy';
import am5themes_Animated from '@amcharts/amcharts5/themes/Animated';
import { cn } from '@/lib/utils';
import { useTheme } from '@/context/theme';
import { createShinePaletteFromBase } from '@/pages/ExploratoryAnalysis/AgenticSemantics/am5MiniChartConstants';
import {
  attachCompactValueYLabelAdapter,
  BAR_X_AXIS_END_LOCATION,
  BAR_X_AXIS_START_LOCATION,
  formatCompactAxisValue,
  shineLinearGradient,
  shineRadialGradient,
} from '@/pages/ExploratoryAnalysis/AgenticSemantics/am5MiniChartHelpers';
import { createSeriesLinkedTooltipWithText } from '@/pages/ExploratoryAnalysis/AgenticSemantics/am5MiniChartTooltip';
import {
  amChartLabelForeground,
  applyAm5InterfaceTheme,
  createAmChartForegroundFillAdapter,
  probeAmChartThemeColors,
} from '@/pages/charts/components/charts/amChartThemeColors';
import {
  attachAgingCategoryZoombar,
  attachAgingYRangeForVisibleCategories,
} from '../utils/agingAmChartScrollbar';

export interface AgingAmMultiLineMetric {
  key: string;
  title: string;
  color: string;
}

export interface AgingAmMultiLinePointClickPayload {
  row: Record<string, string | number>;
  dataKey: string;
}

interface AgingAmMultiLineChartProps {
  data: Array<Record<string, string | number>>;
  metrics: AgingAmMultiLineMetric[];
  height?: number | '100%';
  valueFormatter?: (value: number) => string;
  yMin?: number;
  yMax?: number;
  onPointClick?: (payload: AgingAmMultiLinePointClickPayload) => void;
}

const LEGEND_FONT_SIZE = 10;
const LEGEND_MARKER_SIZE = 12;
const LEGEND_ITEM_SPACING = 10;
const LEGEND_MARKER_TEXT_GAP = 4;
const POINTS_COUNT_FOR_CLARITY = 12;

/** When min/max are fixed, extend the top by one tick step so point labels clear the plot edge. */
function resolveYAxisMaxWithHeadroom(yMin?: number, yMax?: number): number | undefined {
  if (yMax == null) return undefined;
  if (yMin == null || yMax <= yMin) return yMax;
  const tickStep = (yMax - yMin) / 5;
  return yMax + tickStep;
}

export function AgingAmMultiLineChart({
  data,
  metrics,
  height = 280,
  valueFormatter,
  yMin,
  yMax,
  onPointClick,
}: AgingAmMultiLineChartProps) {
  const { theme } = useTheme();
  const chartRef = useRef<HTMLDivElement>(null);
  const rootRef = useRef<am5.Root | null>(null);
  const onPointClickRef = useRef(onPointClick);
  onPointClickRef.current = onPointClick;

  const chartData = useMemo(
    () =>
      data.map((row, idx) => {
        const point: Record<string, string | number> = {
          statement_date: String(row.statement_date ?? ''),
          idx,
        };
        metrics.forEach((metric) => {
          point[metric.key] = Number(row[metric.key]) || 0;
        });
        return point;
      }),
    [data, metrics],
  );

  const containerClassName =
    height === '100%' ? 'h-full w-full min-h-0' : 'w-full';
  const containerStyle = typeof height === 'number' ? { height } : undefined;

  useEffect(() => {
    if (rootRef.current) {
      try {
        rootRef.current.dispose();
      } catch {
        /* ignore */
      }
      rootRef.current = null;
    }

    if (!chartRef.current || chartData.length === 0) {
      return;
    }

    const host = chartRef.current;
    const chartTheme = probeAmChartThemeColors(host);
    const labelColor = amChartLabelForeground(host);
    const labelFillAdapter = createAmChartForegroundFillAdapter(host);
    const gridLineStroke = chartTheme.muted;

    const root = am5.Root.new(host);
    root.setThemes([am5themes_Animated.new(root)]);
    root.autoResize = true;
    rootRef.current = root;
    applyAm5InterfaceTheme(root, chartTheme);
    root._logo?.dispose();

    const chart = root.container.children.push(
      am5xy.XYChart.new(root, {
        panX: true,
        panY: false,
        wheelX: 'panX',
        wheelY: 'zoomX',
        layout: root.verticalLayout,
        paddingTop: 14,
        paddingBottom: 0,
        paddingLeft: 0,
        paddingRight: 4,
      }),
    );

    const xRenderer = am5xy.AxisRendererX.new(root, { minGridDistance: 30 });
    xRenderer.labels.template.setAll({
      fontSize: 12,
      fill: labelColor,
      fillOpacity: 1,
      tooltipText: '',
      interactive: false,
      paddingBottom: 0,
      paddingTop: 2,
    });
    xRenderer.labels.template.adapters.add('fill', labelFillAdapter);
    xRenderer.grid.template.setAll({
      stroke: gridLineStroke,
      strokeOpacity: 0.26,
    });

    const xAxis = chart.xAxes.push(
      am5xy.CategoryAxis.new(root, {
        categoryField: 'statement_date',
        renderer: xRenderer,
      }),
    );
    xAxis.data.setAll(chartData);
    xAxis.set('startLocation', BAR_X_AXIS_START_LOCATION);
    xAxis.set('endLocation', BAR_X_AXIS_END_LOCATION);

    const yRenderer = am5xy.AxisRendererY.new(root, {});
    yRenderer.labels.template.setAll({
      fontSize: 12,
      fill: labelColor,
      fillOpacity: 1,
    });
    yRenderer.labels.template.adapters.add('fill', labelFillAdapter);
    yRenderer.grid.template.setAll({
      stroke: gridLineStroke,
      strokeOpacity: 0.4,
    });

    const resolvedYMax = resolveYAxisMaxWithHeadroom(yMin, yMax);
    const hasFixedYDomain = yMin != null && yMax != null;

    const yAxis = chart.yAxes.push(
      am5xy.ValueAxis.new(root, {
        renderer: yRenderer,
        min: yMin,
        max: resolvedYMax,
        strictMinMax: hasFixedYDomain,
      }),
    );
    if (!hasFixedYDomain) {
      yAxis.set('extraMax', 0.1);
    }

    const totalPoints = chartData.length;
    const tooManyPoints = totalPoints > POINTS_COUNT_FOR_CLARITY;
    const lineSeriesList: am5xy.LineSeries[] = [];

    metrics.forEach((metric, catIdx) => {
      const shinePalette = createShinePaletteFromBase(metric.color) as readonly [
        string,
        string,
        string,
      ];
      const midColor = am5.color(shinePalette[1]);
      const strokeGradient = shineLinearGradient(root, am5, shinePalette, 0);
      const bulletRadial = shineRadialGradient(root, am5, shinePalette);

      const lineTooltip = createSeriesLinkedTooltipWithText(
        root,
        am5,
        (di) => {
          const name = String(
            (di as { component?: { get?: (k: string) => unknown } }).component?.get?.(
              'name',
            ) ?? metric.title,
          );
          const ctx = (di as { dataContext?: Record<string, unknown> }).dataContext;
          const cat = String(ctx?.statement_date ?? di.get?.('categoryX') ?? '');
          const raw = ctx?.[metric.key];
          const vy = Number(raw ?? di.get?.('valueY'));
          if (!Number.isFinite(vy)) return '';
          const fv = valueFormatter
            ? valueFormatter(vy)
            : formatCompactAxisValue(vy);
          return cat ? `${name}\n${cat}\n${fv}` : `${name}\n${fv}`;
        },
        { pointerOrientation: 'vertical', fontSize: 10 },
      );

      const series = chart.series.push(
        am5xy.LineSeries.new(root, {
          name: metric.title,
          xAxis,
          yAxis,
          valueYField: metric.key,
          categoryXField: 'statement_date',
          locationX: 0.5,
          tooltip: lineTooltip as unknown as am5.Tooltip,
        }),
      );
      lineSeriesList.push(series);

      series.strokes.template.setAll({
        strokeWidth: 2.5,
        strokeGradient,
        interactive: true,
      });
      series.fills.template.setAll({ visible: false });
      series.set('stroke', midColor);
      series.set('fill', midColor);

      series.bullets.push((bulletRoot, _s, dataItem) => {
        if ((dataItem.dataContext as { legend?: boolean } | undefined)?.legend) {
          return undefined;
        }
        const valueY = dataItem.get('valueY');
        if (
          valueY == null ||
          (typeof valueY === 'number' && Number.isNaN(valueY))
        ) {
          return undefined;
        }

        const dataContext = dataItem.dataContext as { idx?: number } | undefined;
        const idx = dataContext?.idx ?? -1;
        const isLastPoint = idx === totalPoints - 1;

        const container = am5.Container.new(bulletRoot, {
          interactive: true,
          cursorOverStyle: 'pointer',
          tooltip: lineTooltip as unknown as am5.Tooltip,
        });
        container.children.push(
          am5.Circle.new(bulletRoot, {
            radius: 5,
            fillGradient: bulletRadial,
            stroke: bulletRoot.interfaceColors.get('background'),
            strokeWidth: 2,
          }),
        );

        const label = container.children.push(
          am5.Label.new(bulletRoot, {
            text: valueFormatter
              ? ''
              : '{valueY.formatNumber("#,###.##")}',
            centerX: am5.p50,
            centerY: am5.p100,
            populateText: !valueFormatter,
            fontWeight: 'normal',
            fontSize: 10,
            fill: labelColor,
            background: am5.RoundedRectangle.new(bulletRoot, {
              fill: chartTheme.card,
              fillOpacity: 0.92,
              stroke: chartTheme.border,
              strokeOpacity: 0.35,
              strokeWidth: 1,
            }),
            paddingTop: 4,
            paddingBottom: 4,
            paddingLeft: 6,
            paddingRight: 6,
            dy: -8,
          }),
        );

        if (valueFormatter) {
          label.adapters.add('text', () => {
            const ctx = dataItem.dataContext as Record<string, unknown> | undefined;
            const n = Number(ctx?.[metric.key]);
            return Number.isFinite(n) ? valueFormatter(n) : '';
          });
        } else {
          attachCompactValueYLabelAdapter(label);
        }

        const baseOpacity = tooManyPoints && !isLastPoint ? 0 : 1;
        label.set('opacity', baseOpacity);
        container.events.on('pointerover', () => label.set('opacity', 1));
        container.events.on('pointerout', () => label.set('opacity', baseOpacity));
        container.events.on('click', () => {
          const row = dataItem.dataContext as Record<string, string | number> | undefined;
          if (row && onPointClickRef.current) {
            onPointClickRef.current({ row, dataKey: metric.key });
          }
        });

        return am5.Bullet.new(bulletRoot, { sprite: container });
      });

      series.data.setAll(chartData);
      series.appear(800, catIdx * 100);
    });

    chart.set(
      'cursor',
      am5xy.XYCursor.new(root, {
        xAxis,
        yAxis,
        behavior: 'zoomX',
        snapToSeries: (lineSeriesList.length > 0
          ? lineSeriesList
          : chart.series.values) as am5xy.XYSeries[],
      }),
    );
    const cursor = chart.get('cursor');
    if (cursor) {
      cursor.lineX?.setAll({ visible: true, strokeOpacity: 0.35 });
      cursor.lineY?.setAll({ visible: false });
    }

    const legend = am5.Legend.new(root, {
      centerX: am5.p50,
      x: am5.p50,
      layout: root.horizontalLayout,
      marginTop: 4,
      marginBottom: 0,
      useDefaultMarker: true,
    });
    chart.children.push(legend);
    legend.itemContainers.template.setAll({
      paddingTop: 0,
      paddingBottom: 0,
      paddingLeft: 0,
      paddingRight: LEGEND_ITEM_SPACING,
      marginTop: 0,
      marginBottom: 0,
    });
    legend.labels.template.setAll({
      fontSize: LEGEND_FONT_SIZE,
      fontWeight: 'normal',
      fill: labelColor,
      fillOpacity: 1,
      paddingLeft: 0,
      paddingRight: 2,
    });
    legend.labels.template.adapters.add('fill', labelFillAdapter);
    legend.valueLabels.template.setAll({
      fontSize: LEGEND_FONT_SIZE,
      fontWeight: 'normal',
      fill: labelColor,
      fillOpacity: 1,
    });
    legend.valueLabels.template.adapters.add('fill', labelFillAdapter);
    legend.markers.template.setAll({
      width: LEGEND_MARKER_SIZE,
      height: LEGEND_MARKER_SIZE,
      marginRight: LEGEND_MARKER_TEXT_GAP,
    });
    legend.data.setAll(chart.series.values);

    const hasZoombar = attachAgingCategoryZoombar(
      root,
      chart,
      xAxis,
      chartData.length,
      chartTheme.muted,
    );
    if (hasZoombar) {
      chart.set('paddingBottom', 8);
      if (!hasFixedYDomain) {
        attachAgingYRangeForVisibleCategories(
          root,
          chart,
          xAxis,
          yAxis,
          chartData,
          metrics.map((metric) => metric.key),
        );
      }
    }

    return () => {
      if (rootRef.current) {
        rootRef.current.dispose();
        rootRef.current = null;
      }
    };
  }, [chartData, metrics, valueFormatter, yMin, yMax, theme]);

  return (
    <div ref={chartRef} className={cn(containerClassName, 'text-foreground')} style={containerStyle} />
  );
}
