import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { colorSchemes, ColorSchemePreview } from '../../pie/customize/pieColorSchemes';
import {
  FunnelCustomizeCollapsibleSection,
  FunnelCustomizeFieldRow,
  useFunnelCustomizeHandlers,
  type FunnelCustomizeSectionProps,
} from './funnelCustomizeShared';

type Props = FunnelCustomizeSectionProps & { defaultOpen?: boolean };

export function FunnelAppearanceCustomizeSection({ options, onOptionsChange, defaultOpen = true }: Props) {
  const { update } = useFunnelCustomizeHandlers(options, onOptionsChange);
  const selected = colorSchemes.find((cs) => cs.value === (options.colorScheme || 'agentic-base'));

  return (
    <FunnelCustomizeCollapsibleSection
      title="Colors"
      description="Stage palette for funnel segments"
      defaultOpen={defaultOpen}
    >
      <FunnelCustomizeFieldRow label="Color scheme">
        <Select
          value={options.colorScheme || 'agentic-base'}
          onValueChange={(value) => update('colorScheme', value)}
        >
          <SelectTrigger className="w-full max-w-full !h-8 min-w-0 text-xs [&>span]:truncate">
            <div className="flex w-full min-w-0 items-center justify-between">
              <SelectValue />
              {selected ? <ColorSchemePreview colors={selected.colors} showOnlyFirst compact /> : null}
            </div>
          </SelectTrigger>
          <SelectContent className="max-w-[var(--radix-select-trigger-width)]">
            {colorSchemes.map((scheme) => (
              <SelectItem key={scheme.value} value={scheme.value}>
                <div className="flex w-full min-w-0 items-center justify-between">
                  <span className="mr-2 truncate text-xs">{scheme.name}</span>
                  <ColorSchemePreview colors={scheme.colors} compact />
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </FunnelCustomizeFieldRow>
    </FunnelCustomizeCollapsibleSection>
  );
}
