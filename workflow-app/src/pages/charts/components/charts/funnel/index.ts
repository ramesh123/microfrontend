/** Funnel chart module. */

export { FunnelChart } from './components/FunnelChart';

export {
  FunnelCustomizePanel,
  defaultOptions,
  FUNNEL_CHART_COLORS,
  type FunnelCustomizationOptions,
} from './customize/FunnelCustomizePanel';

export { FunnelAppearanceCustomizeSection } from './customize/FunnelAppearanceCustomizeSection';
export { FunnelLabelsCustomizeSection } from './customize/FunnelLabelsCustomizeSection';
export { FunnelTooltipCustomizeSection } from './customize/FunnelTooltipCustomizeSection';
export { FunnelLegendCustomizeSection } from './customize/FunnelLegendCustomizeSection';
export { FunnelFormatCustomizeSection } from './customize/FunnelFormatCustomizeSection';
export { FunnelLiveCustomizeSection } from './customize/FunnelLiveCustomizeSection';

export {
  buildFunnelCustomizationPayload,
  FUNNEL_CUSTOMIZATION_KEYS,
} from './utils/funnelCustomizationPayload';
export type { ChartCustomizationsDict } from './utils/funnelCustomizationPayload';
