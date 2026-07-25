import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  SunburstCustomizeCollapsibleSection,
  SunburstCustomizeFieldRow,
  useSunburstCustomizeHandlers,
  type SunburstCustomizeSectionProps,
} from './sunburstCustomizeShared';

type Props = SunburstCustomizeSectionProps & { defaultOpen?: boolean };

export function SunburstFormatCustomizeSection({ options, onOptionsChange, defaultOpen = false }: Props) {
  const { update } = useSunburstCustomizeHandlers(options, onOptionsChange);

  return (
    <SunburstCustomizeCollapsibleSection
      title="Number format"
      description="Value and currency formatting on labels and tooltips"
      defaultOpen={defaultOpen}
    >
      <SunburstCustomizeFieldRow label="Number format">
        <Select value={options.numberFormat} onValueChange={(value) => update('numberFormat', value)}>
          <SelectTrigger className="w-full !h-8 text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="adaptive">Adaptive formatting</SelectItem>
            <SelectItem value="short">Short (K/M/B)</SelectItem>
            <SelectItem value="full">Full number</SelectItem>
            <SelectItem value="decimal">Decimal</SelectItem>
          </SelectContent>
        </Select>
      </SunburstCustomizeFieldRow>

      <div className="grid grid-cols-2 gap-2">
        <SunburstCustomizeFieldRow label="Currency format">
          <Select value={options.currencyFormat} onValueChange={(value) => update('currencyFormat', value)}>
            <SelectTrigger className="w-full !h-8 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="prefix">Prefix</SelectItem>
              <SelectItem value="suffix">Suffix</SelectItem>
              <SelectItem value="none">None</SelectItem>
            </SelectContent>
          </Select>
        </SunburstCustomizeFieldRow>

        <SunburstCustomizeFieldRow label="Currency">
          <Select value={options.currencySymbol} onValueChange={(value) => update('currencySymbol', value)}>
            <SelectTrigger className="w-full !h-8 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="$ (USD)">$ (USD)</SelectItem>
              <SelectItem value="€ (EUR)">€ (EUR)</SelectItem>
              <SelectItem value="£ (GBP)">£ (GBP)</SelectItem>
            </SelectContent>
          </Select>
        </SunburstCustomizeFieldRow>
      </div>
    </SunburstCustomizeCollapsibleSection>
  );
}
