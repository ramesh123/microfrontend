import * as am5 from '@amcharts/amcharts5';
import * as am5xy from '@amcharts/amcharts5/xy';
import am5themes_Animated from '@amcharts/amcharts5/themes/Animated';

import type { DeviceTypeBarChartItem } from '@/controllers/API/simulationTrackApi';
import {
  applyAm5InterfaceTheme,
  probeAmChartThemeColors,
} from '@/pages/charts/components/charts/amChartThemeColors';

import { formatDeviceTypeChartCategory } from '../simulationTrackDashboardUtils';

import { disposeAm5Root } from './simulationTrackAm5Chart';

export type DeviceTypeBarRow = {
  category: string;
  value: number;
};

/** Light blue bars for alerts-by-device-type chart. */
const BAR_COLOR = '#60a5fa';
const BAR_COLOR_DARK = '#3b82f6';
const LABEL_COLOR = '#1d4ed8';
const X_AXIS_TITLE = 'Device type';
const Y_AXIS_TITLE = 'Alert count';

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

function createBarGradient(root: am5.Root): am5.LinearGradient {
  const light = mixHexToward(BAR_COLOR, '#ffffff', 0.35);
  const mid = mixHexToward(BAR_COLOR, '#ffffff', 0.12);
  const base = mixHexToward(BAR_COLOR_DARK, '#ffffff', 0.05);
  return am5.LinearGradient.new(root, {
    rotation: 90,
    stops: [
      { color: am5.color(light), offset: 0 },
      { color: am5.color(mid), offset: 0.5 },
      { color: am5.color(base), offset: 1 },
    ],
  });
}

function hexToAm5(hex: string, fallback: am5.Color): am5.Color {
  const normalized = hex.replace('#', '').trim();
  if (normalized.length !== 6) return fallback;
  const n = Number.parseInt(normalized, 16);
  return Number.isFinite(n) ? am5.color(n) : fallback;
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

export function createDeviceTypeBarAm5Chart(
  containerId: string,
  items: DeviceTypeBarChartItem[],
): am5.Root {
  disposeExistingRootOnContainer(containerId);
  const root = am5.Root.new(containerId);
  root.setThemes([am5themes_Animated.new(root)]);
  root._logo?.dispose();

  const theme = probeAmChartThemeColors();
  applyAm5InterfaceTheme(root, theme);
  const seriesColor = hexToAm5(BAR_COLOR, theme.cardForeground);
  const labelColor = hexToAm5(LABEL_COLOR, theme.cardForeground);
  const barGradient = createBarGradient(root);

  const data: DeviceTypeBarRow[] = [...items]
    .map((item) => ({
      category: item.device_type,
      value: item.alert_count,
    }))
    .sort((a, b) => b.value - a.value);

  const chart = root.container.children.push(
    am5xy.XYChart.new(root, {
      panX: false,
      panY: false,
      wheelX: 'none',
      wheelY: 'none',
      layout: root.verticalLayout,
      paddingTop: 6,
      paddingBottom: 22,
      paddingLeft: 2,
      paddingRight: 8,
    }),
  );

  chart.set(
    'background',
    am5.Rectangle.new(root, {
      fill: theme.card,
      fillOpacity: 1,
    }),
  );

  const xRenderer = am5xy.AxisRendererX.new(root, {
    minGridDistance: 40,
    cellStartLocation: 0.15,
    cellEndLocation: 0.85,
  });
  xRenderer.labels.template.setAll({
    rotation: 0,
    centerY: am5.p0,
    centerX: am5.p50,
    paddingTop: 4,
    fill: theme.cardForeground,
    fontSize: 11,
    fontWeight: '500',
    textAlign: 'center',
    oversizedBehavior: 'wrap',
    maxWidth: 72,
  });
  xRenderer.grid.template.setAll({ visible: false });

  const xAxis = chart.xAxes.push(
    am5xy.CategoryAxis.new(root, {
      categoryField: 'category',
      renderer: xRenderer,
    }),
  );
  xAxis.data.setAll(data);

  const yRenderer = am5xy.AxisRendererY.new(root, { minGridDistance: 24 });
  yRenderer.labels.template.setAll({
    fill: theme.cardForeground,
    fontSize: 12,
    fontWeight: '500',
  });
  yRenderer.grid.template.setAll({
    stroke: theme.border,
    strokeOpacity: 0.4,
  });

  const yAxis = chart.yAxes.push(
    am5xy.ValueAxis.new(root, {
      renderer: yRenderer,
      min: 0,
      numberFormat: '#,###',
    }),
  );

  const series = chart.series.push(
    am5xy.ColumnSeries.new(root, {
      name: Y_AXIS_TITLE,
      xAxis,
      yAxis,
      valueYField: 'value',
      categoryXField: 'category',
      fill: seriesColor,
      stroke: seriesColor,
      tooltip: null,
    }),
  );

  series.columns.template.setAll({
    width: am5.percent(68),
    cornerRadiusTL: 5,
    cornerRadiusTR: 5,
    strokeOpacity: 0,
    fillOpacity: 1,
    fillGradient: barGradient,
    interactive: false,
  });

  series.bullets.push(() =>
    am5.Bullet.new(root, {
      locationY: 1,
      sprite: am5.Label.new(root, {
        text: '{valueY.formatNumber("#,###")}',
        fill: labelColor,
        fontSize: 11,
        fontWeight: '600',
        centerX: am5.p50,
        centerY: am5.percent(100),
        dy: -2,
        populateText: true,
      }),
    }),
  );

  const xAxisTitle = am5.Label.new(root, {
    text: X_AXIS_TITLE,
    x: am5.p50,
    centerX: am5.p50,
    paddingTop: 0,
    fill: theme.muted,
    fontSize: 11,
    fontWeight: '600',
  });
  chart.bottomAxesContainer.children.push(xAxisTitle);

  const yAxisTitle = am5.Label.new(root, {
    text: Y_AXIS_TITLE,
    rotation: -90,
    y: am5.p50,
    centerY: am5.p50,
    centerX: am5.p50,
    fill: theme.muted,
    fontSize: 11,
    fontWeight: '600',
  });
  chart.leftAxesContainer.children.unshift(yAxisTitle);

  series.data.setAll(data);
  series.appear(700);
  chart.appear(700, 100);

  return root;
}

export { disposeAm5Root };
