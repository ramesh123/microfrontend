import * as am5 from '@amcharts/amcharts5';
import * as am5xy from '@amcharts/amcharts5/xy';
import am5themes_Animated from '@amcharts/amcharts5/themes/Animated';

import {
  applyAm5InterfaceTheme,
  probeAmChartThemeColors,
} from '@/pages/charts/components/charts/amChartThemeColors';


export const SIMULATION_CHART_COLORS = {
  telemetry: '#0031a3',
  duration: '#16A34A',
  alerts: '#fc7a1e',
} as const;

export type SimulationAm5Row = {
  category: string;
  total_telemetry_received: number;
  duration_ms: number;
  alerts_created: number;
};

export type SimulationAm5Metric = {
  key: keyof SimulationAm5Row;
  label: string;
  color: string;
  chartType?: 'line' | 'column';
};

export type CreateSimulationTrackAm5ChartOptions = {
  containerId: string;
  data: SimulationAm5Row[];
  metrics: SimulationAm5Metric[];
  categoryField?: keyof SimulationAm5Row;
  xAxisTitle?: string;
};

/** Gap between stacked panels — matches amCharts demo (~40px). */
const Y_AXIS_STACK_GAP = 30;
const Y_AXIS_COLUMN_WIDTH = 52;
const SCROLLBAR_HEIGHT = 12;
const SCROLLBAR_MIN_DATA_POINTS = 7;
const SCROLLBAR_INITIAL_VISIBLE_POINTS = 12;
const CHART_PADDING_BOTTOM_WITH_SCROLLBAR = 20;
const CHART_PADDING_BOTTOM = 8;
const CHART_PADDING_TOP = 12;
const AXIS_STROKE_WIDTH = 1;
const GRID_STROKE_WIDTH = 1;
const GRID_STROKE_OPACITY = 0.5;
const Y_GRID_STROKE_OPACITY = 0.45;

const LINE_METRIC_STYLE: Partial<
  Record<keyof SimulationAm5Row, { strokeWidth: number; symbolRadius: number }>
> = {
  total_telemetry_received: { strokeWidth: 2.5, symbolRadius: 3 },
  duration_ms: { strokeWidth: 2.5, symbolRadius: 3 },
};

function mixHexToward(hex: string, toward: string, amount: number): string {
  const parse = (value: string) => {
    const h = value.replace('#', '');
    return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
  };
  const [r1, g1, b1] = parse(hex);
  const [r2, g2, b2] = parse(toward);
  const mix = (a: number, b: number) => Math.round(a + (b - a) * amount);
  const channel = (n: number) => Math.max(0, Math.min(255, n)).toString(16).padStart(2, '0');
  return `#${channel(mix(r1, r2))}${channel(mix(g1, g2))}${channel(mix(b1, b2))}`;
}

/** Bar fill: soft light top → slightly deeper base (no heavy shadow). */
function createBarLightToDarkGradient(root: am5.Root, baseHex: string): am5.LinearGradient {
  const light = mixHexToward(baseHex, '#ffffff', 0.22);
  const base = mixHexToward(baseHex, '#000000', 0.08);
  return am5.LinearGradient.new(root, {
    rotation: 90,
    stops: [
      { color: am5.color(light), offset: 0 },
      { color: am5.color(base), offset: 1 },
    ],
  });
}

type SimulationChartStrokes = {
  axis: am5.Color;
  grid: am5.Color;
};

function getSimulationChartStrokes(
  theme: ReturnType<typeof probeAmChartThemeColors>,
): SimulationChartStrokes {
  return {
    axis: theme.cardForeground,
    grid: theme.muted,
  };
}

function hexToAm5(hex: string, fallback: am5.Color): am5.Color {
  try {
    return am5.color(hex);
  } catch {
    return fallback;
  }
}

function styleAxisLine(renderer: am5xy.AxisRenderer, stroke: am5.Color): void {
  renderer.setAll({
    stroke,
    strokeOpacity: 1,
    strokeWidth: AXIS_STROKE_WIDTH,
  });
  renderer.labels.template.setAll({ visible: true });
  renderer.ticks.template.setAll({
    visible: true,
    stroke,
    strokeOpacity: 1,
    strokeWidth: 1,
    length: 4,
  });
}

function styleGridLines(
  gridTemplate: am5.Template<am5.Graphics>,
  stroke: am5.Color,
  opacity: number,
): void {
  gridTemplate.setAll({
    stroke,
    strokeOpacity: opacity,
    strokeWidth: GRID_STROKE_WIDTH,
    visible: true,
    forceHidden: false,
  });
}

