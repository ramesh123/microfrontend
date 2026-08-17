import * as React from "react";
import "@material/web/checkbox/checkbox.js";

export interface CheckboxProps extends Omit<React.HTMLAttributes<HTMLElement>, "onChange"> {
  checked?: boolean | "indeterminate";
  defaultChecked?: boolean;
  disabled?: boolean;
  // Radix's checkbox convention (checked, then event) — kept so existing
  // call sites (<Checkbox onCheckedChange={(v) => ...} />) don't need to change.
  onCheckedChange?: (checked: boolean) => void;
}

// md-checkbox fires a native `change` event on itself (bubbles: true) — see
// node_modules/@material/web/checkbox/internal/checkbox.d.ts — which reaches
// a plain onChange prop the same way it would on a native <input>.
const Checkbox = React.forwardRef<HTMLElement, CheckboxProps>(
  ({ checked, defaultChecked, onCheckedChange, className, ...props }, ref) => {
    return (
      <md-checkbox
        ref={ref}
        data-slot="checkbox"
        className={className}
        checked={checked === "indeterminate" ? false : checked}
        indeterminate={checked === "indeterminate"}
        onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
          onCheckedChange?.((e.target as unknown as { checked: boolean }).checked)
        }
        {...(defaultChecked !== undefined && checked === undefined ? { checked: defaultChecked } : {})}
        {...props}
      />
    );
  },
);
Checkbox.displayName = "Checkbox";

export { Checkbox };
