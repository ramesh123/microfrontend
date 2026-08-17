import * as React from "react";
import "@material/web/switch/switch.js";

export interface SwitchProps extends Omit<React.HTMLAttributes<HTMLElement>, "onChange"> {
  checked?: boolean;
  defaultChecked?: boolean;
  disabled?: boolean;
  // Radix's switch convention — kept so existing call sites
  // (<Switch onCheckedChange={(v) => ...} />) don't need to change.
  onCheckedChange?: (checked: boolean) => void;
}

// md-switch's "checked" state is exposed as the `selected` property, not
// `checked` — see node_modules/@material/web/switch/internal/switch.d.ts.
const Switch = React.forwardRef<HTMLElement, SwitchProps>(
  ({ checked, defaultChecked, onCheckedChange, className, ...props }, ref) => {
    return (
      <md-switch
        ref={ref}
        data-slot="switch"
        className={className}
        selected={checked ?? defaultChecked}
        onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
          onCheckedChange?.((e.target as unknown as { selected: boolean }).selected)
        }
        {...props}
      />
    );
  },
);
Switch.displayName = "Switch";

export { Switch };
