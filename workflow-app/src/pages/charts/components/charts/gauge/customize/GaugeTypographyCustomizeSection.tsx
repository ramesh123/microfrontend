import { Slider } from '@/components/ui/slider';
import {
  GaugeCustomizeCollapsibleSection,
  GaugeCustomizeFieldRow,
  useGaugeCustomizeHandlers,
  type GaugeCustomizeSectionProps,
} from './gaugeCustomizeShared';

type Props = GaugeCustomizeSectionProps & { defaultOpen?: boolean };

export function GaugeTypographyCustomizeSection({
  options,
  onOptionsChange,
  defaultOpen = false,
}: Props) {
  const { update } = useGaugeCustomizeHandlers(options, onOptionsChange);

  return (
    <GaugeCustomizeCollapsibleSection
      title="Typography"
      description="Centre value label font size"
      defaultOpen={defaultOpen}
    >
      <GaugeCustomizeFieldRow label="Font size">
        <div>
          <Slider
            value={[options.fontSize]}
            onValueChange={(value) => update('fontSize', value[0])}
            min={8}
            max={24}
            step={1}
            className="w-full"
          />
          <div className="mt-1 flex justify-between text-[10px] text-muted-foreground">
            <span>8px</span>
            <span>{options.fontSize}px</span>
            <span>24px</span>
          </div>
        </div>
      </GaugeCustomizeFieldRow>
    </GaugeCustomizeCollapsibleSection>
  );
}
