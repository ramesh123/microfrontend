import * as React from 'react';
import { Input } from '@/components/ui/input';
import { Slider } from '@/components/ui/slider';
import {
  DEFAULT_GAUGE_ARC_WIDTH,
  DEFAULT_VALUE_RANGE_COLORS,
  MAX_GAUGE_ARC_WIDTH,
  MIN_GAUGE_ARC_WIDTH,
  resolveGaugeArcWidth,
} from './gaugeCustomizeTypes';
import {
  ValueRangeBandsPanel,
  type ValueRangeBand,
  buildIntervalBoundsFromBands,
} from '../../shared/ValueRangeBandsPanel';
import {
  GaugeCustomizeCollapsibleSection,
  GaugeCustomizeFieldRow,
  GaugeCustomizeToggleRow,
  useGaugeCustomizeHandlers,
  type GaugeCustomizeSectionProps,
} from './gaugeCustomizeShared';

type Props = GaugeCustomizeSectionProps & { defaultOpen?: boolean };

function resolveCustomBands(options: GaugeCustomizeSectionProps['options']): ValueRangeBand[] {
  if (options.customBands && Array.isArray(options.customBands)) {
    return options.customBands;
  }

  const hasOldCustomization =
    options.valueRangeLowMin !== undefined ||
    options.valueRangeLowMax !== undefined ||
    options.valueRangeMidMin !== undefined ||
    options.valueRangeMidMax !== undefined ||
    options.valueRangeHighMin !== undefined ||
    options.valueRangeHighMax !== undefined ||
    options.valueRangeColorLow !== undefined ||
    options.valueRangeColorMid !== undefined ||
    options.valueRangeColorHigh !== undefined;

  if (hasOldCustomization) {
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

  return [{ color: '#3182bd', minValue: '', maxValue: '' }];
}

export function GaugeAppearanceCustomizeSection({
  options,
  onOptionsChange,
  defaultOpen = true,
}: Props) {
  const { update, applyOptions } = useGaugeCustomizeHandlers(options, onOptionsChange);
  const [localMin, setLocalMin] = React.useState<string>(
    options.min === '' || options.min === undefined ? '' : String(options.min),
  );
  const [localMax, setLocalMax] = React.useState<string>(
    options.max === '' || options.max === undefined ? '' : String(options.max),
  );
  const localMinRef = React.useRef<HTMLInputElement | null>(null);
  const localMaxRef = React.useRef<HTMLInputElement | null>(null);
  const localMinEditing = React.useRef(false);
  const localMaxEditing = React.useRef(false);

  const customBands = React.useMemo(() => resolveCustomBands(options), [options]);
  const arcWidth = resolveGaugeArcWidth(options.arcWidth ?? DEFAULT_GAUGE_ARC_WIDTH);

  React.useEffect(() => {
    if (!localMinEditing.current) {
      const s = options.min === '' || options.min === undefined ? '' : String(options.min);
      setLocalMin(s);
      if (localMinRef.current) localMinRef.current.value = s;
    }
    if (!localMaxEditing.current) {
      const s = options.max === '' || options.max === undefined ? '' : String(options.max);
      setLocalMax(s);
      if (localMaxRef.current) localMaxRef.current.value = s;
    }
  }, [options.min, options.max]);

  const commitBound = (raw: string): number | '' => {
    const v = raw.trim();
    if (v === '') return '';
    const parsed = Number(v);
    return Number.isFinite(parsed) ? parsed : '';
  };

  return (
    <GaugeCustomizeCollapsibleSection
      title="Gauge arc"
      description="Scale range, colour bands, and axis ticks"
      defaultOpen={defaultOpen}
    >
      <div className="grid grid-cols-2 gap-2">
        <GaugeCustomizeFieldRow label="Min">
          <Input
            ref={localMinRef}
            type="text"
            inputMode="decimal"
            placeholder="e.g. 0"
            defaultValue={localMin}
            onFocus={() => {
              localMinEditing.current = true;
              setTimeout(() => {
                try {
                  localMinRef.current?.select();
                } catch {
                  /* ignore */
                }
              }, 0);
            }}
            onBlur={() => {
              const v = (localMinRef.current ? localMinRef.current.value : localMin).trim();
              setLocalMin(v);
              update('min', commitBound(v));
              localMinEditing.current = false;
            }}
            onKeyDown={(e) => {
              if (e.key !== 'Enter') return;
              const v = (localMinRef.current ? localMinRef.current.value : localMin).trim();
              setLocalMin(v);
              update('min', commitBound(v));
              localMinEditing.current = false;
            }}
            className="h-8 text-sm"
          />
        </GaugeCustomizeFieldRow>

        <GaugeCustomizeFieldRow label="Max">
          <Input
            ref={localMaxRef}
            type="text"
            inputMode="decimal"
            placeholder="e.g. 100"
            defaultValue={localMax}
            onFocus={() => {
              localMaxEditing.current = true;
              setTimeout(() => {
                try {
                  localMaxRef.current?.select();
                } catch {
                  /* ignore */
                }
              }, 0);
            }}
            onBlur={() => {
              const v = (localMaxRef.current ? localMaxRef.current.value : localMax).trim();
              setLocalMax(v);
              update('max', commitBound(v));
              localMaxEditing.current = false;
            }}
            onKeyDown={(e) => {
              if (e.key !== 'Enter') return;
              const v = (localMaxRef.current ? localMaxRef.current.value : localMax).trim();
              setLocalMax(v);
              update('max', commitBound(v));
              localMaxEditing.current = false;
            }}
            className="h-8 text-sm"
          />
        </GaugeCustomizeFieldRow>
      </div>

      <GaugeCustomizeFieldRow label="Round width" hint="Thickness of the gauge arc band">
        <div>
          <Slider
            value={[arcWidth]}
            onValueChange={(value) => update('arcWidth', resolveGaugeArcWidth(value[0]))}
            min={MIN_GAUGE_ARC_WIDTH}
            max={MAX_GAUGE_ARC_WIDTH}
            step={1}
            className="w-full"
          />
          <div className="mt-1 flex justify-between text-[10px] text-muted-foreground">
            <span>{MIN_GAUGE_ARC_WIDTH}px</span>
            <span>{arcWidth}px</span>
            <span>{MAX_GAUGE_ARC_WIDTH}px</span>
          </div>
        </div>
      </GaugeCustomizeFieldRow>

      <GaugeCustomizeToggleRow
        label="Rounded arc ends"
        hint="Round caps on the colour band segments"
        checked={options.roundCap !== false}
        onCheckedChange={(checked) => update('roundCap', checked)}
      />

      <GaugeCustomizeFieldRow label="Band colours" hint="Custom value segments on the gauge arc">
        <ValueRangeBandsPanel
          boundsMode={options.valueRangeBoundsMode ?? 'count'}
          onBoundsModeChange={(mode) => update('valueRangeBoundsMode', mode)}
          bands={customBands}
          onBandsChange={(nextBands) => {
            applyOptions({
              ...options,
              customBands: nextBands,
              intervalBounds: buildIntervalBoundsFromBands(nextBands),
            });
          }}
        />
      </GaugeCustomizeFieldRow>

      <GaugeCustomizeFieldRow label="Axis ticks" hint="Number of scale labels around the arc">
        <Slider
          value={[options.splitNumber ?? 10]}
          onValueChange={(value) => update('splitNumber', value[0])}
          min={4}
          max={12}
          step={1}
          className="w-full"
        />
      </GaugeCustomizeFieldRow>
    </GaugeCustomizeCollapsibleSection>
  );
}
