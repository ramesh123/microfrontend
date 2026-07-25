import React, { forwardRef } from "react";
import { cn } from "@/lib/utils";
import { MaskingIcon } from "./MaskingIcon";


export const  MaskingIconComponent = forwardRef<SVGSVGElement, React.PropsWithChildren<{ className?: string }>>( 
  (props, ref) => {  
    return <MaskingIcon ref={ref} {...props} className={cn(props.className)} />;
  },
);
