import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { BIG_NUMBER_UNIT_PRESETS } from '../utils/bigNumberUnitOptions';
import type { BigNumberMetricDescriptor } from '../utils/bigNumberUnitOptions';
import { BigNumberPerMetricFormatSection } from './BigNumberPerMetricFormatSection';
import {
  BigNumberCustomizeCollapsibleSection,
  BigNumberCustomizeFieldRow,
  useBigNumberCustomizeHandlers,
  type BigNumberCustomizeSectionProps,
} from './bigNumberCustomizeShared';

type Props = BigNumberCustomizeSectionProps & {
  metricDescriptors: BigNumberMetricDescriptor[];
  defaultOpen?: boolean;
};

export function BigNumberDataFormatCustomizeSection({
  options,
  onOptionsChange,
  metricDescriptors,
  defaultOpen = false,
}: Props) {
  const { update, applyOptions } = useBigNumberCustomizeHandlers(options, onOptionsChange);
  const hasMultipleMetrics = metricDescriptors.length > 1;

  return (
    <BigNumberCustomizeCollapsibleSection
      title="Number formatting"
      description="Display format, units, and per-metric settings"
      defaultOpen={defaultOpen}
    >
      {hasMultipleMetrics ? (
        <BigNumberCustomizeFieldRow
          label="Per-metric settings"
          hint="Set format, units, and font size for each metric column."
        >
          <BigNumberPerMetricFormatSection
            options={options}
            metricDescriptors={metricDescriptors}
            onOptionsChange={applyOptions}
          />
        </BigNumberCustomizeFieldRow>
      ) : (
        <>
          <BigNumberCustomizeFieldRow label="Number format">
            <Select
              value={options.numberFormat === 'raw' ? 'decimal' : (options.numberFormat || 'decimal')}
              onValueChange={(v) => update('numberFormat', v as typeof options.numberFormat)}
            >
              <SelectTrigger className="w-full !h-8 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="adaptive">Adaptive formatting</SelectItem>
                <SelectItem value="short">Short (K/M/B)</SelectItem>
                <SelectItem value="full">Full number</SelectItem>
                <SelectItem value="decimal">Decimal</SelectItem>
                <SelectItem value="percent">Percentage</SelectItem>
              </SelectContent>
            </Select>
          </BigNumberCustomizeFieldRow>

          <div className="grid grid-cols-2 gap-1.5">
            <BigNumberCustomizeFieldRow label="Unit placement">
              <Select
                value={options.currencyFormat || 'none'}
                onValueChange={(v) => update('currencyFormat', v as typeof options.currencyFormat)}
              >
                <SelectTrigger className="w-full !h-8 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="prefix">Prefix</SelectItem>
                  <SelectItem value="suffix">Suffix</SelectItem>
                  <SelectItem value="none">None</SelectItem>
                </SelectContent>
              </Select>
            </BigNumberCustomizeFieldRow>

            <BigNumberCustomizeFieldRow label="Unit">
              <Select
                value={options.currencyCode && options.currencyCode !== '' ? options.currencyCode : 'none'}
                onValueChange={(v) => update('currencyCode', v === 'none' ? '' : v)}
              >
                <SelectTrigger className="w-full !h-8 text-sm">
                  <SelectValue placeholder="Unit" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {BIG_NUMBER_UNIT_PRESETS.filter((p) => p.value !== 'none' && p.value !== 'Custom').map(
                    (preset) => (
                      <SelectItem key={preset.value} value={preset.value}>
                        {preset.label}
                      </SelectItem>
                    ),
                  )}
                  <SelectItem value="Custom">Custom text…</SelectItem>
                </SelectContent>
              </Select>
            </BigNumberCustomizeFieldRow>
          </div>
        </>
      )}
    </BigNumberCustomizeCollapsibleSection>
  );
}
