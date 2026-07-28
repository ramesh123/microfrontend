import { CartesianAppearanceCustomizeSection } from '../../cartesian/customize/CartesianAppearanceCustomizeSection';
import { CartesianDataZoomCustomizeSection } from '../../cartesian/customize/CartesianDataZoomCustomizeSection';
import { CartesianFormatCustomizeSection } from '../../cartesian/customize/CartesianFormatCustomizeSection';
import { CartesianLegendCustomizeSection } from '../../cartesian/customize/CartesianLegendCustomizeSection';
import { CartesianLiveCustomizeSection } from '../../cartesian/customize/CartesianLiveCustomizeSection';
import { CartesianSortAxisCustomizeSection } from '../../cartesian/customize/CartesianSortAxisCustomizeSection';
import { CartesianCustomizePanelShell } from '../../cartesian/customize/cartesianCustomizeShared';
import { AreaAppearanceCustomizeSection } from './AreaAppearanceCustomizeSection';
import { AreaValueFormatCustomizeSection } from './AreaValueFormatCustomizeSection';
import { defaultOptions, type AreaCustomizationOptions } from './areaCustomizeTypes';

export type { AreaCustomizationOptions, AreaCurveStyle } from './areaCustomizeTypes';
export { defaultOptions };

interface AreaCustomizePanelProps {
  options?: AreaCustomizationOptions;
  onOptionsChange: (options: AreaCustomizationOptions) => void;
}

export function AreaCustomizePanel({
  options = defaultOptions,
  onOptionsChange,
}: AreaCustomizePanelProps) {
  const normalized = { ...defaultOptions, ...options };

  return (
    <CartesianCustomizePanelShell title="Chart options" description="Area chart series settings">
      <AreaAppearanceCustomizeSection options={normalized} onOptionsChange={onOptionsChange} defaultOpen />
      <CartesianAppearanceCustomizeSection options={normalized} onOptionsChange={onOptionsChange} />
      <CartesianSortAxisCustomizeSection options={normalized} onOptionsChange={onOptionsChange} />
      <CartesianDataZoomCustomizeSection options={normalized} onOptionsChange={onOptionsChange} />
      <AreaValueFormatCustomizeSection options={normalized} onOptionsChange={onOptionsChange} />
      <CartesianLegendCustomizeSection options={normalized} onOptionsChange={onOptionsChange} />
      <CartesianFormatCustomizeSection options={normalized} onOptionsChange={onOptionsChange} />
      <CartesianLiveCustomizeSection options={normalized} onOptionsChange={onOptionsChange} />
    </CartesianCustomizePanelShell>
  );
}
