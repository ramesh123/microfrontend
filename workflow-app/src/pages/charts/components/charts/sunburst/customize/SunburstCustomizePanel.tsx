import { SunburstAppearanceCustomizeSection } from './SunburstAppearanceCustomizeSection';
import { SunburstFormatCustomizeSection } from './SunburstFormatCustomizeSection';
import { SunburstLabelsCustomizeSection } from './SunburstLabelsCustomizeSection';
import { SunburstLegendCustomizeSection } from './SunburstLegendCustomizeSection';
import { SunburstLiveCustomizeSection } from './SunburstLiveCustomizeSection';
import { SunburstCustomizePanelShell } from './sunburstCustomizeShared';
import { defaultOptions, type SunburstCustomizationOptions } from './sunburstCustomizeTypes';

export type { SunburstCustomizationOptions } from './sunburstCustomizeTypes';
export { defaultOptions, SUNBURST_COLORS } from './sunburstCustomizeTypes';

interface SunburstCustomizePanelProps {
  options?: SunburstCustomizationOptions;
  onOptionsChange: (options: SunburstCustomizationOptions) => void;
}

export function SunburstCustomizePanel({
  options = defaultOptions,
  onOptionsChange,
}: SunburstCustomizePanelProps) {
  return (
    <SunburstCustomizePanelShell title="Chart options" description="Sunburst hierarchy chart settings">
      <SunburstAppearanceCustomizeSection options={options} onOptionsChange={onOptionsChange} defaultOpen />
      <SunburstLegendCustomizeSection options={options} onOptionsChange={onOptionsChange} />
      <SunburstLabelsCustomizeSection options={options} onOptionsChange={onOptionsChange} />
      <SunburstFormatCustomizeSection options={options} onOptionsChange={onOptionsChange} />
      <SunburstLiveCustomizeSection options={options} onOptionsChange={onOptionsChange} />
    </SunburstCustomizePanelShell>
  );
}
