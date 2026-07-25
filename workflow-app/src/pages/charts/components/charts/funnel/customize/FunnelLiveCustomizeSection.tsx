import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { BIG_NUMBER_STREAM_REFRESH_INTERVALS } from '../../bigNumber/customize/bigNumberStreamRefreshIntervals';
import {
  FunnelCustomizeCollapsibleSection,
  FunnelCustomizeFieldRow,
  FunnelCustomizeToggleRow,
  useFunnelCustomizeHandlers,
  type FunnelCustomizeSectionProps,
} from './funnelCustomizeShared';

type Props = FunnelCustomizeSectionProps & { defaultOpen?: boolean };

export function FunnelLiveCustomizeSection({ options, onOptionsChange, defaultOpen = false }: Props) {
  const { update } = useFunnelCustomizeHandlers(options, onOptionsChange);

  return (
    <FunnelCustomizeCollapsibleSection
      title="Live & animation"
      description="Auto-refresh and entrance animation"
      defaultOpen={defaultOpen}
    >
      <FunnelCustomizeFieldRow
        label="Refresh interval"
        hint="Automatically reload chart data on dashboards and analytics"
      >
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
      </FunnelCustomizeFieldRow>

      <FunnelCustomizeToggleRow
        label="Animate on load"
        checked={options.animation}
        onCheckedChange={(checked) => update('animation', checked)}
      />
    </FunnelCustomizeCollapsibleSection>
  );
}
