import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  CartesianCustomizeCollapsibleSection,
  CartesianCustomizeFieldRow,
  useCartesianCustomizeHandlers,
  type CartesianCustomizeSectionProps,
} from './cartesianCustomizeShared';
import type { CartesianCustomizationOptions } from './cartesianCustomizeTypes';

type Props<T extends CartesianCustomizationOptions = CartesianCustomizationOptions> =
  CartesianCustomizeSectionProps<T> & { defaultOpen?: boolean };

export function CartesianFormatCustomizeSection<T extends CartesianCustomizationOptions>({
  options,
  onOptionsChange,
  defaultOpen = false,
}: Props<T>) {
  const { update } = useCartesianCustomizeHandlers(options, onOptionsChange);

  return (
    <CartesianCustomizeCollapsibleSection
      title="Format"
      description="Y-axis number and currency formatting"
      defaultOpen={defaultOpen}
    >
      <CartesianCustomizeFieldRow label="Y-axis format">
        <Select
          value={options.numberFormat || 'short'}
          onValueChange={(v) => update('numberFormat', v)}
        >
          <SelectTrigger className="w-full !h-8 text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="short">Short (K/M/B)</SelectItem>
            <SelectItem value="raw">Decimal</SelectItem>
          </SelectContent>
        </Select>
      </CartesianCustomizeFieldRow>

      <CartesianCustomizeFieldRow label="Currency format">
        <div className="flex gap-2">
          <Select
            value={options.currencyFormat || 'none'}
            onValueChange={(v) => update('currencyFormat', v)}
          >
            <SelectTrigger className="w-full !h-8 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">None</SelectItem>
              <SelectItem value="prefix">Prefix</SelectItem>
              <SelectItem value="suffix">Suffix</SelectItem>
            </SelectContent>
          </Select>

          <Select
            value={options.currencyCode || ''}
            onValueChange={(v) => update('currencyCode', v)}
          >
            <SelectTrigger className="w-28 !h-8 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="USD">$ (USD)</SelectItem>
              <SelectItem value="EUR">€ (EUR)</SelectItem>
              <SelectItem value="GBP">£ (GBP)</SelectItem>
              <SelectItem value="INR">₹ (INR)</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </CartesianCustomizeFieldRow>
    </CartesianCustomizeCollapsibleSection>
  );
}
