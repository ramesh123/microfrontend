import * as React from "react";
import "@material/web/slider/slider.js";

export interface SliderProps extends Omit<React.HTMLAttributes<HTMLElement>, "onChange" | "defaultValue"> {
  value?: number[];
  defaultValue?: number[];
  min?: number;
  max?: number;
  step?: number;
  disabled?: boolean;
  // Radix's slider emits an array even for a single thumb — kept so
  // existing call sites (<Slider onValueChange={(v) => ...} />) don't change.
  // Only single-thumb sliders are supported here (every call site in this
  // app passes a one-element array); md-slider's two-thumb "range" mode
  // (valueStart/valueEnd) would need a different prop shape if that's ever
  // needed.
  onValueChange?: (value: number[]) => void;
}

function Slider({ value, defaultValue, onValueChange, min = 0, max = 100, className, ...props }: SliderProps) {
  const current = value?.[0] ?? defaultValue?.[0];
  return (
    <md-slider
      data-slot="slider"
      className={className}
      value={current}
      min={min}
      max={max}
      onInput={(e: React.FormEvent<HTMLElement>) =>
        onValueChange?.([(e.target as unknown as { value: number }).value])
      }
      {...props}
    />
  );
}

export { Slider };
