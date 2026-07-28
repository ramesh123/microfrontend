import { Slider } from '@/components/ui/slider';
import {
  CartesianCustomizeCollapsibleSection,
  CartesianCustomizeFieldRow,
  CartesianCustomizeToggleRow,
  useCartesianCustomizeHandlers,
  type CartesianCustomizeSectionProps,
} from '../../cartesian/customize/cartesianCustomizeShared';
import {
  CartesianCurveStyleCustomizeField,
  resolveCartesianCurveStyle,
} from '../../cartesian/customize/cartesianCurveStyleUi';
import {
  CartesianLineThicknessField,
  DEFAULT_AREA_LINE_THICKNESS,
  resolveLineThickness,
} from '../../cartesian/customize/cartesianLineThicknessUi';
import {
  defaultOptions,
  type AreaCustomizationOptions,
} from './areaCustomizeTypes';

type Props = CartesianCustomizeSectionProps<AreaCustomizationOptions> & { defaultOpen?: boolean };

export function AreaAppearanceCustomizeSection({
  options,
  onOptionsChange,
  defaultOpen = true,
}: Props) {
  const normalized = { ...defaultOptions, ...options };
  const { update } = useCartesianCustomizeHandlers(normalized, onOptionsChange);
  const curveStyle = resolveCartesianCurveStyle(normalized, 'areaCurveStyle');
  const fillOpacity = normalized.areaFillOpacity ?? defaultOptions.areaFillOpacity ?? 0.28;
  const lineThickness = resolveLineThickness(normalized.lineThickness, DEFAULT_AREA_LINE_THICKNESS);

  return (
    <CartesianCustomizeCollapsibleSection
      title="Area style"
      description="Curve interpolation, fill, and crosshair tooltip"
      defaultOpen={defaultOpen}
    >
      <CartesianCurveStyleCustomizeField
        styleKey="areaCurveStyle"
        variant="area"
        options={normalized}
        onOptionsChange={onOptionsChange}
        value={curveStyle}
        onSelect={(value) => update('areaCurveStyle', value)}
      />

      <CartesianLineThicknessField
        value={lineThickness}
        onChange={(value) => update('lineThickness', value)}
      />

      <CartesianCustomizeFieldRow label="Fill opacity" hint="Opacity of the gradient area fill">
        <div>
          <Slider
            value={[Math.round(fillOpacity * 100)]}
            onValueChange={(value) => update('areaFillOpacity', value[0] / 100)}
            min={5}
            max={70}
            step={1}
            className="w-full"
          />
          <div className="mt-1 flex justify-between text-[10px] text-muted-foreground">
            <span>5%</span>
            <span>{Math.round(fillOpacity * 100)}%</span>
            <span>70%</span>
          </div>
        </div>
      </CartesianCustomizeFieldRow>

      <CartesianCustomizeToggleRow
        label="Crosshair tooltip"
        hint="Vertical guide, point marker, category pill, and value summary label"
        checked={normalized.areaCrosshairTooltip !== false}
        onCheckedChange={(checked) => update('areaCrosshairTooltip', checked)}
      />

      <CartesianCustomizeToggleRow
        label="Dashed comparison lines"
        hint="When multiple metrics are present, render additional series as dashed lines without fill"
        checked={normalized.comparisonSeriesDashed !== false}
        onCheckedChange={(checked) => update('comparisonSeriesDashed', checked)}
      />
    </CartesianCustomizeCollapsibleSection>
  );
}
