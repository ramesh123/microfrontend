import * as React from "react"
import { cn } from "@/lib/utils"

// MUI has no dedicated ScrollArea component — a styled overflow container
// with a themed scrollbar (see .custom-scroll in tailwind.config.js) is the
// standard MUI approach, so this stays a plain div rather than pulling in
// a separate custom-scrollbar dependency for parity with the old Radix one.
function ScrollArea({
  className,
  children,
  // Accepted for call-site compatibility; native overflow scrolling doesn't
  // distinguish Radix's "hover"/"auto"/"always"/"scroll" visibility modes.
  type: _type,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & { type?: "auto" | "always" | "scroll" | "hover" }) {
  return (
    <div
      data-slot="scroll-area"
      className={cn("relative overflow-auto custom-scroll", className)}
      {...props}
    >
      {children}
    </div>
  )
}

function ScrollBar(_props: { className?: string; orientation?: "vertical" | "horizontal" }) {
  // No-op — native overflow scrolling (styled via .custom-scroll) replaces
  // Radix's custom scrollbar thumb/track; kept as an export so call sites
  // that still render <ScrollBar /> alongside <ScrollArea> don't break.
  return null
}

export { ScrollArea, ScrollBar }
