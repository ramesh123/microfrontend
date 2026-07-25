import React, { forwardRef } from "react";
import { SapIcon } from "./saphana-icon";
import { cn } from "@/lib/utils";


export const SapIconComponent = forwardRef<SVGSVGElement, React.PropsWithChildren<{ className?: string }>>(
  (props, ref) => {
    return <SapIcon ref={ref} {...props} className={cn(props.className)} />;
  },
);