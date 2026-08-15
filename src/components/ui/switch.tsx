import * as React from "react"
import MuiSwitch from "@mui/material/Switch"

export interface SwitchProps
  extends Omit<React.ComponentPropsWithoutRef<typeof MuiSwitch>, "onChange"> {
  // Radix's switch convention — kept so existing call sites
  // (<Switch onCheckedChange={(v) => ...} />) don't need to change.
  onCheckedChange?: (checked: boolean) => void
}

const Switch = React.forwardRef<HTMLButtonElement, SwitchProps>(
  ({ onCheckedChange, className, ...props }, ref) => {
    return (
      <MuiSwitch
        ref={ref}
        data-slot="switch"
        className={className}
        onChange={(_event, checked) => onCheckedChange?.(checked)}
        {...props}
      />
    )
  },
)
Switch.displayName = "Switch"

export { Switch }
