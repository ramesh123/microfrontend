import * as React from "react"
import MuiDivider from "@mui/material/Divider"

function Separator({
  className,
  orientation = "horizontal",
  ...props
}: React.ComponentProps<typeof MuiDivider> & { decorative?: boolean }) {
  return (
    <MuiDivider
      data-slot="separator-root"
      orientation={orientation}
      className={className}
      flexItem={orientation === "vertical"}
      {...props}
    />
  )
}

export { Separator }
