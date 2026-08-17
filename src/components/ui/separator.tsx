import * as React from "react";
import { cn } from "@/lib/utils";
import "@material/web/divider/divider.js";

// md-divider only ever renders a horizontal line (see
// node_modules/@material/web/divider/internal/divider.d.ts — inset/insetStart/
// insetEnd only, no orientation) — MD3 doesn't define a vertical divider
// variant. Vertical stays a plain styled div, no library component covers it.
function Separator({
  className,
  orientation = "horizontal",
  ...props
}: React.HTMLAttributes<HTMLElement> & { orientation?: "horizontal" | "vertical"; decorative?: boolean }) {
  if (orientation === "vertical") {
    return (
      <div
        data-slot="separator-root"
        className={cn("w-px self-stretch bg-border", className)}
        {...props}
      />
    );
  }
  return (
    <md-divider
      data-slot="separator-root"
      className={className}
      {...props}
    />
  );
}

export { Separator };
