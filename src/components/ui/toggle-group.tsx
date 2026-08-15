import * as React from "react"
import MuiToggleButtonGroup from "@mui/material/ToggleButtonGroup"
import MuiToggleButton from "@mui/material/ToggleButton"

interface ToggleGroupProps
  extends Omit<React.ComponentPropsWithoutRef<typeof MuiToggleButtonGroup>, "value" | "defaultValue" | "onChange" | "exclusive"> {
  type?: "single" | "multiple"
  value?: string | string[]
  defaultValue?: string | string[]
  onValueChange?: (value: string | string[]) => void
}

const ToggleGroup = React.forwardRef<HTMLDivElement, ToggleGroupProps>(
  ({ type = "single", value, defaultValue, onValueChange, className, children, ...props }, ref) => {
    const [internal, setInternal] = React.useState(defaultValue ?? (type === "single" ? "" : []))
    const current = value !== undefined ? value : internal

    return (
      <MuiToggleButtonGroup
        ref={ref}
        data-slot="toggle-group"
        className={className}
        exclusive={type === "single"}
        value={current}
        onChange={(_event, newValue) => {
          // MUI's exclusive group can emit `null` when the pressed button is
          // toggled off — Radix's "single" type expects "" in that case.
          const normalized = type === "single" ? newValue ?? "" : newValue
          setInternal(normalized)
          onValueChange?.(normalized)
        }}
        {...props}
      >
        {children}
      </MuiToggleButtonGroup>
    )
  },
)
ToggleGroup.displayName = "ToggleGroup"

const ToggleGroupItem = React.forwardRef<
  HTMLButtonElement,
  React.ComponentPropsWithoutRef<typeof MuiToggleButton>
>(({ className, children, ...props }, ref) => {
  return (
    <MuiToggleButton ref={ref} data-slot="toggle-group-item" className={className} {...props}>
      {children}
    </MuiToggleButton>
  )
})
ToggleGroupItem.displayName = "ToggleGroupItem"

export { ToggleGroup, ToggleGroupItem }
