import React, { forwardRef } from "react";
import { cn } from "@/lib/utils";
import { HTMLIcon } from "./Html-Icon";

export const  HTMLIconComponent = forwardRef<SVGSVGElement, React.PropsWithChildren<{ className?: string }>>( 
  (props, ref) => {  
    return <HTMLIcon ref={ref} {...props} className={cn(props.className)}/>;
  },
);

