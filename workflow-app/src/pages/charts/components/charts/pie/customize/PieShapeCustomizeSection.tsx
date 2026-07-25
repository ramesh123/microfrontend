import { Slider } from '@/components/ui/slider';
import {
  PieCustomizeCollapsibleSection,
  PieCustomizeFieldRow,
  usePieCustomizeHandlers,
  type PieCustomizeSectionProps,
} from './pieCustomizeShared';

type Props = PieCustomizeSectionProps & {
  defaultOpen?: boolean;
  isDonutChartType?: boolean;
};

export function PieShapeCustomizeSection({
  options,
  onOptionsChange,
  defaultOpen = false,
  isDonutChartType = false,
}: Props) {
  const { update } = usePieCustomizeHandlers(options, onOptionsChange);

  return (
    <PieCustomizeCollapsibleSection
      title="Chart shape"
      description="Outer size and donut hole"
      defaultOpen={defaultOpen}
    >
      <PieCustomizeFieldRow label="Outer radius" hint="Adjust pie or donut size">
        <div>
          <Slider
            value={[options.outerRadius]}
            onValueChange={(value) => update('outerRadius', value[0])}
            min={0}
            max={100}
            step={1}
            className="w-full"
          />
          <div className="mt-1 flex justify-between text-[10px] text-slate-400">
            <span>0%</span>
            <span>{options.outerRadius}%</span>
            <span>100%</span>
          </div>
        </div>
      </PieCustomizeFieldRow>

      {isDonutChartType ? (
        <PieCustomizeFieldRow label="Inner radius" hint="Adjust the donut hole size">
          <div>
            <Slider
              value={[options.innerRadius ?? 50]}
              onValueChange={(value) => update('innerRadius', value[0])}
              min={0}
              max={90}
              step={1}
              className="w-full"
            />
            <div className="mt-1 flex justify-between text-[10px] text-slate-400">
              <span>0%</span>
              <span>{options.innerRadius ?? 50}%</span>
              <span>90%</span>
            </div>
          </div>
        </PieCustomizeFieldRow>
      ) : null}
    </PieCustomizeCollapsibleSection>
  );
}
