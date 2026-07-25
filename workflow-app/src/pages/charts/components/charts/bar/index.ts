/** Bar / column chart module. */

export { BarChart } from './components/BarChart';

export {
  BarCustomizePanel,
  defaultOptions,
  type BarCustomizationOptions,
} from './customize/BarCustomizePanel';

export { buildBarCustomizationPayload, BAR_CUSTOMIZATION_KEYS } from './utils/barCustomizationPayload';
export type { ChartCustomizationsDict } from './utils/barCustomizationPayload';
