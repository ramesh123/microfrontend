export interface SunburstCustomizationOptions {
  /** @deprecated Ignored when using fixed palette; kept for API compatibility */
  colorScheme?: string;
  fontSize: number;
  numberFormat: string;
  currencyFormat: string;
  currencySymbol: string;
  showLabels: boolean;
  showLegend: boolean;
  showTotal?: boolean;
  animation: boolean;
  refreshIntervalSeconds?: number;
}

export const SUNBURST_COLORS = [
  '#354C9A',
  '#4CAF50',
  '#1F9D8A',
  '#9C2C7F',
  '#D32F2F',
  '#E53935',
] as const;

export const defaultOptions: SunburstCustomizationOptions = {
  colorScheme: 'agentic-base',
  fontSize: 12,
  numberFormat: 'adaptive',
  currencyFormat: 'none',
  currencySymbol: '',
  showLabels: true,
  showLegend: true,
  showTotal: false,
  animation: true,
  refreshIntervalSeconds: 0,
};
