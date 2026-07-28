import { Slider } from '@/components/ui/slider';
import { CartesianCustomizeFieldRow } from './cartesianCustomizeShared';

export const DEFAULT_LINE_THICKNESS = 2;
export const DEFAULT_AREA_LINE_THICKNESS = 2.25;
export const MIN_LINE_THICKNESS = 1;
export const MAX_LINE_THICKNESS = 8;

export function resolveLineThickness(
  value: unknown,
  fallback: number = DEFAULT_LINE_THICKNESS,
): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(MAX_LINE_THICKNESS, Math.max(MIN_LINE_THICKNESS, parsed));
}

type CartesianLineThicknessFieldProps = {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
};

export function CartesianLineThicknessField({
  value,
  onChange,
  min = MIN_LINE_THICKNESS,
  max = MAX_LINE_THICKNESS,
  step = 0.25,
}: CartesianLineThicknessFieldProps) {
  const displayValue = resolveLineThickness(value, DEFAULT_LINE_THICKNESS);

  return (
    <CartesianCustomizeFieldRow label="Line thickness" hint="Stroke width for the series line">
      <div>
        <Slider
          value={[displayValue]}
          onValueChange={(next) => onChange(resolveLineThickness(next[0], displayValue))}
          min={min}
          max={max}
          step={step}
          className="w-full"
        />
        <div className="mt-1 flex justify-between text-[10px] text-muted-foreground">
          <span>{min}px</span>
          <span>{displayValue.toFixed(displayValue % 1 === 0 ? 0 : 1)}px</span>
          <span>{max}px</span>
        </div>
      </div>
    </CartesianCustomizeFieldRow>
  );
}
