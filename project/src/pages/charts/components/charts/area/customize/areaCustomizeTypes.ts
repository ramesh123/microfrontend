import type { CartesianCustomizationOptions } from '../../cartesian/customize/cartesianCustomizeTypes';
import { cartesianDefaultOptions } from '../../cartesian/customize/cartesianCustomizeTypes';
import { DEFAULT_AREA_LINE_THICKNESS } from '../../cartesian/customize/cartesianLineThicknessUi';

export type AreaCurveStyle = 'smooth' | 'linear';

/** @deprecated Use areaCurveStyle instead. */
export type AreaFillStyle = 'gradient' | 'columnar';

export interface AreaCustomizationOptions extends CartesianCustomizationOptions {
  valueFormatMode?: 'adaptive' | 'decimal';
  valueDecimalPlaces?: number;
  applyValueDecimalPlaces?: boolean;
  /** Smooth spline curve vs straight segments between points. */
  areaCurveStyle?: AreaCurveStyle;
  /** @deprecated Use areaCurveStyle. */
  areaFillStyle?: AreaFillStyle;
  /** Gradient area fill opacity (0–1). */
  areaFillOpacity?: number;
  /** When multiple series, render extra series as dashed comparison lines. */
  comparisonSeriesDashed?: boolean;
  /** Stock-style crosshair tooltip with category pill and summary label. */
  areaCrosshairTooltip?: boolean;
  /** Primary series stroke width in pixels. */
  lineThickness?: number;
}

export const defaultOptions: AreaCustomizationOptions = {
  ...cartesianDefaultOptions,
  valueFormatMode: 'adaptive',
  valueDecimalPlaces: 2,
  applyValueDecimalPlaces: true,
  areaCurveStyle: 'smooth',
  areaFillOpacity: 0.28,
  comparisonSeriesDashed: true,
  areaCrosshairTooltip: true,
  lineThickness: DEFAULT_AREA_LINE_THICKNESS,
};

export type { CartesianCustomizationOptions };
