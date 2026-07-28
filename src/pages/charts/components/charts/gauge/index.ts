/** Gauge chart module. */

export { GaugeChart } from './components/GaugeChart';

export {
  GaugeCustomizePanel,
  defaultOptions,
  colorSchemes,
  type GaugeCustomizationOptions,
} from './customize/GaugeCustomizePanel';

export { GaugeAppearanceCustomizeSection } from './customize/GaugeAppearanceCustomizeSection';
export { GaugeTypographyCustomizeSection } from './customize/GaugeTypographyCustomizeSection';
export { GaugeFormatCustomizeSection } from './customize/GaugeFormatCustomizeSection';
export { GaugeLiveCustomizeSection } from './customize/GaugeLiveCustomizeSection';

export {
  buildGaugeCustomizationPayload,
  buildIntervalBoundsFromBands,
  GAUGE_CUSTOMIZATION_KEYS,
} from './utils/gaugeCustomizationPayload';
export type { ChartCustomizationsDict } from './utils/gaugeCustomizationPayload';
