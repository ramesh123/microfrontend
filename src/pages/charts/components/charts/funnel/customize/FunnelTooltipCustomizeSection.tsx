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

const TOOLTIP_CONTENT_OPTIONS = [
  { value: 'category_value_percentage', label: 'Category, value and percentage' },
  { value: 'category_name', label: 'Category name' },
  { value: 'value', label: 'Value' },
  { value: 'percentage', label: 'Percentage' },
  { value: 'category_value', label: 'Category and value' },
  { value: 'category_percentage', label: 'Category and percentage' },
] as const;

type Props = FunnelCustomizeSectionProps & { defaultOpen?: boolean };

export function FunnelTooltipCustomizeSection({ options, onOptionsChange, defaultOpen = false }: Props) {
  const { update } = useFunnelCustomizeHandlers(options, onOptionsChange);

  return (
    <FunnelCustomizeCollapsibleSection
      title="Tooltips"
      description="Hover content on funnel stages"
      defaultOpen={defaultOpen}
    >
      <FunnelCustomizeToggleRow
        label="Show tooltip"
        checked={options.showTooltipLabels !== false}
        onCheckedChange={(checked) => update('showTooltipLabels', checked)}
      />

      <FunnelCustomizeFieldRow label="Tooltip content">
        <Select
          value={options.tooltipContents || 'category_value_percentage'}
          onValueChange={(value) => update('tooltipContents', value)}
        >
          <SelectTrigger className="w-full max-w-full !h-8 min-w-0 text-sm [&>span]:truncate">
            <SelectValue placeholder="Category, value and percentage" />
          </SelectTrigger>
          <SelectContent className="max-w-[var(--radix-select-trigger-width)]">
            {TOOLTIP_CONTENT_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value} className="whitespace-normal break-words">
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </FunnelCustomizeFieldRow>
    </FunnelCustomizeCollapsibleSection>
  );
}
