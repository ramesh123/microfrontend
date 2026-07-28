import { CartesianAppearanceCustomizeSection } from '../../cartesian/customize/CartesianAppearanceCustomizeSection';
import { CartesianDataZoomCustomizeSection } from '../../cartesian/customize/CartesianDataZoomCustomizeSection';
import { CartesianFormatCustomizeSection } from '../../cartesian/customize/CartesianFormatCustomizeSection';
import { CartesianLegendCustomizeSection } from '../../cartesian/customize/CartesianLegendCustomizeSection';
import { CartesianLiveCustomizeSection } from '../../cartesian/customize/CartesianLiveCustomizeSection';
import { CartesianSortAxisCustomizeSection } from '../../cartesian/customize/CartesianSortAxisCustomizeSection';
import { CartesianCustomizePanelShell } from '../../cartesian/customize/cartesianCustomizeShared';
import { BarValueCustomizeSection } from './BarValueCustomizeSection';
import { defaultOptions, type BarCustomizationOptions } from './barCustomizeTypes';

export type { BarCustomizationOptions } from './barCustomizeTypes';
export { defaultOptions };

interface BarCustomizePanelProps {
  options?: BarCustomizationOptions;
  onOptionsChange: (options: BarCustomizationOptions) => void;
}

export function BarCustomizePanel({
  options = defaultOptions,
  onOptionsChange,
}: BarCustomizePanelProps) {
  const normalized = { ...defaultOptions, ...options };

  return (
    <CartesianCustomizePanelShell title="Chart options" description="Bar and column chart settings">
      <CartesianAppearanceCustomizeSection options={normalized} onOptionsChange={onOptionsChange} defaultOpen />
      <CartesianSortAxisCustomizeSection options={normalized} onOptionsChange={onOptionsChange} />
      <CartesianDataZoomCustomizeSection options={normalized} onOptionsChange={onOptionsChange} />
      <BarValueCustomizeSection options={normalized} onOptionsChange={onOptionsChange} />
      <CartesianLegendCustomizeSection options={normalized} onOptionsChange={onOptionsChange} />
      <CartesianFormatCustomizeSection options={normalized} onOptionsChange={onOptionsChange} />
      <CartesianLiveCustomizeSection options={normalized} onOptionsChange={onOptionsChange} />
    </CartesianCustomizePanelShell>
  );
}
