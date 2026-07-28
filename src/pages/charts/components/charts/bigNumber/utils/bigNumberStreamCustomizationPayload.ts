import type { BigNumberStreamCustomizationOptions } from '../customize/BigNumberStreamCustomizePanel';
import { defaultStreamOptions } from '../customize/BigNumberStreamCustomizePanel';
import { hasExplicitBigNumberCardColor } from './bigNumberCardColors';
import { normalizeBigNumberIconPositionCustomizations } from './bigNumberFreeIconPosition';

export type ChartCustomizationsDict = Record<string, unknown>;

/** Every customization key persisted for Big Number Stream charts. */
export const BIG_NUMBER_STREAM_CUSTOMIZATION_KEYS = [
  'bigNumberFontSize',
  'bigNumberFontSizePx',
  'subheaderFontSize',
  'subheaderFontSizePx',
  'subheaderBold',
  'bigNumberBold',
  'numberFormat',
  'currencyFormat',
  'currencyCode',
  'cardColorScheme',
  'cardBackgroundStyle',
  'backgroundOpacity',
  'cardBackgroundImage',
  'dateFormat',
  'forceDateFormat',
  'conditionalFormattingEnabled',
  'showSparkline',
  'showTrendDelta',
  'sparklineColor',
  'animateValueUpdates',
  'iconSvg',
  'iconPositionX',
  'iconPositionY',
  'iconSvgColor',
  'iconSizePx',
  'titleLabel',
  'refreshIntervalSeconds',
  'valueRangeColorLow',
  'valueRangeColorMid',
  'valueRangeColorHigh',
  'valueRangeLowMin',
  'valueRangeLowMax',
  'valueRangeMidMin',
  'valueRangeMidMax',
  'valueRangeHighMin',
  'valueRangeHighMax',
  'valueRangeBoundsMode',
  'iconPosition',
  'headerPosition',
  'valuePosition',
  'headerValueSamePosition',
] as const satisfies readonly (keyof BigNumberStreamCustomizationOptions)[];

/** Optional legacy / explicit card colour keys (not on stream interface). */
const BIG_NUMBER_STREAM_CARD_EXTRA_KEYS = ['cardBackgroundColor', 'bgOpacity', 'cardBackgroundImage'] as const;

/**
 * Merge sources with stream defaults and emit a full customization object for API payloads.
 */
export function buildBigNumberStreamCustomizationPayload(
  ...sources: Array<ChartCustomizationsDict | null | undefined>
): ChartCustomizationsDict {
  const merged: ChartCustomizationsDict = {
    ...defaultStreamOptions,
    ...sources.filter(Boolean).reduce((acc, s) => ({ ...acc, ...s }), {}),
  };

  const out: ChartCustomizationsDict = {};

  for (const key of BIG_NUMBER_STREAM_CUSTOMIZATION_KEYS) {
    const value = merged[key];
    if (value !== undefined) {
      out[key] = value;
      continue;
    }
    const fallback = (defaultStreamOptions as ChartCustomizationsDict)[key];
    if (fallback !== undefined) {
      out[key] = fallback;
    }
  }

  for (const key of BIG_NUMBER_STREAM_CARD_EXTRA_KEYS) {
    if (merged[key] !== undefined) {
      out[key] = merged[key];
    }
  }

  if (!hasExplicitBigNumberCardColor(out)) {
    const {
      cardColorScheme: _s,
      cardBackgroundColor: _b,
      cardBackgroundStyle: _st,
      backgroundOpacity: _o,
      bgOpacity: _bo,
      cardBackgroundImage: _img,
      ...rest
    } = out;
    return normalizeBigNumberIconPositionCustomizations(rest);
  }

  return normalizeBigNumberIconPositionCustomizations(out);
}
