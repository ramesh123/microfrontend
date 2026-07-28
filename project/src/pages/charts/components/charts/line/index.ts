/** Line chart module. */

export { LineChart } from './components/LineChart';

export {
  LineCustomizePanel,
  defaultOptions,
  type LineCustomizationOptions,
} from './customize/LineCustomizePanel';

export { buildLineCustomizationPayload, LINE_CUSTOMIZATION_KEYS } from './utils/lineCustomizationPayload';
export type { ChartCustomizationsDict } from './utils/lineCustomizationPayload';
