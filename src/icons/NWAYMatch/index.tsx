import React, { forwardRef } from "react";
import { cn } from "@/lib/utils";
import { NWayMatchIcon } from "./NWayMatchIcon";

export const  NWayMatchIconComponent = forwardRef<SVGSVGElement, React.PropsWithChildren<{ className?: string }>>(  
  (props, ref) => { 
    return <NWayMatchIcon ref={ref} {...props} className={cn(props.className)} />;
  },
);

