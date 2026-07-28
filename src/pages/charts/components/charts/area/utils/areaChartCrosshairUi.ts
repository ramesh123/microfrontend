import type * as am5 from '@amcharts/amcharts5';
import * as am5xy from '@amcharts/amcharts5/xy';

type Am5Module = typeof import('@amcharts/amcharts5');

import { resolveCartesianCurveStyle } from '../../cartesian/customize/cartesianCurveStyleUi';

export function resolveAreaCurveStyle(options: {
  areaCurveStyle?: 'smooth' | 'linear';
  areaFillStyle?: 'gradient' | 'columnar';
}): 'smooth' | 'linear' {
  return resolveCartesianCurveStyle(options, 'areaCurveStyle');
}

export function createAreaCategoryAxisTooltip(
  root: am5.Root,
  am5lib: Am5Module,
  foregroundColor: am5.Color,
  cardBg: am5.Color,
  borderColor: am5.Color,
) {
  const tooltip = am5lib.Tooltip.new(root, {
    labelText: '{category}',
    pointerOrientation: 'down',
  });
  tooltip.get('background')?.setAll({
    fill: cardBg,
    fillOpacity: 1,
    stroke: borderColor,
    strokeOpacity: 0.55,
    strokeWidth: 1,
    cornerRadiusTL: 6,
    cornerRadiusTR: 6,
    cornerRadiusBL: 6,
    cornerRadiusBR: 6,
  } as any);
  tooltip.label?.setAll({
    fill: foregroundColor,
    fontSize: 11,
    fontWeight: '600',
    paddingTop: 4,
    paddingBottom: 4,
    paddingLeft: 8,
    paddingRight: 8,
  });
  tooltip.set('dy', -6);
  return tooltip;
}

type AttachAreaCrosshairUiArgs = {
  root: am5.Root;
  am5lib: Am5Module;
  chart: am5xy.XYChart;
  xAxis: am5xy.CategoryAxis<am5xy.AxisRenderer>;
  yAxis: am5xy.ValueAxis<am5xy.AxisRenderer>;
  primarySeries: am5xy.SmoothedXLineSeries | am5xy.LineSeries;
  primaryField: string;
  categoryField: string;
  seriesColor: am5.Color;
  foregroundColor: am5.Color;
  cardBg: am5.Color;
  borderColor: am5.Color;
  formatValue: (value: number) => string;
  allRows: Array<Record<string, unknown>>;
};

export function attachAreaChartCrosshairUi({
  root,
  am5lib,
  chart,
  xAxis,
  primarySeries,
  primaryField,
  categoryField,
  seriesColor,
  foregroundColor,
  cardBg,
  borderColor,
  formatValue,
  allRows,
}: AttachAreaCrosshairUiArgs) {
  const summaryLabel = chart.plotContainer.children.push(
    am5lib.Label.new(root, {
      x: 10,
      y: 10,
      visible: false,
      populateText: true,
      paddingTop: 6,
      paddingBottom: 6,
      paddingLeft: 10,
      paddingRight: 10,
      background: am5lib.RoundedRectangle.new(root, {
        fill: cardBg,
        fillOpacity: 0.97,
        stroke: borderColor,
        strokeOpacity: 0.45,
        strokeWidth: 1,
        cornerRadiusTL: 8,
        cornerRadiusTR: 8,
        cornerRadiusBL: 8,
        cornerRadiusBR: 8,
      }),
    }),
  );

  const cursorMarker = chart.plotContainer.children.push(
    am5lib.Circle.new(root, {
      radius: 5,
      fill: seriesColor,
      stroke: cardBg,
      strokeWidth: 2,
      visible: false,
      centerX: am5lib.p50,
      centerY: am5lib.p50,
    }),
  );

  const positiveColor = am5lib.color(0x16a34a);
  const negativeColor = am5lib.color(0xdc2626);

  const updateFromDataItem = (dataItem: unknown) => {
    if (!dataItem || typeof dataItem !== 'object') {
      summaryLabel.set('visible', false);
      cursorMarker.set('visible', false);
      return;
    }

    const di = dataItem as {
      dataContext?: Record<string, unknown>;
      get?: (key: string) => unknown;
    };
    const ctx = di.dataContext ?? {};
    const category = String(ctx[categoryField] ?? di.get?.('categoryX') ?? '');
    const value = Number(ctx[primaryField] ?? di.get?.('valueY'));
    if (!Number.isFinite(value)) {
      summaryLabel.set('visible', false);
      cursorMarker.set('visible', false);
      return;
    }

    const rowIndex = allRows.findIndex((row) => String(row[categoryField] ?? '') === category);
    const prevValue =
      rowIndex > 0 ? Number(allRows[rowIndex - 1]?.[primaryField]) : Number.NaN;
    let pctChange: number | null = null;
    if (Number.isFinite(prevValue) && prevValue !== 0) {
      pctChange = ((value - prevValue) / Math.abs(prevValue)) * 100;
    }

    const changeSuffix =
      pctChange == null ? '' : ` (${pctChange > 0 ? '+' : ''}${pctChange.toFixed(2)}%)`;

    summaryLabel.set('visible', true);
    summaryLabel.set('text', `${primaryField}: ${formatValue(value)}${changeSuffix}`);
    summaryLabel.set(
      'fill',
      pctChange == null
        ? foregroundColor
        : pctChange < 0
          ? negativeColor
          : pctChange > 0
            ? positiveColor
            : foregroundColor,
    );

    try {
      const point = (di as { get?: (key: string) => { x?: number; y?: number } }).get?.('point');
      if (point && Number.isFinite(point.x) && Number.isFinite(point.y)) {
        cursorMarker.setAll({
          visible: true,
          x: point.x,
          y: point.y,
        });
      } else {
        cursorMarker.set('visible', false);
      }
    } catch {
      cursorMarker.set('visible', false);
    }
  };

  const cursor = chart.get('cursor');
  if (!cursor) return;

  cursor.events.on('cursormoved', () => {
    try {
      const snapItem = (cursor as unknown as { getPrivate?: (key: string) => unknown }).getPrivate?.(
        'snapDataItem',
      );
      if (snapItem) {
        updateFromDataItem(snapItem);
        return;
      }
      const seriesItem = (xAxis as am5xy.CategoryAxis<am5xy.AxisRenderer> & {
        getSeriesItem: (series: am5xy.XYSeries, field: string) => unknown;
      }).getSeriesItem(primarySeries, 'categoryX');
      updateFromDataItem(seriesItem);
    } catch {
      summaryLabel.set('visible', false);
      cursorMarker.set('visible', false);
    }
  });
}

export function attachAreaChartCursor(
  chart: am5xy.XYChart,
  root: am5.Root,
  am5lib: Am5Module,
  xAxis: am5xy.CategoryAxis<am5xy.AxisRenderer>,
  yAxis: am5xy.ValueAxis<am5xy.AxisRenderer>,
  lineSeriesArray: Array<am5xy.SmoothedXLineSeries | am5xy.LineSeries>,
  borderColor: am5.Color,
) {
  if (lineSeriesArray.length === 0) return;

  chart.set(
    'cursor',
    am5xy.XYCursor.new(root, {
      xAxis,
      yAxis,
      snapToSeries: lineSeriesArray,
      behavior: 'none',
    }),
  );

  const cursor = chart.get('cursor');
  if (!cursor) return;

  cursor.lineX?.setAll({
    visible: true,
    stroke: borderColor,
    strokeOpacity: 0.65,
    strokeDasharray: [4, 4],
  });
  cursor.lineY?.setAll({ visible: false });
}
