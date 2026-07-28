import { useEffect, useRef } from 'react';
import * as am5 from '@amcharts/amcharts5';
import * as am5xy from '@amcharts/amcharts5/xy';
import * as am5percent from '@amcharts/amcharts5/percent';
import am5themes_Animated from '@amcharts/amcharts5/themes/Animated';
import { useTheme } from '@/context/theme';
import type { AskChartType } from '@/controllers/API/askApi';

interface AskChartProps {
  chartType: AskChartType;
  data: Array<{ value: number; category: string }>;
}

const CHART_COLORS = [
  0x3182bd, 0xe6550d, 0x31a354, 0x756bb1,
  0x636363, 0x6baed6, 0xfd8d3c, 0x74c476,
  0x9e9ac8, 0x969696, 0x9ecae1, 0xfdae6b,
  0xa1d99b, 0xbcbddc, 0xbdbdbd,
];

export default function AskChart({ chartType, data }: AskChartProps) {
  const chartRef = useRef<HTMLDivElement>(null);
  const rootRef = useRef<am5.Root | null>(null);
  const { theme } = useTheme();
  const isDark = theme === 'dark' || theme === 'blue-dark' || theme === 'blue-dark-g' || theme === 'purple-dark' || theme === 'orange-dark';

  useEffect(() => {
    if (rootRef.current) {
      try { rootRef.current.dispose(); } catch {}
      rootRef.current = null;
    }

    if (!chartRef.current || !data || data.length === 0) return;

    const root = am5.Root.new(chartRef.current);
    root.setThemes([am5themes_Animated.new(root)]);
    root._logo?.dispose();
    rootRef.current = root;

    const labelColor = isDark ? am5.color(0xcccccc) : am5.color(0x555555);

    if (chartType === 'pie') {
      createPieChart(root, data, labelColor);
    } else if (chartType === 'line') {
      createLineChart(root, data, labelColor, isDark);
    } else {
      createBarChart(root, data, labelColor, isDark);
    }

    return () => {
      if (rootRef.current) {
        try { rootRef.current.dispose(); } catch {}
        rootRef.current = null;
      }
    };
  }, [chartType, data, theme]);

  return (
    <div
      ref={chartRef}
      style={{ width: '100%', height: '400px' }}
    />
  );
}

function createBarChart(
  root: am5.Root,
  data: Array<{ value: number; category: string }>,
  labelColor: am5.Color,
  isDark: boolean
) {
  const chart = root.container.children.push(
    am5xy.XYChart.new(root, {
      panX: true,
      panY: false,
      wheelX: 'panX',
      wheelY: 'none',
      layout: root.verticalLayout,
      paddingBottom: 20,
    })
  );

  const xAxis = chart.xAxes.push(
    am5xy.CategoryAxis.new(root, {
      categoryField: 'category',
      renderer: am5xy.AxisRendererX.new(root, {
        minGridDistance: 30,
        cellStartLocation: 0.1,
        cellEndLocation: 0.9,
      }),
      tooltip: am5.Tooltip.new(root, {}),
    })
  );

  xAxis.get('renderer').labels.template.setAll({
    rotation: data.length > 6 ? -45 : 0,
    centerY: am5.p50,
    centerX: data.length > 6 ? am5.p100 : am5.p50,
    paddingTop: 8,
    fontSize: 11,
    fill: labelColor,
    maxWidth: 120,
    oversizedBehavior: 'truncate',
  });

  xAxis.data.setAll(data);

  const yAxis = chart.yAxes.push(
    am5xy.ValueAxis.new(root, {
      min: 0,
      renderer: am5xy.AxisRendererY.new(root, {}),
    })
  );

  yAxis.set('numberFormat', "#,###.##");
  yAxis.get('renderer').labels.template.setAll({
    fontSize: 11,
    fill: labelColor,
  });

  const series = chart.series.push(
    am5xy.ColumnSeries.new(root, {
      name: 'Value',
      xAxis,
      yAxis,
      valueYField: 'value',
      categoryXField: 'category',
      tooltip: am5.Tooltip.new(root, {
        labelText: "[fontSize:11px]{category}: {valueY.formatNumber('#,###.##')}",
        pointerOrientation: 'horizontal',
      }),
    })
  );

  series.columns.template.setAll({
    cornerRadiusTL: 4,
    cornerRadiusTR: 4,
    strokeOpacity: 0,
    fillOpacity: 0.85,
    width: am5.percent(70),
  });

  // Assign colors per bar
  series.columns.template.adapters.add('fill', (_fill, target) => {
    const idx = series.columns.indexOf(target);
    return am5.color(CHART_COLORS[idx % CHART_COLORS.length]);
  });
  series.columns.template.adapters.add('stroke', (_stroke, target) => {
    const idx = series.columns.indexOf(target);
    return am5.color(CHART_COLORS[idx % CHART_COLORS.length]);
  });

  // Value labels on top of bars
  series.bullets.push(() => {
    return am5.Bullet.new(root, {
      locationY: 1,
      sprite: am5.Label.new(root, {
        text: "{valueY.formatNumber('#,###.##')}",
        centerX: am5.p50,
        centerY: am5.p100,
        populateText: true,
        fontSize: 10,
        fill: labelColor,
        dy: -5,
      }),
    });
  });

  series.data.setAll(data);

  // Cursor
  chart.set('cursor', am5xy.XYCursor.new(root, { behavior: 'none', xAxis, yAxis }));

  // Scrollbar for many items
  if (data.length > 10) {
    const scrollbar = am5.Scrollbar.new(root, {
      orientation: 'horizontal',
      marginBottom: 8,
      minHeight: 10,
    });
    chart.set('scrollbarX', scrollbar);
    chart.bottomAxesContainer.children.push(scrollbar);

    scrollbar.thumb.setAll({ fillOpacity: 0.2 });

    xAxis.events.once('datavalidated', () => {
      xAxis.zoomToIndexes(0, 10);
    });
  }

  series.appear(1000);
  chart.appear(1000, 100);
}

