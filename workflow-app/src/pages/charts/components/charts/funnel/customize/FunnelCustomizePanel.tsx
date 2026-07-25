import { FunnelAppearanceCustomizeSection } from './FunnelAppearanceCustomizeSection';
import { FunnelFormatCustomizeSection } from './FunnelFormatCustomizeSection';
import { FunnelLabelsCustomizeSection } from './FunnelLabelsCustomizeSection';
import { FunnelLegendCustomizeSection } from './FunnelLegendCustomizeSection';
import { FunnelLiveCustomizeSection } from './FunnelLiveCustomizeSection';
import { FunnelTooltipCustomizeSection } from './FunnelTooltipCustomizeSection';
import { FunnelCustomizePanelShell } from './funnelCustomizeShared';
import { defaultOptions, type FunnelCustomizationOptions } from './funnelCustomizeTypes';

export type { FunnelCustomizationOptions } from './funnelCustomizeTypes';
export { defaultOptions, FUNNEL_CHART_COLORS } from './funnelCustomizeTypes';

interface FunnelCustomizePanelProps {
  options?: FunnelCustomizationOptions;
  onOptionsChange: (options: FunnelCustomizationOptions) => void;
}

export function FunnelCustomizePanel({
  options = defaultOptions,
  onOptionsChange,
}: FunnelCustomizePanelProps) {
  return (
    <FunnelCustomizePanelShell title="Chart options" description="Funnel chart stage settings">
      <FunnelAppearanceCustomizeSection options={options} onOptionsChange={onOptionsChange} defaultOpen />
      <FunnelLegendCustomizeSection options={options} onOptionsChange={onOptionsChange} />
      <FunnelLabelsCustomizeSection options={options} onOptionsChange={onOptionsChange} />
      <FunnelTooltipCustomizeSection options={options} onOptionsChange={onOptionsChange} />
      <FunnelFormatCustomizeSection options={options} onOptionsChange={onOptionsChange} />
      <FunnelLiveCustomizeSection options={options} onOptionsChange={onOptionsChange} />
    </FunnelCustomizePanelShell>
  );
}
