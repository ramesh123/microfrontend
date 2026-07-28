import React, { forwardRef } from "react";
import { cn } from "@/lib/utils";
import { FixedFormatIcon } from "./FixedFormatIcon";

export const  FixedFormatIconComponent = forwardRef<SVGSVGElement, React.PropsWithChildren<{ className?: string }>>( 
  (props, ref) => {  
    return < FixedFormatIcon ref={ref} {...props} className={cn(props.className)}/>;
  },
);

