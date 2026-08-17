import * as React from "react";
import { cn } from "@/lib/utils";
import "@material/web/radio/radio.js";

// md-radio groups siblings by a shared `name` attribute (native radio-input
// semantics), not by an ancestor "RadioGroup" reading context the way MUI's
// did — using our own context instead keeps the existing controlled-value API
// (<RadioGroup value=... onValueChange=...>) working unchanged.
type RadioGroupCtx = { value?: string; onValueChange?: (value: string) => void };
const RadioGroupContext = React.createContext<RadioGroupCtx | null>(null);

export interface RadioGroupProps extends Omit<React.HTMLAttributes<HTMLDivElement>, "onChange"> {
  value?: string;
  defaultValue?: string;
  // Radix's convention — kept so existing call sites
  // (<RadioGroup onValueChange={(v) => ...} />) don't need to change.
  onValueChange?: (value: string) => void;
}

const RadioGroup = React.forwardRef<HTMLDivElement, RadioGroupProps>(
  ({ value, defaultValue, onValueChange, className, children, ...props }, ref) => {
    const [internal, setInternal] = React.useState(defaultValue);
    const current = value !== undefined ? value : internal;
    const handleChange = (next: string) => {
      setInternal(next);
      onValueChange?.(next);
    };
    return (
      <RadioGroupContext.Provider value={{ value: current, onValueChange: handleChange }}>
        <div ref={ref} data-slot="radio-group" role="radiogroup" className={cn("grid gap-2", className)} {...props}>
          {children}
        </div>
      </RadioGroupContext.Provider>
    );
  },
);
RadioGroup.displayName = "RadioGroup";

const RadioGroupItem = React.forwardRef<HTMLElement, React.HTMLAttributes<HTMLElement> & { value: string; disabled?: boolean }>(
  ({ className, value, ...props }, ref) => {
    const ctx = React.useContext(RadioGroupContext);
    return (
      <md-radio
        ref={ref}
        data-slot="radio-group-item"
        className={className}
        value={value}
        checked={ctx?.value === value}
        onChange={() => ctx?.onValueChange?.(value)}
        {...props}
      />
    );
  },
);
RadioGroupItem.displayName = "RadioGroupItem";

export { RadioGroup, RadioGroupItem };
