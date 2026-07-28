import React, { forwardRef } from "react";
import { cn } from "@/lib/utils";
import { TrinoIcon } from "./TrinoIcon";

export const TrinoIconComponent = forwardRef<HTMLImageElement, React.PropsWithChildren<{ className?: string, size?: number }>>(
  (props, ref) => {
    return <TrinoIcon ref={ref} {...props} className={cn(props.className)} />;
  },
);
