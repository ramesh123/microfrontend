import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { colorSchemes, ColorSchemePreview } from '../../pie/customize/pieColorSchemes';
import {
  SunburstCustomizeCollapsibleSection,
  SunburstCustomizeFieldRow,
  useSunburstCustomizeHandlers,
  type SunburstCustomizeSectionProps,
} from './sunburstCustomizeShared';

type Props = SunburstCustomizeSectionProps & { defaultOpen?: boolean };

export function SunburstAppearanceCustomizeSection({ options, onOptionsChange, defaultOpen = true }: Props) {
  const { update } = useSunburstCustomizeHandlers(options, onOptionsChange);
  const selected = colorSchemes.find((cs) => cs.value === (options.colorScheme || 'agentic-base'));

  return (
    <SunburstCustomizeCollapsibleSection
      title="Colors"
      description="Ring palette for sunburst hierarchy"
      defaultOpen={defaultOpen}
    >
      <SunburstCustomizeFieldRow label="Color scheme">
        <Select
          value={options.colorScheme || 'agentic-base'}
          onValueChange={(value) => update('colorScheme', value)}
        >
          <SelectTrigger className="w-full !h-8 text-xs">
            <div className="flex w-full items-center justify-between">
              <SelectValue />
              {selected ? <ColorSchemePreview colors={selected.colors} showOnlyFirst compact /> : null}
            </div>
          </SelectTrigger>
          <SelectContent>
            {colorSchemes.map((scheme) => (
              <SelectItem key={scheme.value} value={scheme.value}>
                <div className="flex w-full items-center justify-between">
                  <span className="text-xs">{scheme.name}</span>
                  <ColorSchemePreview colors={scheme.colors} compact />
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </SunburstCustomizeFieldRow>
    </SunburstCustomizeCollapsibleSection>
  );
}
