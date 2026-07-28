import React, { forwardRef } from "react";
import { cn } from "@/lib/utils";
import { NPCIIcon } from "./NPCI-Icon";

export const  NPCIIconComponent = forwardRef<SVGSVGElement, React.PropsWithChildren<{ className?: string }>>( 
  (props, ref) => {  
    return <NPCIIcon ref={ref} {...props} className={cn(props.className)}/>;
  },
);

