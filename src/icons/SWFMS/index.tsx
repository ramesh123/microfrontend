import React, { forwardRef } from "react";
import { cn } from "@/lib/utils";
import { SFMSIcon } from "./SFMSIcon";

export const  SFMSIconComponent = forwardRef<SVGSVGElement, React.PropsWithChildren<{ className?: string }>>( 
  (props, ref) => {  
    return <SFMSIcon ref={ref} {...props} className={cn(props.className)}/>;
  },
);

