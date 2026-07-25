import React, { forwardRef } from "react";
import { cn } from "@/lib/utils";
import { ODSIcon } from "./ODSIcon";

export const  ODSIconComponent = forwardRef<SVGSVGElement, React.PropsWithChildren<{ className?: string }>>( 
  (props, ref) => {  
    return <ODSIcon ref={ref} {...props} className={cn(props.className)}/>;
  },
);