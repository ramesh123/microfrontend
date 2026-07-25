import { Input } from '@/components/ui/input';
import {
  CartesianCustomizeCollapsibleSection,
  CartesianCustomizeFieldRow,
  useCartesianCustomizeHandlers,
  type CartesianCustomizeSectionProps,
} from '../../cartesian/customize/cartesianCustomizeShared';
import type { BarCustomizationOptions } from './barCustomizeTypes';

type Props = CartesianCustomizeSectionProps<BarCustomizationOptions> & { defaultOpen?: boolean };

export function BarValueCustomizeSection({ options, onOptionsChange, defaultOpen = false }: Props) {
  const { update } = useCartesianCustomizeHandlers(options, onOptionsChange);

  if (!options.showValue) return null;

  return (
    <CartesianCustomizeCollapsibleSection
      title="Value labels"
      description="Decimal precision for bar value labels"
      defaultOpen={defaultOpen}
    >
      <CartesianCustomizeFieldRow label="Decimal places">
        <Input
          type="number"
          className="h-8 w-28 text-sm"
          value={String(options.valueDecimalPlaces ?? 0)}
          onChange={(e) => {
            const n = Number(e.target.value);
            update('valueDecimalPlaces', Number.isFinite(n) ? Math.max(0, Math.floor(n)) : 0);
          }}
        />
      </CartesianCustomizeFieldRow>
    </CartesianCustomizeCollapsibleSection>
  );
}
