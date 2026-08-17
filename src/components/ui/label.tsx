import * as React from "react";
import { cn } from "@/lib/utils";

// No @material/web component needed here — MD3 doesn't define a distinct
// "label" component, it's plain text styling on a native <label>.
const Label = React.forwardRef<HTMLLabelElement, React.LabelHTMLAttributes<HTMLLabelElement>>(
  ({ className, htmlFor, ...props }, ref) => (
    <label
      ref={ref}
      data-slot="label"
      htmlFor={htmlFor}
      className={cn("flex items-center gap-2 text-sm font-medium", className)}
      {...props}
    />
  ),
);

Label.displayName = "Label";

export { Label };
