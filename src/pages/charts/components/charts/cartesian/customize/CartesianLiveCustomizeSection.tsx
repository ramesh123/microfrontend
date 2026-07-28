import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { BIG_NUMBER_STREAM_REFRESH_INTERVALS } from '../../bigNumber/customize/bigNumberStreamRefreshIntervals';
import {
  CartesianCustomizeCollapsibleSection,
  CartesianCustomizeFieldRow,
  useCartesianCustomizeHandlers,
  type CartesianCustomizeSectionProps,
} from './cartesianCustomizeShared';
import type { CartesianCustomizationOptions } from './cartesianCustomizeTypes';

type Props<T extends CartesianCustomizationOptions = CartesianCustomizationOptions> =
  CartesianCustomizeSectionProps<T> & { defaultOpen?: boolean };

export function CartesianLiveCustomizeSection<T extends CartesianCustomizationOptions>({
  options,
  onOptionsChange,
  defaultOpen = false,
}: Props<T>) {
  const { update } = useCartesianCustomizeHandlers(options, onOptionsChange);

  return (
    <CartesianCustomizeCollapsibleSection
      title="Live refresh"
      description="Automatically reload chart data on a schedule"
      defaultOpen={defaultOpen}
    >
      <CartesianCustomizeFieldRow label="Refresh interval">
        <Select
          value={String(options.refreshIntervalSeconds ?? 0)}
          onValueChange={(v) => update('refreshIntervalSeconds', Number(v))}
        >
          <SelectTrigger className="w-full !h-8 text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {BIG_NUMBER_STREAM_REFRESH_INTERVALS.map((opt) => (
              <SelectItem key={opt.value} value={String(opt.value)}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </CartesianCustomizeFieldRow>
    </CartesianCustomizeCollapsibleSection>
  );
}
