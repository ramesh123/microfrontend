import type { CartesianCustomizationOptions } from '../../cartesian/customize/cartesianCustomizeTypes';
import { cartesianDefaultOptions } from '../../cartesian/customize/cartesianCustomizeTypes';

export interface BarCustomizationOptions extends CartesianCustomizationOptions {
  valueDecimalPlaces?: number;
  horizontal?: boolean;
}

export const defaultOptions: BarCustomizationOptions = {
  ...cartesianDefaultOptions,
  dataZoomMin: 4,
  xAxisTitleMargin: 4,
  valueDecimalPlaces: 0,
  horizontal: false,
};

export type { CartesianCustomizationOptions };
