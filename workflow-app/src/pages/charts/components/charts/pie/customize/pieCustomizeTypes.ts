export interface ChartCustomizationOptions {
  colorScheme: string;
  percentageThreshold: number;
  showLegend: boolean;
  legendType: string;
  legendOrientation: string;
  legendMargin: string;
  labelType: string;
  numberFormat: string;
  currencyFormat: string;
  currencySymbol: string;
  dateFormat: string;
  showLabels: boolean;
  labelLine: boolean;
  showTotal: boolean;
  outerRadius: number;
  innerRadius?: number;
  showSideLegend?: boolean;
  sideLegendOrientation?: 'left' | 'right';
  sortSliceBy?: 'none' | 'asc' | 'desc';
  refreshIntervalSeconds?: number;
}

export const defaultOptions: ChartCustomizationOptions = {
  colorScheme: 'agentic-base',
  percentageThreshold: 5,
  showLegend: true,
  legendType: 'plain',
  legendOrientation: 'bottom',
  legendMargin: '',
  labelType: 'both',
  numberFormat: 'adaptive',
  currencyFormat: 'none',
  currencySymbol: '',
  dateFormat: 'adaptive',
  showLabels: true,
  labelLine: true,
  showTotal: false,
  outerRadius: 88,
  innerRadius: 50,
  showSideLegend: false,
  sideLegendOrientation: 'right',
  sortSliceBy: 'desc',
  refreshIntervalSeconds: 0,
};
