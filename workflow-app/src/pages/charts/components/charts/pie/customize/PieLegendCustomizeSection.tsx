import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  PieCustomizeCollapsibleSection,
  PieCustomizeFieldRow,
  usePieCustomizeHandlers,
  type PieCustomizeSectionProps,
} from './pieCustomizeShared';

type Props = PieCustomizeSectionProps & {
  defaultOpen?: boolean;
  showSideLegend?: boolean;
};

export function PieLegendCustomizeSection({
  options,
  onOptionsChange,
  defaultOpen = false,
  showSideLegend = true,
}: Props) {
  const { update, updateOptions } = usePieCustomizeHandlers(options, onOptionsChange);

  return (
    <PieCustomizeCollapsibleSection
      title="Legend"
      description="Standard legend placement and optional side panel"
      defaultOpen={defaultOpen}
    >
      <PieCustomizeFieldRow label="Legend position" hint="Where the chart legend is placed">
        <Select
          value={options.showLegend ? (options.legendOrientation || 'bottom') : 'none'}
          onValueChange={(value) => {
            if (value === 'none') {
              updateOptions({ showLegend: false });
            } else {
              updateOptions({ showLegend: true, legendOrientation: value });
            }
          }}
        >
          <SelectTrigger className="w-full !h-8 text-sm">
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
      </PieCustomizeFieldRow>

      {showSideLegend ? (
        <>
          <div className="flex items-center space-x-2">
            <Checkbox
              id="show-side-legend"
              checked={options.showSideLegend === true}
              onCheckedChange={(checked) => update('showSideLegend', checked === true)}
            />
            <Label htmlFor="show-side-legend" className="cursor-pointer text-xs font-medium">
              Display side legend
            </Label>
          </div>
          {options.showSideLegend ? (
            <PieCustomizeFieldRow
              label="Side legend position"
              hint="Category name with value and percentage beside the chart"
            >
              <Select
                value={options.sideLegendOrientation === 'left' ? 'left' : 'right'}
                onValueChange={(value) => update('sideLegendOrientation', value as 'left' | 'right')}
              >
                <SelectTrigger className="w-full !h-8 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="right">Right</SelectItem>
                  <SelectItem value="left">Left</SelectItem>
                </SelectContent>
              </Select>
            </PieCustomizeFieldRow>
          ) : null}
        </>
      ) : null}
    </PieCustomizeCollapsibleSection>
  );
}
