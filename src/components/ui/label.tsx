import * as React from "react"
import MuiFormLabel from "@mui/material/FormLabel"

const Label = React.forwardRef<
  HTMLLabelElement,
  React.ComponentPropsWithoutRef<typeof MuiFormLabel> & { htmlFor?: string }
>(({ className, htmlFor, ...props }, ref) => (
  <MuiFormLabel
    ref={ref}
    component="label"
    data-slot="label"
    htmlFor={htmlFor}
    className={className}
    sx={{ display: "flex", alignItems: "center", gap: 1, fontSize: "0.875rem", fontWeight: 500 }}
    {...props}
  />
))

Label.displayName = "Label"

export { Label }
