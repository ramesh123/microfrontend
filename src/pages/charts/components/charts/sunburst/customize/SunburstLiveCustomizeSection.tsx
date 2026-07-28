import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { BIG_NUMBER_STREAM_REFRESH_INTERVALS } from '../../bigNumber/customize/bigNumberStreamRefreshIntervals';
import {
  SunburstCustomizeCollapsibleSection,
  SunburstCustomizeFieldRow,
  SunburstCustomizeToggleRow,
  useSunburstCustomizeHandlers,
  type SunburstCustomizeSectionProps,
} from './sunburstCustomizeShared';

type Props = SunburstCustomizeSectionProps & { defaultOpen?: boolean };

export function SunburstLiveCustomizeSection({ options, onOptionsChange, defaultOpen = false }: Props) {
  const { update } = useSunburstCustomizeHandlers(options, onOptionsChange);

  return (
    <SunburstCustomizeCollapsibleSection
      title="Live & animation"
      description="Auto-refresh and entrance animation"
      defaultOpen={defaultOpen}
    >
      <SunburstCustomizeFieldRow
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
      </SunburstCustomizeFieldRow>

      <SunburstCustomizeToggleRow
        label="Animate on load"
        checked={options.animation}
        onCheckedChange={(checked) => update('animation', checked)}
      />
    </SunburstCustomizeCollapsibleSection>
  );
}
