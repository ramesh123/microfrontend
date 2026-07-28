import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  PieCustomizeCollapsibleSection,
  PieCustomizeFieldRow,
  PieCustomizeToggleRow,
  usePieCustomizeHandlers,
  type PieCustomizeSectionProps,
} from './pieCustomizeShared';

type Props = PieCustomizeSectionProps & { defaultOpen?: boolean };

export function PieLabelsCustomizeSection({ options, onOptionsChange, defaultOpen = false }: Props) {
  const { update } = usePieCustomizeHandlers(options, onOptionsChange);

  return (
    <PieCustomizeCollapsibleSection
      title="Labels"
      description="Slice labels, connector lines, and total"
      defaultOpen={defaultOpen}
    >
      <PieCustomizeFieldRow label="Label type">
        <Select value={options.labelType} onValueChange={(value) => update('labelType', value)}>
          <SelectTrigger className="w-full !h-8 text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="percentage">Percentage</SelectItem>
            <SelectItem value="value">Value</SelectItem>
            <SelectItem value="both">Both</SelectItem>
            <SelectItem value="none">None</SelectItem>
          </SelectContent>
        </Select>
      </PieCustomizeFieldRow>

      <PieCustomizeToggleRow
        label="Show labels"
        checked={options.showLabels}
        onCheckedChange={(checked) => update('showLabels', checked)}
      />
      <PieCustomizeToggleRow
        label="Label line"
        checked={options.labelLine}
        onCheckedChange={(checked) => update('labelLine', checked)}
      />
      <PieCustomizeToggleRow
        label="Show total"
        checked={options.showTotal}
        onCheckedChange={(checked) => update('showTotal', checked)}
      />
    </PieCustomizeCollapsibleSection>
  );
}

export function PieFormatCustomizeSection({ options, onOptionsChange, defaultOpen = false }: Props) {
  const { update } = usePieCustomizeHandlers(options, onOptionsChange);
  const showValueFormat = options.labelType !== 'percentage' && options.labelType !== 'none';

  if (!showValueFormat) return null;

  return (
    <PieCustomizeCollapsibleSection
      title="Number format"
      description="Value and currency formatting on slice labels"
      defaultOpen={defaultOpen}
    >
      <PieCustomizeFieldRow label="Number format">
        <Select value={options.numberFormat} onValueChange={(value) => update('numberFormat', value)}>
          <SelectTrigger className="w-full !h-8 text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="adaptive">Adaptive (K/M/B)</SelectItem>
            <SelectItem value="short">Short (K/M/B)</SelectItem>
            <SelectItem value="full">Full number</SelectItem>
            <SelectItem value="decimal">Decimal</SelectItem>
          </SelectContent>
        </Select>
      </PieCustomizeFieldRow>

      <PieCustomizeFieldRow label="Currency format">
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
      </PieCustomizeFieldRow>

      <PieCustomizeFieldRow label="Currency symbol">
        <Select value={options.currencySymbol} onValueChange={(value) => update('currencySymbol', value)}>
          <SelectTrigger className="w-full !h-8 text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="$ (USD)">$ (USD)</SelectItem>
            <SelectItem value="€ (EUR)">€ (EUR)</SelectItem>
            <SelectItem value="£ (GBP)">£ (GBP)</SelectItem>
            <SelectItem value="¥ (JPY)">¥ (JPY)</SelectItem>
          </SelectContent>
        </Select>
      </PieCustomizeFieldRow>
    </PieCustomizeCollapsibleSection>
  );
}
