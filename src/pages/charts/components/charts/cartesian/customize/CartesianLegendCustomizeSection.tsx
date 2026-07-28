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

export function CartesianLegendCustomizeSection<T extends CartesianCustomizationOptions>({
  options,
  onOptionsChange,
  defaultOpen = false,
}: Props<T>) {
  const { update, updateOptions } = useCartesianCustomizeHandlers(options, onOptionsChange);

  return (
    <CartesianCustomizeCollapsibleSection
      title="Legend"
      description="Legend visibility and placement"
      defaultOpen={defaultOpen}
    >
      <CartesianCustomizeToggleRow
        label="Show legend"
        checked={options.showLegend || false}
        onCheckedChange={(checked) => {
          if (checked) {
            updateOptions({ showLegend: true, legendOrientation: 'bottom' } as Partial<T>);
          } else {
            update('showLegend', false);
          }
        }}
      />
      {options.showLegend ? (
        <CartesianCustomizeFieldRow label="Legend orientation">
          <Select
            value={options.legendOrientation || 'bottom'}
            onValueChange={(v) => update('legendOrientation', v as T['legendOrientation'])}
          >
            <SelectTrigger className="w-full !h-8 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="bottom">Bottom</SelectItem>
              <SelectItem value="top">Top</SelectItem>
              <SelectItem value="left">Left</SelectItem>
              <SelectItem value="right">Right</SelectItem>
            </SelectContent>
          </Select>
        </CartesianCustomizeFieldRow>
      ) : null}
    </CartesianCustomizeCollapsibleSection>
  );
}
