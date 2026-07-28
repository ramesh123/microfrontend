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
} from '../../cartesian/customize/cartesianCustomizeShared';
import type { AreaCustomizationOptions } from './areaCustomizeTypes';

type Props = CartesianCustomizeSectionProps<AreaCustomizationOptions> & { defaultOpen?: boolean };

export function AreaValueFormatCustomizeSection({ options, onOptionsChange, defaultOpen = false }: Props) {
  const { update } = useCartesianCustomizeHandlers(options, onOptionsChange);

  if (!options.showValue) return null;

  return (
    <CartesianCustomizeCollapsibleSection
      title="Value labels"
      description="Adaptive or fixed decimal formatting"
      defaultOpen={defaultOpen}
    >
      <CartesianCustomizeFieldRow label="Value format">
        <Select
          value={`${options.valueFormatMode || 'adaptive'}|${options.valueDecimalPlaces ?? 2}`}
          onValueChange={(v) => {
            const [mode, dp] = (v || '').split('|');
            update('valueFormatMode', (mode as AreaCustomizationOptions['valueFormatMode']) || 'adaptive');
            update('valueDecimalPlaces', Number(dp || 2));
          }}
        >
          <SelectTrigger className="w-full !h-8 text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {[0, 1, 2, 3].map((n) => (
              <SelectItem key={`a-${n}`} value={`adaptive|${n}`}>
                Adaptive {n}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </CartesianCustomizeFieldRow>
    </CartesianCustomizeCollapsibleSection>
  );
}
