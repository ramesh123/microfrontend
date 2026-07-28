import { donutColors as FUNNEL_CHART_COLORS } from '@/pages/ExploratoryAnalysis/AgenticSemantics/am5MiniChartConstants';

export { FUNNEL_CHART_COLORS };

export interface FunnelCustomizationOptions {
  /** @deprecated Ignored; funnel uses pie chart colors ({@link FUNNEL_CHART_COLORS}) */
  colorScheme?: string;
  fontSize: number;
  numberFormat: string;
  currencyFormat: string;
  currencySymbol: string;
  showLabels: boolean;
  showLegend: boolean;
  animation: boolean;
  legendOrientation?: 'bottom' | 'top' | 'left' | 'right';
  margin?: string;
  labelContents?: string;
  tooltipContents?: string;
  showTooltipLabels?: boolean;
  refreshIntervalSeconds?: number;
}

export const defaultOptions: FunnelCustomizationOptions = {
  colorScheme: 'agentic-base',
  fontSize: 12,
  numberFormat: 'adaptive',
  currencyFormat: 'prefix',
  currencySymbol: '$ (USD)',
  showLabels: true,
  showLegend: true,
  legendOrientation: 'bottom',
  margin: '',
  labelContents: 'category_name',
  tooltipContents: 'category_value_percentage',
  showTooltipLabels: true,
  animation: true,
  refreshIntervalSeconds: 0,
};
