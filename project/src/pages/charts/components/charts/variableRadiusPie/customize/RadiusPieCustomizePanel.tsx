import {
  ChartCustomizePanel,
  defaultOptions,
  type ChartCustomizationOptions,
} from '../../pie/customize/PieCustomizePanel';

export type { ChartCustomizationOptions };
export { defaultOptions };

interface RadiusPieCustomizePanelProps {
  options: ChartCustomizationOptions;
  onOptionsChange: (options: ChartCustomizationOptions) => void;
  chartType?: string;
}

/** Customize panel for variable-radius (Nightingale) pie charts. */
export function RadiusPieCustomizePanel({
  options,
  onOptionsChange,
  chartType = 'Radius Pie Chart',
}: RadiusPieCustomizePanelProps) {
  return (
    <ChartCustomizePanel
      options={options}
      onOptionsChange={onOptionsChange}
      chartType={chartType}
    />
  );
}