function styleUniformYRenderer(
  yRenderer: am5xy.AxisRendererY,
  stroke: am5.Color,
  labelColor: am5.Color,
  gridStroke: am5.Color,
  gridOpacity: number,
): void {
  yRenderer.setAll({
    width: Y_AXIS_COLUMN_WIDTH,
    minWidth: Y_AXIS_COLUMN_WIDTH,
    inside: false,
  });
  styleAxisLine(yRenderer, stroke);
  yRenderer.labels.template.setAll({
    fill: labelColor,
    fontSize: 11,
    fontWeight: '500',
    visible: true,
    textAlign: 'right',
    paddingRight: 4,
    width: Y_AXIS_COLUMN_WIDTH - 4,
    oversizedBehavior: 'none',
  });
  styleGridLines(yRenderer.grid.template, gridStroke, gridOpacity);
  yRenderer.grid.template.set('location', 0);
}

function createSeriesTooltip(root: am5.Root, seriesColor: am5.Color): am5.Tooltip {
  const tooltip = am5.Tooltip.new(root, {
    pointerOrientation: 'vertical',
    labelText: '{valueY.formatNumber("#,###")}',
  });
  tooltip.get('background')?.setAll({
    fill: seriesColor,
    fillOpacity: 1,
    stroke: seriesColor,
  });
  tooltip.label?.setAll({
    fill: am5.color(0xffffff),
    fontWeight: '600',
    fontSize: 12,
  });
  return tooltip;
}

function getXAxisDyForPanel(chart: am5xy.XYChart, axisIndex: number): number {
  const axis = chart.yAxes.getIndex(axisIndex);
  if (!axis) return 0;
  const y = axis.y() + axis.height();
  return Math.round(-(chart.plotContainer.height() - y));
}

function moveXAxisToPanel(
  chart: am5xy.XYChart,
  xAxis: am5xy.CategoryAxis<am5xy.AxisRenderer>,
  axisIndex: number,
  animate: boolean,
): void {
  const dy = getXAxisDyForPanel(chart, axisIndex);
  xAxis.set('y', 0);
  if (animate) {
    xAxis.animate({
      key: 'dy',
      to: dy,
      duration: 600,
      easing: am5.ease.out(am5.ease.cubic),
    });
  } else {
    xAxis.set('dy', dy);
  }
}

/** Pin category labels to the bottom panel only (after all Y-axes exist). */
function pinXAxisToBottomPanel(
  root: am5.Root,
  chart: am5xy.XYChart,
  xAxis: am5xy.CategoryAxis<am5xy.AxisRenderer>,
  bottomPanelIndex: number,
  onPinned?: () => void,
): void {
  xAxis.set('layer', 50);

  let didFinish = false;

  const apply = () => {
    if (chart.isDisposed()) return;
    const index = Math.min(
      Math.max(0, bottomPanelIndex),
      Math.max(0, chart.yAxes.length - 1),
    );
    moveXAxisToPanel(chart, xAxis, index, false);
  };

  const finish = () => {
    apply();
    if (didFinish) return;
    didFinish = true;
    onPinned?.();
  };

  xAxis.events.once('datavalidated', finish);
  root.events.once('frameended', apply);
  chart.events.on('boundschanged', apply);
  requestAnimationFrame(apply);
}

