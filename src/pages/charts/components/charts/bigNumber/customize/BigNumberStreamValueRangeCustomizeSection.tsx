import * as React from 'react';
import {
  DEFAULT_VALUE_RANGE_COLORS,
  parseValueRangeBound,
} from '../../shared/bigNumberValueRangeColors';
import { ValueRangeBandsPanel, type ValueRangeBand } from '../../shared/ValueRangeBandsPanel';
import {
  BigNumberCustomizeCollapsibleSection,
  BigNumberCustomizeFieldRow,
  useBigNumberCustomizeHandlers,
} from './bigNumberCustomizeShared';
import type { BigNumberStreamCustomizationOptions } from './BigNumberStreamCustomizePanel';

const STREAM_BAND_LABELS = ['Low', 'Mid', 'High'] as const;

function bandsFromStreamOptions(options: BigNumberStreamCustomizationOptions): ValueRangeBand[] {
  return [
    {
      color: options.valueRangeColorLow || DEFAULT_VALUE_RANGE_COLORS.low,
      minValue: (options.valueRangeLowMin ?? '') as number | '',
      maxValue: (options.valueRangeLowMax ?? '') as number | '',
    },
    {
      color: options.valueRangeColorMid || DEFAULT_VALUE_RANGE_COLORS.mid,
      minValue: (options.valueRangeMidMin ?? '') as number | '',
      maxValue: (options.valueRangeMidMax ?? '') as number | '',
    },
    {
      color: options.valueRangeColorHigh || DEFAULT_VALUE_RANGE_COLORS.high,
      minValue: (options.valueRangeHighMin ?? '') as number | '',
      maxValue: (options.valueRangeHighMax ?? '') as number | '',
    },
  ];
}

function applyBandsToStreamOptions(
  options: BigNumberStreamCustomizationOptions,
  bands: ValueRangeBand[],
): BigNumberStreamCustomizationOptions {
  const [low, mid, high] = bands;
  const next: BigNumberStreamCustomizationOptions = { ...options };

  if (low) {
    next.valueRangeColorLow = low.color;
    next.valueRangeLowMin = parseValueRangeBound(low.minValue);
    next.valueRangeLowMax = parseValueRangeBound(low.maxValue);
  }
  if (mid) {
    next.valueRangeColorMid = mid.color;
    next.valueRangeMidMin = parseValueRangeBound(mid.minValue);
    next.valueRangeMidMax = parseValueRangeBound(mid.maxValue);
  }
  if (high) {
    next.valueRangeColorHigh = high.color;
    next.valueRangeHighMin = parseValueRangeBound(high.minValue);
    next.valueRangeHighMax = parseValueRangeBound(high.maxValue);
  }

  return next;
}

export function BigNumberStreamValueRangeCustomizeSection({
  options,
  onOptionsChange,
  defaultOpen = false,
}: {
  options: BigNumberStreamCustomizationOptions;
  onOptionsChange: (next: BigNumberStreamCustomizationOptions) => void;
  defaultOpen?: boolean;
}) {
  const { update, applyOptions } = useBigNumberCustomizeHandlers(options, onOptionsChange);
  const bands = React.useMemo(() => bandsFromStreamOptions(options), [options]);

  return (
    <BigNumberCustomizeCollapsibleSection
      title="Value colour bands"
      description="Low, mid, and high colours based on value ranges"
      defaultOpen={defaultOpen}
    >
      <BigNumberCustomizeFieldRow
        label="Range bands"
        hint="Set from/to bounds and colours for low, mid, and high KPI values."
      >
        <ValueRangeBandsPanel
          boundsMode={options.valueRangeBoundsMode ?? 'count'}
          onBoundsModeChange={(mode) => update('valueRangeBoundsMode', mode)}
          bands={bands}
          onBandsChange={(nextBands) => {
            const normalized = STREAM_BAND_LABELS.map((_, index) => nextBands[index] ?? bands[index]).slice(
              0,
              3,
            );
            applyOptions(applyBandsToStreamOptions(options, normalized));
          }}
        />
      </BigNumberCustomizeFieldRow>
    </BigNumberCustomizeCollapsibleSection>
  );
}
