import React, { forwardRef } from "react";
import { cn } from "@/lib/utils";
import { NWayIcon } from "./NWayIcon";

export const  NWayIconComponent = forwardRef<SVGSVGElement, React.PropsWithChildren<{ className?: string }>>( 
  (props, ref) => {  
    return <NWayIcon ref={ref} {...props} className={cn(props.className)} />;
  },
);

