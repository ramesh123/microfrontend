import {
  SunburstCustomizeCollapsibleSection,
  SunburstCustomizeToggleRow,
  useSunburstCustomizeHandlers,
  type SunburstCustomizeSectionProps,
} from './sunburstCustomizeShared';

type Props = SunburstCustomizeSectionProps & { defaultOpen?: boolean };

export function SunburstLegendCustomizeSection({ options, onOptionsChange, defaultOpen = false }: Props) {
  const { update } = useSunburstCustomizeHandlers(options, onOptionsChange);

  return (
    <SunburstCustomizeCollapsibleSection
      title="Legend"
      description="Bottom legend and optional total label"
      defaultOpen={defaultOpen}
    >
      <SunburstCustomizeToggleRow
        label="Show legend"
        checked={options.showLegend}
        onCheckedChange={(checked) => update('showLegend', checked)}
      />
      <SunburstCustomizeToggleRow
        label="Show total"
        hint="Display aggregated total above the chart"
        checked={Boolean(options.showTotal)}
        onCheckedChange={(checked) => update('showTotal', checked)}
      />
    </SunburstCustomizeCollapsibleSection>
  );
}
