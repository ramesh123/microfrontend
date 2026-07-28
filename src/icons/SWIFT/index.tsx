import React, { forwardRef } from "react";
import { cn } from "@/lib/utils";
import { SWIFTIcon } from "./SwiftIcon";

export const  SWIFTIconComponent = forwardRef<SVGSVGElement, React.PropsWithChildren<{ className?: string }>>( 
  (props, ref) => {  
    return <SWIFTIcon ref={ref} {...props} className={cn(props.className)}/>;
  },
);

