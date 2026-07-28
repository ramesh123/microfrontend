import {
  CartesianCustomizeCollapsibleSection,
  useCartesianCustomizeHandlers,
  type CartesianCustomizeSectionProps,
} from '../../cartesian/customize/cartesianCustomizeShared';
import {
  CartesianCurveStyleCustomizeField,
  resolveCartesianCurveStyle,
} from '../../cartesian/customize/cartesianCurveStyleUi';
import {
  CartesianLineThicknessField,
  DEFAULT_LINE_THICKNESS,
  resolveLineThickness,
} from '../../cartesian/customize/cartesianLineThicknessUi';
import { defaultOptions, type LineCustomizationOptions } from './lineCustomizeTypes';

type Props = CartesianCustomizeSectionProps<LineCustomizationOptions> & { defaultOpen?: boolean };

export function LineAppearanceCustomizeSection({
  options,
  onOptionsChange,
  defaultOpen = true,
}: Props) {
  const normalized = { ...defaultOptions, ...options };
  const { update } = useCartesianCustomizeHandlers(normalized, onOptionsChange);
  const curveStyle = resolveCartesianCurveStyle(normalized, 'lineCurveStyle');
  const lineThickness = resolveLineThickness(normalized.lineThickness, DEFAULT_LINE_THICKNESS);

  return (
    <CartesianCustomizeCollapsibleSection
      title="Line style"
      description="Curve interpolation between data points"
      defaultOpen={defaultOpen}
    >
      <CartesianCurveStyleCustomizeField
        styleKey="lineCurveStyle"
        variant="line"
        options={normalized}
        onOptionsChange={onOptionsChange}
        value={curveStyle}
        onSelect={(value) => update('lineCurveStyle', value)}
      />

      <CartesianLineThicknessField
        value={lineThickness}
        onChange={(value) => update('lineThickness', value)}
      />
    </CartesianCustomizeCollapsibleSection>
  );
}
