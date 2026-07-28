import { forwardRef, HTMLAttributes } from "react";

import { cn } from "@/lib/utils";

export const BaseNode = forwardRef<
  HTMLDivElement,
  HTMLAttributes<HTMLDivElement> & { selected?: boolean }
>(({ className, selected, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      "relative border rounded-md bg-card p-5 text-card-foreground shadow-md",
      className,
      selected ? "border-muted-foreground shadow-lg" : "",
      "hover:border hover:border-primary",
    )}
    tabIndex={0}
    {...props}
  />
));

BaseNode.displayName = "BaseNode";
