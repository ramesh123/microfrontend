import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  GaugeCustomizeCollapsibleSection,
  GaugeCustomizeFieldRow,
  useGaugeCustomizeHandlers,
  type GaugeCustomizeSectionProps,
} from './gaugeCustomizeShared';

type Props = GaugeCustomizeSectionProps & { defaultOpen?: boolean };

export function GaugeFormatCustomizeSection({
  options,
  onOptionsChange,
  defaultOpen = false,
}: Props) {
  const { update } = useGaugeCustomizeHandlers(options, onOptionsChange);

  return (
    <GaugeCustomizeCollapsibleSection
      title="Number format"
      description="Value and currency formatting"
      defaultOpen={defaultOpen}
    >
      <GaugeCustomizeFieldRow label="Number format">
        <Select value={options.numberFormat} onValueChange={(value) => update('numberFormat', value)}>
          <SelectTrigger className="w-full max-w-full !h-8 min-w-0 text-sm [&>span]:truncate">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="adaptive">Adaptive formatting</SelectItem>
            <SelectItem value="short">Short (K/M/B)</SelectItem>
            <SelectItem value="full">Full number</SelectItem>
            <SelectItem value="decimal">Decimal</SelectItem>
            <SelectItem value="percentage">Percentage</SelectItem>
          </SelectContent>
        </Select>
      </GaugeCustomizeFieldRow>

      <div className="grid grid-cols-2 gap-2">
        <GaugeCustomizeFieldRow label="Currency format">
          <Select value={options.currencyFormat} onValueChange={(value) => update('currencyFormat', value)}>
            <SelectTrigger className="w-full max-w-full !h-8 min-w-0 text-sm [&>span]:truncate">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="prefix">Prefix</SelectItem>
              <SelectItem value="suffix">Suffix</SelectItem>
              <SelectItem value="none">None</SelectItem>
            </SelectContent>
          </Select>
        </GaugeCustomizeFieldRow>

        <GaugeCustomizeFieldRow label="Currency">
          <Select value={options.currencySymbol} onValueChange={(value) => update('currencySymbol', value)}>
            <SelectTrigger className="w-full max-w-full !h-8 min-w-0 text-sm [&>span]:truncate">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="$ (USD)">$ (USD)</SelectItem>
              <SelectItem value="€ (EUR)">€ (EUR)</SelectItem>
              <SelectItem value="£ (GBP)">£ (GBP)</SelectItem>
            </SelectContent>
          </Select>
        </GaugeCustomizeFieldRow>
      </div>
    </GaugeCustomizeCollapsibleSection>
  );
}
