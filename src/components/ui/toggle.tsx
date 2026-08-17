import * as React from "react";
import "@material/web/iconbutton/icon-button.js";
import { cva, type VariantProps } from "class-variance-authority";

// Kept only as a type source for size/variant props consumed by ToggleGroup;
// no longer applied as Tailwind classes since rendering goes through
// md-icon-button's own toggle mode (toggle + selected props).
const toggleVariants = cva("", {
  variants: {
    variant: { default: "", outline: "" },
    size: { default: "", sm: "", lg: "" },
  },
  defaultVariants: { variant: "default", size: "default" },
});

export interface ToggleProps
  extends Omit<React.HTMLAttributes<HTMLElement>, "value" | "onChange">,
    VariantProps<typeof toggleVariants> {
  pressed?: boolean;
  defaultPressed?: boolean;
  onPressedChange?: (pressed: boolean) => void;
  value?: string;
  disabled?: boolean;
}

const Toggle = React.forwardRef<HTMLElement, ToggleProps>(
  ({ className, variant, size, pressed, defaultPressed, onPressedChange, value, ...props }, ref) => {
    const [internalPressed, setInternalPressed] = React.useState(defaultPressed ?? false);
    const isPressed = pressed !== undefined ? pressed : internalPressed;

    return (
      <md-icon-button
        ref={ref}
        data-slot="toggle"
        className={className}
        toggle
        selected={isPressed}
        onClick={() => {
          const next = !isPressed;
          setInternalPressed(next);
          onPressedChange?.(next);
        }}
        {...props}
      />
    );
  },
);

Toggle.displayName = "Toggle";

export { Toggle, toggleVariants };
