import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { BIG_NUMBER_STREAM_REFRESH_INTERVALS } from '../../bigNumber/customize/bigNumberStreamRefreshIntervals';
import {
  GaugeCustomizeCollapsibleSection,
  GaugeCustomizeFieldRow,
  useGaugeCustomizeHandlers,
  type GaugeCustomizeSectionProps,
} from './gaugeCustomizeShared';

type Props = GaugeCustomizeSectionProps & { defaultOpen?: boolean };

export function GaugeLiveCustomizeSection({
  options,
  onOptionsChange,
  defaultOpen = false,
}: Props) {
  const { update } = useGaugeCustomizeHandlers(options, onOptionsChange);

  return (
    <GaugeCustomizeCollapsibleSection
      title="Live refresh"
      description="Automatically reload gauge data on dashboards"
      defaultOpen={defaultOpen}
    >
      <GaugeCustomizeFieldRow label="Refresh interval">
        <Select
          value={String(options.refreshIntervalSeconds ?? 0)}
          onValueChange={(value) => update('refreshIntervalSeconds', Number(value))}
        >
          <SelectTrigger className="w-full max-w-full !h-8 min-w-0 text-sm [&>span]:truncate">
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
      </GaugeCustomizeFieldRow>
    </GaugeCustomizeCollapsibleSection>
  );
}
