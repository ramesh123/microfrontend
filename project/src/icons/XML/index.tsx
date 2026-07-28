import React, { forwardRef } from "react";
import { cn } from "@/lib/utils";
import { XMLIcon } from "./XMLIcon";

export const  XMLIconComponent = forwardRef<SVGSVGElement, React.PropsWithChildren<{ className?: string }>>( 
  (props, ref) => {  
    return <XMLIcon ref={ref} {...props} className={cn(props.className)}/>;
  },
);