function createStackedSeries(
  root: am5.Root,
  chart: am5xy.XYChart,
  xAxis: am5xy.CategoryAxis<am5xy.AxisRenderer>,
  data: SimulationAm5Row[],
  metric: SimulationAm5Metric,
  index: number,
  categoryField: keyof SimulationAm5Row,
  theme: ReturnType<typeof probeAmChartThemeColors>,
  strokes: SimulationChartStrokes,
): void {
  const seriesColor = hexToAm5(metric.color, theme.cardForeground);
  const isColumn = metric.chartType === 'column';
  const lineStyle = LINE_METRIC_STYLE[metric.key] ?? {
    strokeWidth: 2,
    symbolRadius: 2.5,
  };
  const yRenderer = am5xy.AxisRendererY.new(root, {
    minGridDistance: 20,
  });
  styleUniformYRenderer(
    yRenderer,
    strokes.axis,
    seriesColor,
    strokes.grid,
    isColumn ? GRID_STROKE_OPACITY : Y_GRID_STROKE_OPACITY,
  );

  const yAxis = chart.yAxes.push(
    am5xy.ValueAxis.new(root, {
      renderer: yRenderer,
      min: 0,
      strictMinMax: false,
      extraMin: 0,
      extraMax: 0.45,
      numberFormat: '#,###',
      tooltip: null,
      x: 0,
      centerX: 0,
      width: Y_AXIS_COLUMN_WIDTH,
      marginTop: index === 0 ? 4 : Y_AXIS_STACK_GAP,
    }),
  );

  const tooltip = createSeriesTooltip(root, seriesColor);

  if (isColumn) {
    const series = chart.series.push(
      am5xy.ColumnSeries.new(root, {
        xAxis,
        yAxis,
        valueYField: metric.key,
        categoryXField: categoryField,
        name: metric.label,
        fill: seriesColor,
        stroke: seriesColor,
        tooltip,
      }),
    );

    series.set('layer', 10);
    series.columns.template.setAll({
      width: am5.percent(68),
      fillOpacity: 1,
      strokeOpacity: 0,
      fillGradient: createBarLightToDarkGradient(root, metric.color),
      cornerRadiusTL: 4,
      cornerRadiusTR: 4,
      cornerRadiusBL: 0,
      cornerRadiusBR: 0,
    });

    // Value labels above bars with opaque background to avoid grid overlap
    series.bullets.push(() =>
      am5.Bullet.new(root, {
        locationY: 1,
        sprite: am5.Label.new(root, {
          text: '{valueY.formatNumber("#,###")}',
          fill: seriesColor,
          fontSize: 10,
          fontWeight: '600',
          centerX: am5.p50,
          centerY: am5.percent(100),
          paddingTop: 2,
          paddingBottom: 4,
          paddingLeft: 3,
          paddingRight: 3,
          background: am5.Rectangle.new(root, {
            fill: theme.card,
            fillOpacity: 1,
          }),
          populateText: true,
        }),
      }),
    );

    series.data.setAll(data);
    series.appear();
    return;
  }

  const series = chart.series.push(
    am5xy.LineSeries.new(root, {
      xAxis,
      yAxis,
      valueYField: metric.key,
      categoryXField: categoryField,
      sequencedInterpolation: true,
      name: metric.label,
      stroke: seriesColor,
      fill: seriesColor,
      tooltip,
    }),
  );

  series.strokes.template.setAll({
    strokeWidth: lineStyle.strokeWidth,
    stroke: seriesColor,
  });

  series.fills.template.setAll({ visible: false });

  series.bullets.push(() =>
    am5.Bullet.new(root, {
      locationY: 1,
      locationX: 0.5,
      sprite: am5.Circle.new(root, {
        radius: lineStyle.symbolRadius,
        fill: seriesColor,
        stroke: am5.color(0xffffff),
        strokeWidth: 2,
      }),
    }),
  );

  // Value label above each point with opaque background to avoid grid overlap
  series.bullets.push(() =>
    am5.Bullet.new(root, {
      locationY: 1,
      locationX: 0.5,
      sprite: am5.Label.new(root, {
        text: '{valueY.formatNumber("#,###")}',
        fill: seriesColor,
        fontSize: 10,
        fontWeight: '600',
        centerX: am5.p50,
        centerY: am5.percent(100),
        dy: -(lineStyle.symbolRadius + 6),
        paddingTop: 2,
        paddingBottom: 2,
        paddingLeft: 3,
        paddingRight: 3,
        background: am5.Rectangle.new(root, {
          fill: theme.card,
          fillOpacity: 1,
        }),
        populateText: true,
      }),
    }),
  );

  series.data.setAll(data);
  series.appear();
}

function disposeExistingRootOnContainer(containerId: string): void {
  const existing = am5.registry.rootElements.find((r) => r.dom?.id === containerId);
  if (!existing) return;
  try {
    existing.dispose();
  } catch {
    /* ignore */
  }
}

