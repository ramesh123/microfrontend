import {
  DEFAULT_VALUE_RANGE_COLORS,
  type ValueRangeBoundsOptions,
} from '../../shared/bigNumberValueRangeColors';
import type { ValueRangeBand } from '../../shared/ValueRangeBandsPanel';

export const DEFAULT_GAUGE_ARC_WIDTH = 20;
export const MIN_GAUGE_ARC_WIDTH = 8;
export const MAX_GAUGE_ARC_WIDTH = 48;

export function resolveGaugeArcWidth(value: unknown): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return DEFAULT_GAUGE_ARC_WIDTH;
  return Math.min(MAX_GAUGE_ARC_WIDTH, Math.max(MIN_GAUGE_ARC_WIDTH, Math.round(parsed)));
}

export interface GaugeCustomizationOptions extends ValueRangeBoundsOptions {
  min?: number | '';
  max?: number | '';
  intervalBounds?: string;
  colorScheme: string;
  /** Pixel thickness of the gauge arc band (maps to amCharts innerRadius). */
  arcWidth?: number;
  fontSize: number;
  numberFormat: string;
  currencyFormat: string;
  currencySymbol: string;
  valueFormat: string;
  showPointer: boolean;
  animation: boolean;
  showAxisTicks: boolean;
  showSplitLines: boolean;
  splitNumber: number;
  showProgress: boolean;
  overlap: boolean;
  roundCap: boolean;
  showLabels?: boolean;
  showTotal?: boolean;
  forceShowAllTicks?: boolean;
  refreshIntervalSeconds?: number;
  customBands?: ValueRangeBand[];
}

export const defaultOptions: GaugeCustomizationOptions = {
  min: '',
  max: '',
  intervalBounds: '',
  colorScheme: 'd3-category10',
  arcWidth: DEFAULT_GAUGE_ARC_WIDTH,
  fontSize: 14,
  numberFormat: 'adaptive',
  currencyFormat: 'prefix',
  currencySymbol: '',
  valueFormat: '{value}',
  showPointer: true,
  animation: true,
  showAxisTicks: false,
  showSplitLines: false,
  splitNumber: 10,
  showProgress: true,
  overlap: true,
  roundCap: true,
  showLabels: true,
  showTotal: false,
  forceShowAllTicks: false,
  valueRangeBoundsMode: 'count',
  refreshIntervalSeconds: 0,
  customBands: [
    {
      color: '#3182bd',
      minValue: '',
      maxValue: '',
    },
  ],
};

export const colorSchemes = [
  { value: 'd3-category20c', name: 'D3 Category 20c', colors: ['#3182bd', '#6baed6', '#9ecae1', '#c6dbef', '#e6550d', '#fd8d3c', '#fdae6b', '#fdd0a2', '#31a354', '#74c476', '#a1d99b', '#c7e9c0', '#756bb1', '#9e9ac8', '#bcbddc', '#dadaeb', '#636363', '#969696', '#bdbdbd', '#d9d9d9'] },
  { value: 'd3-category10', name: 'D3 Category 10', colors: ['#1f77b4', '#ff7f0e', '#2ca02c', '#d62728', '#9467bd', '#8c564b', '#e377c2', '#7f7f7f', '#bcbd22', '#17becf'] },
  { value: 'd3-category20', name: 'D3 Category 20', colors: ['#1f77b4', '#aec7e8', '#ff7f0e', '#ffbb78', '#2ca02c', '#98df8a', '#d62728', '#ff9896', '#9467bd', '#c5b0d5', '#8c564b', '#c49c94', '#e377c2', '#f7b6d2', '#7f7f7f', '#c7c7c7', '#bcbd22', '#dbdb8d', '#17becf', '#9edae5'] },
  { value: 'd3-category20b', name: 'D3 Category 20b', colors: ['#393b79', '#5254a3', '#6b6ecf', '#9c9ede', '#637939', '#8ca252', '#b5cf6b', '#cedb9c', '#8c6d31', '#bd9e39', '#e7ba52', '#e7cb94', '#843c39', '#ad494a', '#d6616b', '#e7969c', '#7b4173', '#a55194', '#ce6dbd', '#de9ed6'] },
  { value: 'echarts-v4', name: 'ECharts v4.x Colors', colors: ['#c23531', '#2f4554', '#61a0a8', '#d48265', '#91c7ae', '#749f83', '#ca8622', '#bda29a', '#6e7074', '#546570', '#c4ccd3'] },
  { value: 'echarts-v5', name: 'ECharts v5.x Colors', colors: ['#5470c6', '#91cc75', '#fac858', '#ee6666', '#73c0de', '#3ba272', '#fc8452', '#9a60b4', '#ea7ccc'] },
  { value: 'google', name: 'Google Category', colors: ['#3366cc', '#dc3912', '#ff9900', '#109618', '#990099', '#0099c6', '#dd4477', '#66aa00', '#b82e2e', '#316395'] },
  { value: 'pastel', name: 'Pastel', colors: ['#FFB3BA', '#BAFFC9', '#BAE1FF', '#FFFFBA', '#FFDFBA', '#E0BBE4', '#FEC8C1', '#FFD3A5'] },
  { value: 'vibrant', name: 'Vibrant', colors: ['#FF6B6B', '#4ECDC4', '#45B7D1', '#FFA07A', '#98D8C8', '#F7DC6F', '#BB8FCE', '#85C1E2'] },
  { value: 'brilliant', name: 'Brilliant Brights', colors: ['#FF1744', '#FFEA00', '#00E676', '#00B0FF', '#EA80FC', '#FF9100', '#C6FF00', '#F50057'] },
  { value: 'sunburst', name: 'Sunburst', colors: ['#FF4500', '#FFB000', '#FFD700', '#FFEC8B', '#FF69B4', '#FF8C00', '#FF007F', '#FFC300'] },
  { value: 'neon', name: 'Neon Glow', colors: ['#FF00FF', '#39FF14', '#00FFFF', '#FF3131', '#FFD000', '#7C00FE', '#00FF9C', '#FF6B00'] },
  { value: 'fluorescent', name: 'Fluorescent', colors: ['#DAFF00', '#00FF66', '#00FFD1', '#00B7FF', '#FF2E97', '#FF5F1F', '#FF007A', '#7DFF00'] },
  { value: 'candy', name: 'Candy Pop', colors: ['#FF3B3B', '#FF9F1C', '#FFEB3B', '#3DFF92', '#3DDCFF', '#7C4DFF', '#FF5ACD', '#00FFB3'] },
];

export { DEFAULT_VALUE_RANGE_COLORS };
