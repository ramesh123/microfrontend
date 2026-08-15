import * as React from "react"
import MuiRadio from "@mui/material/Radio"
import MuiRadioGroup from "@mui/material/RadioGroup"

export interface RadioGroupProps
  extends Omit<React.ComponentPropsWithoutRef<typeof MuiRadioGroup>, "onChange" | "value" | "defaultValue"> {
  value?: string
  defaultValue?: string
  // Radix's convention — kept so existing call sites
  // (<RadioGroup onValueChange={(v) => ...} />) don't need to change.
  onValueChange?: (value: string) => void
}

const RadioGroup = React.forwardRef<HTMLDivElement, RadioGroupProps>(
  ({ value, defaultValue, onValueChange, className, ...props }, ref) => {
    return (
      <MuiRadioGroup
        ref={ref}
        data-slot="radio-group"
        className={className}
        value={value}
        defaultValue={defaultValue}
        onChange={(_event, newValue) => onValueChange?.(newValue)}
        {...props}
      />
    )
  },
)
RadioGroup.displayName = "RadioGroup"

// MUI's Radio auto-registers with the nearest ancestor RadioGroup via
// internal context — no extra wiring needed here, unlike Radix where each
// RadioGroupItem talked to RadioGroupPrimitive.Root explicitly.
const RadioGroupItem = React.forwardRef<
  HTMLButtonElement,
  React.ComponentPropsWithoutRef<typeof MuiRadio> & { value: string }
>(({ className, ...props }, ref) => {
  return <MuiRadio ref={ref} data-slot="radio-group-item" className={className} {...props} />
})
RadioGroupItem.displayName = "RadioGroupItem"

export { RadioGroup, RadioGroupItem }
