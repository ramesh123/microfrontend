import React, { forwardRef } from "react";
import { cn } from "@/lib/utils";
import { AEPSIcon } from "./AEPSIcon";

export const  AEPSIconComponent = forwardRef<SVGSVGElement, React.PropsWithChildren<{ className?: string }>>( 
  (props, ref) => {  
    return <AEPSIcon ref={ref} {...props} className={cn(props.className)}/>;
  },
);

