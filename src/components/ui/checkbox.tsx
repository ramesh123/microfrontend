import * as React from "react"
import MuiCheckbox from "@mui/material/Checkbox"

export interface CheckboxProps
  extends Omit<React.ComponentPropsWithoutRef<typeof MuiCheckbox>, "onChange" | "checked" | "defaultChecked"> {
  checked?: boolean | "indeterminate"
  defaultChecked?: boolean
  // Radix's checkbox convention (checked, then event) — kept so existing
  // call sites (<Checkbox onCheckedChange={(v) => ...} />) don't need to change.
  onCheckedChange?: (checked: boolean) => void
}

const Checkbox = React.forwardRef<HTMLButtonElement, CheckboxProps>(
  ({ checked, defaultChecked, onCheckedChange, className, ...props }, ref) => {
    return (
      <MuiCheckbox
        ref={ref}
        data-slot="checkbox"
        className={className}
        checked={checked === "indeterminate" ? false : checked}
        indeterminate={checked === "indeterminate"}
        defaultChecked={defaultChecked}
        onChange={(_event, isChecked) => onCheckedChange?.(isChecked)}
        {...props}
      />
    )
  },
)
Checkbox.displayName = "Checkbox"

export { Checkbox }