export function createSimulationTrackAm5Chart({
  containerId,
  data,
  metrics,
  categoryField = 'category',
  xAxisTitle = 'Listener started',
}: CreateSimulationTrackAm5ChartOptions): am5.Root {
  disposeExistingRootOnContainer(containerId);
  const root = am5.Root.new(containerId);
  root.setThemes([am5themes_Animated.new(root)]);
  root._logo?.dispose();

  const theme = probeAmChartThemeColors();
  applyAm5InterfaceTheme(root, theme);
  const strokes = getSimulationChartStrokes(theme);

  const needsScrollbar = data.length > SCROLLBAR_MIN_DATA_POINTS;

  const chart = root.container.children.push(
    am5xy.XYChart.new(root, {
      panX: true,
      panY: false,
      wheelX: 'panX',
      wheelY: 'none',
      pinchZoomX: true,
      arrangeTooltips: false,
      paddingTop: CHART_PADDING_TOP,
      paddingBottom: needsScrollbar ? CHART_PADDING_BOTTOM_WITH_SCROLLBAR : CHART_PADDING_BOTTOM,
      paddingLeft: 0,
      paddingRight: 4,
    }),
  );

  chart.set(
    'background',
    am5.Rectangle.new(root, {
      fill: theme.card,
      fillOpacity: 1,
    }),
  );

  chart.leftAxesContainer.setAll({
    layout: root.verticalLayout,
    width: Y_AXIS_COLUMN_WIDTH,
  });

  const xRenderer = am5xy.AxisRendererX.new(root, {
    minGridDistance: 70,
    cellStartLocation: 0.1,
    cellEndLocation: 0.9,
  });
  styleAxisLine(xRenderer, strokes.axis);
  xRenderer.labels.template.setAll({
    multiLocation: 0.5,
    location: 0.5,
    centerY: am5.p50,
    centerX: am5.p50,
    paddingTop: 10,
    fill: strokes.axis,
    fontSize: 11,
    fontWeight: '500',
    visible: true,
  });
  styleGridLines(xRenderer.grid.template, strokes.grid, GRID_STROKE_OPACITY);
  xRenderer.grid.template.set('location', 0.5);

  const xAxisTooltip = am5.Tooltip.new(root, {
    labelText: '{category}',
  });
  xAxisTooltip.get('background')?.setAll({
    fill: am5.color(0x000000),
    fillOpacity: 1,
    stroke: am5.color(0x000000),
  });
  xAxisTooltip.label?.setAll({
    fill: am5.color(0xffffff),
    fontWeight: '600',
  });

  const xAxis = chart.xAxes.push(
    am5xy.CategoryAxis.new(root, {
      categoryField,
      tooltip: xAxisTooltip,
      renderer: xRenderer,
    }),
  );

  const xAxisTitleLabel = am5.Label.new(root, {
    text: xAxisTitle,
    x: am5.p50,
    centerX: am5.p50,
    marginTop: 2,
    marginBottom: 4,
    fill: strokes.axis,
    fontSize: 11,
    fontWeight: '600',
  });

  chart.bottomAxesContainer.set('layout', root.verticalLayout);
  chart.bottomAxesContainer.children.push(xAxisTitleLabel);

  xAxis.data.setAll(data);

  metrics.forEach((metric, index) => {
    createStackedSeries(root, chart, xAxis, data, metric, index, categoryField, theme, strokes);
  });

  const bottomPanelIndex = Math.max(0, metrics.length - 1);

  const cursor = chart.set(
    'cursor',
    am5xy.XYCursor.new(root, {
      behavior: 'none',
      xAxis,
    }),
  );
  cursor.lineY.set('visible', false);
  cursor.lineX.setAll({
    stroke: strokes.axis,
    strokeOpacity: 0.55,
    strokeDasharray: [4, 4],
  });

  pinXAxisToBottomPanel(root, chart, xAxis, bottomPanelIndex, () => {
    if (!needsScrollbar) return;
    xAxis.zoomToIndexes(
      0,
      Math.min(SCROLLBAR_INITIAL_VISIBLE_POINTS - 1, data.length - 1),
    );
  });

  if (needsScrollbar) {
    const endFrac = Math.min(1, SCROLLBAR_INITIAL_VISIBLE_POINTS / data.length);
    const scrollbarX = am5.Scrollbar.new(root, {
      orientation: 'horizontal',
      marginTop: 0,
      marginBottom: 2,
      minHeight: SCROLLBAR_HEIGHT,
      height: SCROLLBAR_HEIGHT,
      start: 0,
      end: endFrac,
    });
    chart.bottomAxesContainer.children.push(scrollbarX);
    chart.set('scrollbarX', scrollbarX);

    scrollbarX.thumb.setAll({
      fill: theme.muted,
      fillOpacity: 0.5,
      cornerRadiusTL: 4,
      cornerRadiusTR: 4,
      cornerRadiusBL: 4,
      cornerRadiusBR: 4,
    });
    scrollbarX.startGrip.setAll({ scale: 0.45 });
    scrollbarX.endGrip.setAll({ scale: 0.45 });
    scrollbarX.get('background')?.setAll({
      fill: theme.border,
      fillOpacity: 0.25,
    });
  }

  chart.appear(800, 100);
  return root;
}

export function disposeAm5Root(root: am5.Root | null | undefined): void {
  if (!root) return;
  try {
    root.dispose();
  } catch {
    /* ignore */
  }
}