function createLineChart(
  root: am5.Root,
  data: Array<{ value: number; category: string }>,
  labelColor: am5.Color,
  isDark: boolean
) {
  const chart = root.container.children.push(
    am5xy.XYChart.new(root, {
      panX: true,
      panY: false,
      wheelX: 'panX',
      wheelY: 'none',
      layout: root.verticalLayout,
    })
  );

  const xAxis = chart.xAxes.push(
    am5xy.CategoryAxis.new(root, {
      categoryField: 'category',
      renderer: am5xy.AxisRendererX.new(root, { minGridDistance: 30 }),
      tooltip: am5.Tooltip.new(root, {}),
    })
  );

  xAxis.get('renderer').labels.template.setAll({
    rotation: data.length > 6 ? -45 : 0,
    centerY: am5.p50,
    centerX: data.length > 6 ? am5.p100 : am5.p50,
    fontSize: 11,
    fill: labelColor,
    maxWidth: 120,
    oversizedBehavior: 'truncate',
  });

  xAxis.data.setAll(data);

  const yAxis = chart.yAxes.push(
    am5xy.ValueAxis.new(root, {
      min: 0,
      renderer: am5xy.AxisRendererY.new(root, {}),
    })
  );

  yAxis.set('numberFormat', "#,###.##");
  yAxis.get('renderer').labels.template.setAll({
    fontSize: 11,
    fill: labelColor,
  });

  const series = chart.series.push(
    am5xy.LineSeries.new(root, {
      name: 'Value',
      xAxis,
      yAxis,
      valueYField: 'value',
      categoryXField: 'category',
      tooltip: am5.Tooltip.new(root, {
        labelText: "[fontSize:11px]{category}: {valueY.formatNumber('#,###.##')}",
      }),
    })
  );

  series.strokes.template.setAll({
    strokeWidth: 2,
    stroke: am5.color(CHART_COLORS[0]),
  });

  // Circle bullets at each data point
  series.bullets.push(() => {
    return am5.Bullet.new(root, {
      sprite: am5.Circle.new(root, {
        radius: 5,
        fill: am5.color(CHART_COLORS[0]),
        stroke: am5.color(isDark ? 0x1a1d23 : 0xffffff),
        strokeWidth: 2,
      }),
    });
  });

  series.data.setAll(data);

  // Cursor
  chart.set('cursor', am5xy.XYCursor.new(root, {
    behavior: 'none',
    xAxis,
    yAxis,
  }));

  // Scrollbar for many items
  if (data.length > 10) {
    const scrollbar = am5.Scrollbar.new(root, {
      orientation: 'horizontal',
      marginBottom: 8,
      minHeight: 10,
    });
    chart.set('scrollbarX', scrollbar);
    chart.bottomAxesContainer.children.push(scrollbar);
    scrollbar.thumb.setAll({ fillOpacity: 0.2 });

    xAxis.events.once('datavalidated', () => {
      xAxis.zoomToIndexes(0, 10);
    });
  }

  series.appear(1000);
  chart.appear(1000, 100);
}

function createPieChart(
  root: am5.Root,
  data: Array<{ value: number; category: string }>,
  labelColor: am5.Color,
) {
  const chart = root.container.children.push(
    am5percent.PieChart.new(root, {
      layout: root.verticalLayout,
      innerRadius: am5.percent(40),
    })
  );

  const series = chart.series.push(
    am5percent.PieSeries.new(root, {
      valueField: 'value',
      categoryField: 'category',
      endAngle: 270,
    })
  );

  // Custom colors
  series.get('colors')?.set('colors', CHART_COLORS.map(c => am5.color(c)));

  series.slices.template.setAll({
    strokeWidth: 2,
    stroke: am5.color(0xffffff),
    tooltipText: "[fontSize:11px]{category}: {value.formatNumber('#,###.##')}",
  });

  series.labels.template.setAll({
    text: '{category}',
    fontSize: 11,
    fill: labelColor,
    radius: 10,
  });

  series.ticks.template.setAll({
    stroke: labelColor,
    strokeOpacity: 0.5,
  });

  series.data.setAll(data);

  // Legend
  const legend = chart.children.push(
    am5.Legend.new(root, {
      centerX: am5.p50,
      x: am5.p50,
      layout: root.horizontalLayout,
      marginTop: 10,
    })
  );

  legend.labels.template.setAll({
    fontSize: 11,
    fill: labelColor,
  });

  legend.markers.template.setAll({
    width: 14,
    height: 14,
  });

  legend.data.setAll(series.dataItems);

  series.appear(1000);
  chart.appear(1000, 100);
}
