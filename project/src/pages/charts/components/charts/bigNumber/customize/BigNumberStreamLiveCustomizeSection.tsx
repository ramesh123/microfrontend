import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { BIG_NUMBER_STREAM_REFRESH_INTERVALS } from './bigNumberStreamRefreshIntervals';
import {
  BigNumberCustomizeCollapsibleSection,
  BigNumberCustomizeFieldRow,
  useBigNumberCustomizeHandlers,
} from './bigNumberCustomizeShared';
import type { BigNumberStreamCustomizationOptions } from './BigNumberStreamCustomizePanel';

export function BigNumberStreamLiveCustomizeSection({
  options,
  onOptionsChange,
  defaultOpen = false,
}: {
  options: BigNumberStreamCustomizationOptions;
  onOptionsChange: (next: BigNumberStreamCustomizationOptions) => void;
  defaultOpen?: boolean;
}) {
  const { update } = useBigNumberCustomizeHandlers(options, onOptionsChange);

  return (
    <BigNumberCustomizeCollapsibleSection
      title="Live stream"
      description="Auto-refresh and live KPI behaviour"
      defaultOpen={defaultOpen}
    >
      <BigNumberCustomizeFieldRow
        label="Refresh interval"
        hint="Automatically reload chart data on this schedule."
      >
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
      </BigNumberCustomizeFieldRow>
    </BigNumberCustomizeCollapsibleSection>
  );
}
