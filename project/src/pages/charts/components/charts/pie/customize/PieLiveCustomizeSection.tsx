import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { BIG_NUMBER_STREAM_REFRESH_INTERVALS } from '../../bigNumber/customize/bigNumberStreamRefreshIntervals';
import {
  PieCustomizeCollapsibleSection,
  PieCustomizeFieldRow,
  usePieCustomizeHandlers,
  type PieCustomizeSectionProps,
} from './pieCustomizeShared';
import type { ChartCustomizationOptions } from './pieCustomizeTypes';

type Props = PieCustomizeSectionProps & {
  defaultOpen?: boolean;
  isRadiusPieChartType?: boolean;
};

export function PieLiveCustomizeSection({
  options,
  onOptionsChange,
  defaultOpen = false,
  isRadiusPieChartType = false,
}: Props) {
  const { update } = usePieCustomizeHandlers(options, onOptionsChange);

  return (
    <PieCustomizeCollapsibleSection
      title="Live & sorting"
      description="Auto-refresh and slice order"
      defaultOpen={defaultOpen}
    >
      <PieCustomizeFieldRow
        label="Refresh interval"
        hint="Automatically reload chart data on dashboards and analytics"
      >
        <Select
          value={String(options.refreshIntervalSeconds ?? 0)}
          onValueChange={(value) => update('refreshIntervalSeconds', Number(value))}
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
      </PieCustomizeFieldRow>

      {isRadiusPieChartType ? (
        <PieCustomizeFieldRow label="Sort slices by value" hint="Arrange slices by size instead of API order">
          <Select
            value={options.sortSliceBy ?? 'desc'}
            onValueChange={(value) =>
              update('sortSliceBy', value as ChartCustomizationOptions['sortSliceBy'])
            }
          >
            <SelectTrigger className="w-full !h-8 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="desc">Descending (largest first)</SelectItem>
              <SelectItem value="asc">Ascending (smallest first)</SelectItem>
              <SelectItem value="none">Response order (no sort)</SelectItem>
            </SelectContent>
          </Select>
        </PieCustomizeFieldRow>
      ) : null}
    </PieCustomizeCollapsibleSection>
  );
}
