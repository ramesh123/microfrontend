import type { FunnelCustomizationOptions } from '../customize/funnelCustomizeTypes';
import { defaultOptions as funnelDefaultOptions } from '../customize/funnelCustomizeTypes';

export type ChartCustomizationsDict = Record<string, unknown>;

/** Every customization key persisted for funnel charts. */
export const FUNNEL_CUSTOMIZATION_KEYS = [
  'colorScheme',
  'fontSize',
  'numberFormat',
  'currencyFormat',
  'currencySymbol',
  'showLabels',
  'showLegend',
  'animation',
  'legendOrientation',
  'margin',
  'labelContents',
  'tooltipContents',
  'showTooltipLabels',
  'refreshIntervalSeconds',
] as const satisfies readonly (keyof FunnelCustomizationOptions)[];

export function buildFunnelCustomizationPayload(
  ...sources: Array<ChartCustomizationsDict | null | undefined>
): ChartCustomizationsDict {
  const merged: ChartCustomizationsDict = {
    ...funnelDefaultOptions,
    ...sources.filter(Boolean).reduce((acc, s) => ({ ...acc, ...s }), {}),
  };

  const out: ChartCustomizationsDict = {};

  for (const key of FUNNEL_CUSTOMIZATION_KEYS) {
    const value = merged[key];
    if (value !== undefined) {
      out[key] = value;
      continue;
    }
    const fallback = (funnelDefaultOptions as unknown as Record<string, unknown>)[key];
    if (fallback !== undefined) {
      out[key] = fallback;
    }
  }

  if (out.showTooltipLabels !== false) {
    out.showTooltipLabels = true;
  }

  out.legendOrientation =
    out.legendOrientation === 'top' ||
    out.legendOrientation === 'left' ||
    out.legendOrientation === 'right'
      ? out.legendOrientation
      : 'bottom';

  return out;
}
