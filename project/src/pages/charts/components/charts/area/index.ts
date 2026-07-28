/** Area chart module. */

export { AreaChart } from './components/AreaChart';

export {
  AreaCustomizePanel,
  defaultOptions,
  type AreaCustomizationOptions,
  type AreaCurveStyle,
} from './customize/AreaCustomizePanel';

export { buildAreaCustomizationPayload, AREA_CUSTOMIZATION_KEYS } from './utils/areaCustomizationPayload';
export type { ChartCustomizationsDict } from './utils/areaCustomizationPayload';
