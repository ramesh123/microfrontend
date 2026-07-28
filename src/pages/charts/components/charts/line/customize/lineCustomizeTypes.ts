import type { CartesianCustomizationOptions } from '../../cartesian/customize/cartesianCustomizeTypes';
import { cartesianDefaultOptions } from '../../cartesian/customize/cartesianCustomizeTypes';
import type { CartesianCurveStyle } from '../../cartesian/customize/cartesianCurveStyleUi';
import { DEFAULT_LINE_THICKNESS } from '../../cartesian/customize/cartesianLineThicknessUi';

export type LineCurveStyle = CartesianCurveStyle;

export interface LineCustomizationOptions extends CartesianCustomizationOptions {
  /** Smooth spline curve vs straight segments between points. */
  lineCurveStyle?: LineCurveStyle;
  /** Series stroke width in pixels. */
  lineThickness?: number;
}

export const defaultOptions: LineCustomizationOptions = {
  ...cartesianDefaultOptions,
  lineCurveStyle: 'smooth',
  lineThickness: DEFAULT_LINE_THICKNESS,
};

export type { CartesianCustomizationOptions };
