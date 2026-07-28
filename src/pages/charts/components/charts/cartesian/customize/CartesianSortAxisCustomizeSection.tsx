import * as React from 'react';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
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

export function CartesianSortAxisCustomizeSection<T extends CartesianCustomizationOptions>({
  options,
  onOptionsChange,
  defaultOpen = false,
}: Props<T>) {
  const { update, applyOptions } = useCartesianCustomizeHandlers(options, onOptionsChange);
  const previousSortRef = React.useRef<T | null>(null);

  return (
    <CartesianCustomizeCollapsibleSection
      title="Sort & axes"
      description="Series order and axis label rotation"
      defaultOpen={defaultOpen}
    >
      <div className="flex items-center gap-2">
        <Checkbox
          id="sort-ascending"
          className="!h-4 !w-4"
          checked={options.sortSeriesAscending || false}
          onCheckedChange={(v) => {
            const isAscending = v as boolean;
            if (isAscending) {
              if (!previousSortRef.current) previousSortRef.current = { ...options };
              applyOptions({
                ...options,
                sortSeriesBy: 'total_value',
                sortSeriesAscending: true,
              } as T);
            } else if (previousSortRef.current) {
              applyOptions(previousSortRef.current);
              previousSortRef.current = null;
            } else {
              applyOptions({
                ...options,
                sortSeriesBy: 'none',
                sortSeriesAscending: false,
              } as T);
            }
          }}
        />
        <Label htmlFor="sort-ascending" className="cursor-pointer text-xs font-medium">
          Sort by ascending
        </Label>
      </div>
      {options.sortSeriesAscending ? (
        <p className="text-[10px] text-slate-500">
          Dimensions sorted by total value (lowest to highest)
        </p>
      ) : null}

      <CartesianCustomizeFieldRow label="Sort series by">
        <Select
          value={options.sortSeriesBy || 'none'}
          onValueChange={(v) => update('sortSeriesBy', v as T['sortSeriesBy'])}
        >
          <SelectTrigger className="w-full !h-8 text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">None</SelectItem>
            <SelectItem value="name">Name</SelectItem>
            <SelectItem value="total_value">Total value</SelectItem>
          </SelectContent>
        </Select>
      </CartesianCustomizeFieldRow>

      <div className="grid grid-cols-2 gap-2">
        <CartesianCustomizeFieldRow label="X label rotation">
          <Select
            value={String(options.xAxisLabelRotation ?? 0)}
            onValueChange={(v) => update('xAxisLabelRotation', Number(v))}
          >
            <SelectTrigger className="w-full !h-8 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {[0, 45, 90, 135, 180].map((deg) => (
                <SelectItem key={deg} value={String(deg)}>
                  {deg}°
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CartesianCustomizeFieldRow>

        <CartesianCustomizeFieldRow label="Y label rotation">
          <Select
            value={String(options.yAxisLabelRotation ?? 0)}
            onValueChange={(v) => update('yAxisLabelRotation', Number(v))}
          >
            <SelectTrigger className="w-full !h-8 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {[0, 45, 90, 135, 180].map((deg) => (
                <SelectItem key={deg} value={String(deg)}>
                  {deg}°
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CartesianCustomizeFieldRow>
      </div>
    </CartesianCustomizeCollapsibleSection>
  );
}
