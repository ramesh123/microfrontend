import * as React from "react"
import MuiSlider from "@mui/material/Slider"

export interface SliderProps
  extends Omit<React.ComponentPropsWithoutRef<typeof MuiSlider>, "onChange" | "value" | "defaultValue"> {
  value?: number[]
  defaultValue?: number[]
  // Radix's slider emits an array even for a single thumb — kept so
  // existing call sites (<Slider onValueChange={(v) => ...} />) don't change.
  onValueChange?: (value: number[]) => void
}

function Slider({ value, defaultValue, onValueChange, min = 0, max = 100, className, ...props }: SliderProps) {
  return (
    <MuiSlider
      data-slot="slider"
      className={className}
      value={value}
      defaultValue={defaultValue}
      min={min}
      max={max}
      onChange={(_event, newValue) => onValueChange?.(Array.isArray(newValue) ? newValue : [newValue])}
      {...props}
    />
  )
}

export { Slider }
