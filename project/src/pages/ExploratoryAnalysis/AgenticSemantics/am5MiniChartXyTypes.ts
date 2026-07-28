import type { ChartDetail } from "./chartTypes";
import type { ChartDomScrollLegendItem } from "@/pages/charts/components/charts/ChartDomScrollLegend";

/** Shared state for amCharts 5 XY charts (bar vs line) after axis setup. */
export interface Am5XyChartContext {
  root: any;
  am5: typeof import("@amcharts/amcharts5");
  am5xy: typeof import("@amcharts/amcharts5/xy");
  chart: any;
  xAxis: any;
  yAxis: any;
  detail: ChartDetail;
  rawData: Record<string, unknown>[];
  chartType: string;
  isDark: boolean;
  isBarOrColumn: boolean;
  isGroupedBar: boolean;
  isAreaChart: boolean;
  isMultiSeries: boolean;
  isDateBased: boolean;
  dateKey: string;
  categoryAxisKey: string;
  seriesKey: string;
  valueKeys: string[];
  valueKey: string;
  categories: string[];
  keys: string[];
  legacyHasCategoryCol: boolean;
  humanizeFieldName: (field: string) => string;
  metricLabelForAxis: string;
  xAxisTitleText: string;
  labelColor: any;
  maxNumericY: number;
  gridStroke: any;
  legendFontSize: number;
  legendMarkerSize: number;
  legendItemSpacing: number;
  legendMarkerTextGap: number;
  axisLabelSize: number;
  rotateBarCategoryLabels: boolean;
  rotateLineLabels: boolean;
  manyCategories: boolean;
  /** When set, column/line clicks emit this category label for workspace drilldown. */
  drilldownEnabled?: boolean;
  onDrilldownCategory?: (categoryLabel: string) => void;
  /** True when workspace drilldown mode is on (disables pan + grouped snap cursor). */
  workspaceDrilldownActive?: boolean;
  /** When set (data preview / dashboard mini), vertical columns use this fixed width in px. */
  previewSlimBarWidthPx?: number;
  /** Populated when legend is rendered in DOM below the chart. */
  domLegendItems: ChartDomScrollLegendItem[];
}
