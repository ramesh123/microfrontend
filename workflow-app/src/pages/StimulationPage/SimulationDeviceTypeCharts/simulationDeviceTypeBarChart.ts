import * as am5 from '@amcharts/amcharts5';
import * as am5xy from '@amcharts/amcharts5/xy';
import am5themes_Animated from '@amcharts/amcharts5/themes/Animated';

import {
  applyAm5InterfaceTheme,
  probeAmChartThemeColors,
} from '@/pages/charts/components/charts/amChartThemeColors';

import type { SimulationDeviceTypeBarChartItem } from '@/controllers/API/simulationTrackApi';

const BAR_COLOR = '#0031a3';

export type DeviceTypeBarChartRow = {
  device_type: string;
  alert_count: number;
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

function createBarGradient(root: am5.Root, baseHex: string): am5.LinearGradient {
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

export function toDeviceTypeBarChartRows(
  items: SimulationDeviceTypeBarChartItem[],
): DeviceTypeBarChartRow[] {
  return [...items]
    .sort((a, b) => b.alert_count - a.alert_count)
    .map((item) => ({
      device_type: item.device_type,
      alert_count: item.alert_count,
    }));
}

export function createDeviceTypeBarChart(
  containerId: string,
  data: DeviceTypeBarChartRow[],
): am5.Root {
  const root = am5.Root.new(containerId);
  root.setThemes([am5themes_Animated.new(root)]);
  root._logo?.dispose();

  const theme = probeAmChartThemeColors();
  applyAm5InterfaceTheme(root, theme);
  const seriesColor = am5.color(BAR_COLOR);

  const chart = root.container.children.push(
    am5xy.XYChart.new(root, {
      panX: false,
      panY: false,
      wheelX: 'none',
      wheelY: 'none',
      paddingTop: 8,
      paddingBottom: 8,
      paddingLeft: 0,
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
    cellStartLocation: 0.1,
    cellEndLocation: 0.9,
  });
  xRenderer.labels.template.setAll({
    fill: theme.cardForeground,
    fontSize: 10,
    fontWeight: '500',
    oversizedBehavior: 'truncate',
    maxWidth: 72,
    textAlign: 'center',
    rotation: data.length > 6 ? -35 : 0,
  });
  xRenderer.grid.template.setAll({
    stroke: theme.muted,
    strokeOpacity: 0.35,
    visible: true,
  });

  const xAxis = chart.xAxes.push(
    am5xy.CategoryAxis.new(root, {
      categoryField: 'device_type',
      renderer: xRenderer,
    }),
  );
  xAxis.data.setAll(data);

  const yRenderer = am5xy.AxisRendererY.new(root, {});
  yRenderer.labels.template.setAll({
    fill: theme.cardForeground,
    fontSize: 11,
    fontWeight: '500',
  });
  yRenderer.grid.template.setAll({
    stroke: theme.muted,
    strokeOpacity: 0.45,
    visible: true,
  });

  const yAxis = chart.yAxes.push(
    am5xy.ValueAxis.new(root, {
      renderer: yRenderer,
      min: 0,
      numberFormat: '#,###',
    }),
  );

  const tooltip = am5.Tooltip.new(root, {
    labelText: '{categoryX}: {valueY.formatNumber("#,###")}',
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

  const series = chart.series.push(
    am5xy.ColumnSeries.new(root, {
      xAxis,
      yAxis,
      valueYField: 'alert_count',
      categoryXField: 'device_type',
      fill: seriesColor,
      stroke: seriesColor,
      tooltip,
    }),
  );

  series.columns.template.setAll({
    width: am5.percent(68),
    fillOpacity: 1,
    strokeOpacity: 0,
    fillGradient: createBarGradient(root, BAR_COLOR),
    cornerRadiusTL: 4,
    cornerRadiusTR: 4,
  });

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
        populateText: true,
      }),
    }),
  );

  series.data.setAll(data);
  series.appear();
  chart.appear(600, 100);

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
