import { Input } from '@/components/ui/input';
import {
  SunburstCustomizeCollapsibleSection,
  SunburstCustomizeFieldRow,
  SunburstCustomizeToggleRow,
  useSunburstCustomizeHandlers,
  type SunburstCustomizeSectionProps,
} from './sunburstCustomizeShared';

type Props = SunburstCustomizeSectionProps & { defaultOpen?: boolean };

export function SunburstLabelsCustomizeSection({ options, onOptionsChange, defaultOpen = false }: Props) {
  const { update } = useSunburstCustomizeHandlers(options, onOptionsChange);

  return (
    <SunburstCustomizeCollapsibleSection
      title="Labels"
      description="Slice labels and font size on rings"
      defaultOpen={defaultOpen}
    >
      <SunburstCustomizeFieldRow label="Font size">
        <Input
          type="number"
          min={8}
          max={24}
          value={options.fontSize}
          onChange={(event) => update('fontSize', Number(event.target.value) || 12)}
          className="h-8 text-sm"
        />
      </SunburstCustomizeFieldRow>

      <SunburstCustomizeToggleRow
        label="Show labels"
        checked={options.showLabels}
        onCheckedChange={(checked) => update('showLabels', checked)}
      />
    </SunburstCustomizeCollapsibleSection>
  );
}
