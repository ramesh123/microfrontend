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
  CartesianCustomizeToggleRow,
  useCartesianCustomizeHandlers,
  type CartesianCustomizeSectionProps,
} from './cartesianCustomizeShared';
import type { CartesianCustomizationOptions } from './cartesianCustomizeTypes';

type Props<T extends CartesianCustomizationOptions = CartesianCustomizationOptions> =
  CartesianCustomizeSectionProps<T> & { defaultOpen?: boolean };

export function CartesianDataZoomCustomizeSection<T extends CartesianCustomizationOptions>({
  options,
  onOptionsChange,
  defaultOpen = false,
}: Props<T>) {
  const { update } = useCartesianCustomizeHandlers(options, onOptionsChange);

  return (
    <CartesianCustomizeCollapsibleSection
      title="Labels & zoom"
      description="Value labels, ticks, and data zoom"
      defaultOpen={defaultOpen}
    >
      <CartesianCustomizeToggleRow
        label="Show value"
        checked={options.showValue || false}
        onCheckedChange={(checked) => update('showValue', checked)}
      />
      <CartesianCustomizeToggleRow
        label="Minor ticks"
        checked={options.minorTicks || false}
        onCheckedChange={(checked) => update('minorTicks', checked)}
      />
      <CartesianCustomizeToggleRow
        label="Data zoom"
        checked={options.dataZoom || false}
        onCheckedChange={(checked) => update('dataZoom', checked)}
      />
      {options.dataZoom ? (
        <CartesianCustomizeFieldRow
          label="Data zoom min"
          hint="Show scrollbar when data exceeds this count"
        >
          <Select
            value={String(options.dataZoomMin ?? 6)}
            onValueChange={(v) => update('dataZoomMin', Number(v))}
          >
            <SelectTrigger className="w-full !h-8 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {[2, 3, 4, 5, 6, 8, 10, 12, 15, 20].map((n) => (
                <SelectItem key={n} value={String(n)}>
                  {n}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CartesianCustomizeFieldRow>
      ) : null}
    </CartesianCustomizeCollapsibleSection>
  );
}
