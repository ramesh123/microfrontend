import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { colorSchemes, ColorSchemePreview } from './pieColorSchemes';
import {
  PieCustomizeCollapsibleSection,
  PieCustomizeFieldRow,
  usePieCustomizeHandlers,
  type PieCustomizeSectionProps,
} from './pieCustomizeShared';

type Props = PieCustomizeSectionProps & { defaultOpen?: boolean };

export function PieAppearanceCustomizeSection({ options, onOptionsChange, defaultOpen = true }: Props) {
  const { update } = usePieCustomizeHandlers(options, onOptionsChange);
  const selected = colorSchemes.find((cs) => cs.value === options.colorScheme);

  return (
    <PieCustomizeCollapsibleSection
      title="Colors"
      description="Slice palette for pie, donut, and radius pie"
      defaultOpen={defaultOpen}
    >
      <PieCustomizeFieldRow label="Color scheme">
        <Select value={options.colorScheme} onValueChange={(value) => update('colorScheme', value)}>
          <SelectTrigger className="w-full !h-8 text-xs">
            <div className="flex w-full items-center justify-between">
              <SelectValue />
              {selected ? (
                <ColorSchemePreview colors={selected.colors} showOnlyFirst compact />
              ) : null}
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
      </PieCustomizeFieldRow>
    </PieCustomizeCollapsibleSection>
  );
}
