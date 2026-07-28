import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  FunnelCustomizeCollapsibleSection,
  FunnelCustomizeFieldRow,
  FunnelCustomizeToggleRow,
  useFunnelCustomizeHandlers,
  type FunnelCustomizeSectionProps,
} from './funnelCustomizeShared';

const LABEL_CONTENT_OPTIONS = [
  { value: 'category_name', label: 'Category name' },
  { value: 'value', label: 'Value' },
  { value: 'percentage', label: 'Percentage' },
  { value: 'category_value', label: 'Category and value' },
  { value: 'category_percentage', label: 'Category and percentage' },
  { value: 'category_value_percentage', label: 'Category, value and percentage' },
] as const;

type Props = FunnelCustomizeSectionProps & { defaultOpen?: boolean };

export function FunnelLabelsCustomizeSection({ options, onOptionsChange, defaultOpen = false }: Props) {
  const { update } = useFunnelCustomizeHandlers(options, onOptionsChange);

  return (
    <FunnelCustomizeCollapsibleSection
      title="Labels"
      description="Slice labels on funnel stages"
      defaultOpen={defaultOpen}
    >
      <FunnelCustomizeFieldRow label="Font size">
        <Input
          type="number"
          min={8}
          max={24}
          value={options.fontSize}
          onChange={(event) => update('fontSize', Number(event.target.value) || 12)}
          className="h-8 text-sm"
        />
      </FunnelCustomizeFieldRow>

      <FunnelCustomizeFieldRow label="Label content">
        <Select
          value={options.labelContents || 'category_name'}
          onValueChange={(value) => update('labelContents', value)}
        >
          <SelectTrigger className="w-full max-w-full !h-8 min-w-0 text-sm [&>span]:truncate">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="max-w-[var(--radix-select-trigger-width)]">
            {LABEL_CONTENT_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value} className="whitespace-normal break-words">
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </FunnelCustomizeFieldRow>

      <FunnelCustomizeToggleRow
        label="Show labels"
        checked={options.showLabels}
        onCheckedChange={(checked) => update('showLabels', checked)}
      />
    </FunnelCustomizeCollapsibleSection>
  );
}
