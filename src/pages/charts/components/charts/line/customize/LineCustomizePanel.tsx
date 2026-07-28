import { LineAppearanceCustomizeSection } from './LineAppearanceCustomizeSection';
import { CartesianAppearanceCustomizeSection } from '../../cartesian/customize/CartesianAppearanceCustomizeSection';
import { CartesianDataZoomCustomizeSection } from '../../cartesian/customize/CartesianDataZoomCustomizeSection';
import { CartesianFormatCustomizeSection } from '../../cartesian/customize/CartesianFormatCustomizeSection';
import { CartesianLegendCustomizeSection } from '../../cartesian/customize/CartesianLegendCustomizeSection';
import { CartesianLiveCustomizeSection } from '../../cartesian/customize/CartesianLiveCustomizeSection';
import { CartesianSortAxisCustomizeSection } from '../../cartesian/customize/CartesianSortAxisCustomizeSection';
import { CartesianCustomizePanelShell } from '../../cartesian/customize/cartesianCustomizeShared';
import { defaultOptions, type LineCustomizationOptions } from './lineCustomizeTypes';

export type { LineCustomizationOptions } from './lineCustomizeTypes';
export { defaultOptions };

interface LineCustomizePanelProps {
  options?: LineCustomizationOptions;
  onOptionsChange: (options: LineCustomizationOptions) => void;
}

export function LineCustomizePanel({
  options = defaultOptions,
  onOptionsChange,
}: LineCustomizePanelProps) {
  const normalized = { ...defaultOptions, ...options };

  return (
    <CartesianCustomizePanelShell title="Chart options" description="Line chart series settings">
      <LineAppearanceCustomizeSection options={normalized} onOptionsChange={onOptionsChange} defaultOpen />
      <CartesianAppearanceCustomizeSection options={normalized} onOptionsChange={onOptionsChange} />
      <CartesianSortAxisCustomizeSection options={normalized} onOptionsChange={onOptionsChange} />
      <CartesianDataZoomCustomizeSection options={normalized} onOptionsChange={onOptionsChange} />
      <CartesianLegendCustomizeSection options={normalized} onOptionsChange={onOptionsChange} />
      <CartesianFormatCustomizeSection options={normalized} onOptionsChange={onOptionsChange} />
      <CartesianLiveCustomizeSection options={normalized} onOptionsChange={onOptionsChange} />
    </CartesianCustomizePanelShell>
  );
}
