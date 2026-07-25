/** Shared XY (bar / line / area) chart customization options. */

export interface CartesianCustomizationOptions {
  /** @deprecated Unused; series colors come from chart defaults. */
  colorScheme?: string;
  fontSize: number;
  numberFormat: string;
  currencyFormat: string;
  currencySymbol: string;
  currencyCode?: string;
  showLabels: boolean;
  showLegend: boolean;
  showValue: boolean;
  animation: boolean;
  logarithmicAxis?: boolean;
  truncateXAxis?: boolean;
  xAxisMin?: number | string;
  xAxisMax?: number | string;
  truncateAxis?: boolean;
  axisMin?: number | string;
  axisMax?: number | string;
  sortSeriesBy?: 'total_value' | 'name' | 'none';
  sortSeriesAscending?: boolean;
  stackedStyle?: 'none' | 'normal' | 'percent';
  legendType?: 'scroll' | 'wrap' | 'fixed';
  legendOrientation?: 'bottom' | 'top' | 'left' | 'right';
  margin?: string;
  minorTicks?: boolean;
  dataZoom?: boolean;
  /** Min categories to show via data zoom; scrollbar appears when data exceeds this count. */
  dataZoomMin?: number;
  xAxisTitle?: string;
  xAxisTitleMargin?: number;
  yAxisTitle?: string;
  yAxisTitleMargin?: number;
  yAxisTitlePosition?: 'left' | 'right' | 'center' | 'inside';
  xAxisLabelRotation?: number;
  yAxisLabelRotation?: number;
  refreshIntervalSeconds?: number;
}

export const cartesianDefaultOptions: CartesianCustomizationOptions = {
  colorScheme: 'agentic-base',
  fontSize: 12,
  numberFormat: 'short',
  currencyFormat: 'none',
  currencySymbol: '',
  currencyCode: '',
  showLabels: true,
  showLegend: true,
  showValue: true,
  animation: true,
  logarithmicAxis: false,
  truncateXAxis: false,
  xAxisMin: '',
  xAxisMax: '',
  truncateAxis: false,
  axisMin: '',
  axisMax: '',
  sortSeriesBy: 'none',
  sortSeriesAscending: false,
  stackedStyle: 'none',
  legendType: 'scroll',
  legendOrientation: 'bottom',
  margin: '',
  minorTicks: false,
  dataZoom: true,
  dataZoomMin: 6,
  xAxisTitle: '',
  xAxisTitleMargin: 15,
  yAxisTitle: '',
  yAxisTitleMargin: 15,
  yAxisTitlePosition: 'left',
  xAxisLabelRotation: 0,
  yAxisLabelRotation: 0,
  refreshIntervalSeconds: 0,
};
