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
  useFunnelCustomizeHandlers,
  type FunnelCustomizeSectionProps,
} from './funnelCustomizeShared';

type Props = FunnelCustomizeSectionProps & { defaultOpen?: boolean };

export function FunnelLegendCustomizeSection({ options, onOptionsChange, defaultOpen = false }: Props) {
  const { updateOptions } = useFunnelCustomizeHandlers(options, onOptionsChange);

  return (
    <FunnelCustomizeCollapsibleSection
      title="Legend"
      description="Legend placement below or beside the chart"
      defaultOpen={defaultOpen}
    >
      <FunnelCustomizeFieldRow label="Legend position" hint="Where the chart legend is placed">
        <Select
          value={options.showLegend ? (options.legendOrientation || 'bottom') : 'none'}
          onValueChange={(value) => {
            if (value === 'none') {
              updateOptions({ showLegend: false });
            } else {
              updateOptions({
                showLegend: true,
                legendOrientation: value as 'bottom' | 'top' | 'left' | 'right',
              });
            }
          }}
        >
          <SelectTrigger className="w-full max-w-full !h-8 min-w-0 text-sm [&>span]:truncate">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">None (hide legend)</SelectItem>
            <SelectItem value="bottom">Bottom (recommended)</SelectItem>
            <SelectItem value="top">Top</SelectItem>
            <SelectItem value="left">Left</SelectItem>
            <SelectItem value="right">Right</SelectItem>
          </SelectContent>
        </Select>
      </FunnelCustomizeFieldRow>
    </FunnelCustomizeCollapsibleSection>
  );
}
