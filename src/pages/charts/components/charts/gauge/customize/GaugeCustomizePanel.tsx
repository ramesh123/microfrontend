import { GaugeAppearanceCustomizeSection } from './GaugeAppearanceCustomizeSection';
import { GaugeFormatCustomizeSection } from './GaugeFormatCustomizeSection';
import { GaugeLiveCustomizeSection } from './GaugeLiveCustomizeSection';
import { GaugeTypographyCustomizeSection } from './GaugeTypographyCustomizeSection';
import { GaugeCustomizePanelShell } from './gaugeCustomizeShared';
import { defaultOptions, type GaugeCustomizationOptions } from './gaugeCustomizeTypes';

export type { GaugeCustomizationOptions } from './gaugeCustomizeTypes';
export { defaultOptions, colorSchemes } from './gaugeCustomizeTypes';

interface GaugeCustomizePanelProps {
  options?: GaugeCustomizationOptions;
  onOptionsChange: (options: GaugeCustomizationOptions) => void;
}

export function GaugeCustomizePanel({
  options = defaultOptions,
  onOptionsChange,
}: GaugeCustomizePanelProps) {
  return (
    <GaugeCustomizePanelShell title="Chart options" description="Gauge arc, formatting, and refresh">
      <GaugeAppearanceCustomizeSection options={options} onOptionsChange={onOptionsChange} defaultOpen />
      <GaugeTypographyCustomizeSection options={options} onOptionsChange={onOptionsChange} />
      <GaugeFormatCustomizeSection options={options} onOptionsChange={onOptionsChange} />
      <GaugeLiveCustomizeSection options={options} onOptionsChange={onOptionsChange} />
    </GaugeCustomizePanelShell>
  );
}
