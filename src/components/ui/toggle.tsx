import * as React from "react"
import MuiToggleButton from "@mui/material/ToggleButton"
import { cva, type VariantProps } from "class-variance-authority"

// Kept only as a type source for size/variant props consumed by ToggleGroup;
// no longer applied as Tailwind classes since rendering now goes through MUI.
const toggleVariants = cva("", {
  variants: {
    variant: { default: "", outline: "" },
    size: { default: "", sm: "", lg: "" },
  },
  defaultVariants: { variant: "default", size: "default" },
})

export interface ToggleProps
  extends Omit<React.ComponentPropsWithoutRef<typeof MuiToggleButton>, "value" | "onChange">,
    VariantProps<typeof toggleVariants> {
  pressed?: boolean
  defaultPressed?: boolean
  onPressedChange?: (pressed: boolean) => void
  value?: string
}

const sizeToMui = { default: "medium", sm: "small", lg: "large" } as const

const Toggle = React.forwardRef<HTMLButtonElement, ToggleProps>(
  ({ className, variant, size, pressed, defaultPressed, onPressedChange, value, ...props }, ref) => {
    const [internalPressed, setInternalPressed] = React.useState(defaultPressed ?? false)
    const isPressed = pressed !== undefined ? pressed : internalPressed

    return (
      <MuiToggleButton
        ref={ref}
        data-slot="toggle"
        className={className}
        value={value ?? "toggle"}
        selected={isPressed}
        size={size ? sizeToMui[size] : "medium"}
        color={variant === "outline" ? "standard" : "primary"}
        onChange={() => {
          const next = !isPressed
          setInternalPressed(next)
          onPressedChange?.(next)
        }}
        {...props}
      />
    )
  },
)

Toggle.displayName = "Toggle"

export { Toggle, toggleVariants }
