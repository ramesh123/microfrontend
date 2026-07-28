import * as React from 'react';
import { DEFAULT_VALUE_RANGE_COLORS } from '../../shared/bigNumberValueRangeColors';
import {
  DEFAULT_HEADER_POSITION,
  DEFAULT_ICON_POSITION,
  DEFAULT_VALUE_POSITION,
} from '../utils/bigNumberStreamLayout';
import type { BigNumberCustomizationOptions } from './BigNumberCustmizechart';
import { BIG_NUMBER_STREAM_REFRESH_INTERVALS } from './bigNumberStreamRefreshIntervals';
import { BigNumberAppearanceCustomizeSection } from './BigNumberAppearanceCustomizeSection';
import { BigNumberDataFormatCustomizeSection } from './BigNumberDataFormatCustomizeSection';
import { BigNumberIconCustomizeSectionWrapper } from './BigNumberIconCustomizeSectionWrapper';
import { BigNumberLayoutMetricsCustomizeSection } from './BigNumberLayoutMetricsCustomizeSection';
import { BigNumberStreamDisplayCustomizeSection } from './BigNumberStreamDisplayCustomizeSection';
import { BigNumberStreamLiveCustomizeSection } from './BigNumberStreamLiveCustomizeSection';
import { BigNumberStreamValueRangeCustomizeSection } from './BigNumberStreamValueRangeCustomizeSection';
import { BigNumberTypographyCustomizeSection } from './BigNumberTypographyCustomizeSection';
import { BigNumberCustomizePanelShell } from './bigNumberCustomizeShared';

export interface BigNumberStreamCustomizationOptions extends BigNumberCustomizationOptions {
  showSparkline?: boolean;
  showTrendDelta?: boolean;
  sparklineColor?: string;
  animateValueUpdates?: boolean;
  /** User-edited display title; falls back to metric label when empty. */
  titleLabel?: string;
  /** Auto-refresh interval in seconds; 0 = manual only. */
  refreshIntervalSeconds?: number;
  /** Hex colours for min / mid / max value range on the big number. */
  valueRangeColorLow?: string;
  valueRangeColorMid?: string;
  valueRangeColorHigh?: string;
  /** Inclusive count range for low band (e.g. 0–1). */
  valueRangeLowMin?: number;
  valueRangeLowMax?: number;
  valueRangeMidMin?: number;
  valueRangeMidMax?: number;
  valueRangeHighMin?: number;
  valueRangeHighMax?: number;
  /** Whether From/To bounds are absolute counts or % of data min–max. */
  valueRangeBoundsMode?: 'count' | 'percent';
}

export { BIG_NUMBER_STREAM_REFRESH_INTERVALS };

export const defaultStreamOptions: BigNumberStreamCustomizationOptions = {
  bigNumberFontSize: 'small',
  subheaderFontSize: 'large',
  subheaderBold: false,
  bigNumberBold: true,
  numberFormat: 'raw',
  currencyFormat: 'none',
  currencyCode: '',
  cardColorScheme: 'theme',
  cardBackgroundStyle: 'shine',
  backgroundOpacity: 100,
  cardBackgroundImage: '',
  dateFormat: 'adaptive',
  forceDateFormat: false,
  conditionalFormattingEnabled: false,
  showSparkline: true,
  showTrendDelta: true,
  sparklineColor: '',
  animateValueUpdates: true,
  iconSvg: '',
  iconSvgColor: '',
  iconSizePx: 16,
  titleLabel: '',
  refreshIntervalSeconds: 0,
  valueRangeColorLow: DEFAULT_VALUE_RANGE_COLORS.low,
  valueRangeColorMid: DEFAULT_VALUE_RANGE_COLORS.mid,
  valueRangeColorHigh: DEFAULT_VALUE_RANGE_COLORS.high,
  valueRangeBoundsMode: 'count',
  iconPosition: DEFAULT_ICON_POSITION,
  headerPosition: DEFAULT_HEADER_POSITION,
  valuePosition: DEFAULT_VALUE_POSITION,
  headerValueSamePosition: false,
};

export function BigNumberStreamCustomizePanel({
  options = defaultStreamOptions,
  onOptionsChange,
}: {
  options?: BigNumberStreamCustomizationOptions;
  onOptionsChange: (o: BigNumberStreamCustomizationOptions) => void;
}) {
  const applyStreamOptions = React.useCallback(
    (next: BigNumberCustomizationOptions) => {
      onOptionsChange(next as BigNumberStreamCustomizationOptions);
    },
    [onOptionsChange],
  );

  return (
    <BigNumberCustomizePanelShell
      title="Big Number Stream"
      description="Live KPI card appearance and formatting"
    >
      <BigNumberStreamLiveCustomizeSection
        options={options}
        onOptionsChange={onOptionsChange}
        defaultOpen
      />

      <BigNumberStreamDisplayCustomizeSection options={options} onOptionsChange={onOptionsChange} />

      <BigNumberStreamValueRangeCustomizeSection options={options} onOptionsChange={onOptionsChange} />

      <BigNumberAppearanceCustomizeSection options={options} onOptionsChange={applyStreamOptions} />

      <BigNumberLayoutMetricsCustomizeSection
        options={options}
        onOptionsChange={applyStreamOptions}
        metricLabels={[]}
      />

      <BigNumberIconCustomizeSectionWrapper options={options} onOptionsChange={applyStreamOptions} />

      <BigNumberTypographyCustomizeSection options={options} onOptionsChange={applyStreamOptions} />

      <BigNumberDataFormatCustomizeSection
        options={options}
        onOptionsChange={applyStreamOptions}
        metricDescriptors={[]}
      />
    </BigNumberCustomizePanelShell>
  );
}
