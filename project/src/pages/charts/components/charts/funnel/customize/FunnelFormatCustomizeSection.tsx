import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  FunnelCustomizeCollapsibleSection,
  FunnelCustomizeFieldRow,
  useFunnelCustomizeHandlers,
  type FunnelCustomizeSectionProps,
} from './funnelCustomizeShared';

type Props = FunnelCustomizeSectionProps & { defaultOpen?: boolean };

export function FunnelFormatCustomizeSection({ options, onOptionsChange, defaultOpen = false }: Props) {
  const { update } = useFunnelCustomizeHandlers(options, onOptionsChange);

  return (
    <FunnelCustomizeCollapsibleSection
      title="Number format"
      description="Value and currency formatting on labels and tooltips"
      defaultOpen={defaultOpen}
    >
      <FunnelCustomizeFieldRow label="Number format">
        <Select value={options.numberFormat} onValueChange={(value) => update('numberFormat', value)}>
          <SelectTrigger className="w-full max-w-full !h-8 min-w-0 text-sm [&>span]:truncate">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="adaptive">Adaptive formatting</SelectItem>
            <SelectItem value="short">Short (K/M/B)</SelectItem>
            <SelectItem value="full">Full number</SelectItem>
            <SelectItem value="decimal">Decimal</SelectItem>
          </SelectContent>
        </Select>
      </FunnelCustomizeFieldRow>

      <div className="grid grid-cols-2 gap-2">
        <FunnelCustomizeFieldRow label="Currency format">
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
        </FunnelCustomizeFieldRow>

        <FunnelCustomizeFieldRow label="Currency">
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
        </FunnelCustomizeFieldRow>
      </div>
    </FunnelCustomizeCollapsibleSection>
  );
}
