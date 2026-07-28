import React, { forwardRef } from "react";
import { cn } from "@/lib/utils";
import { VirtualDBIcon } from "./VirtualDBIcon";

export const VirtualDBIconComponent = forwardRef<HTMLImageElement, React.PropsWithChildren<{ className?: string; size?: number }>>(
  (props, ref) => {
    return <VirtualDBIcon ref={ref} {...props} className={cn(props.className)} />;
  },
);
