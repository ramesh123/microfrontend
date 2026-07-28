import React, { forwardRef } from "react";
import { cn } from "@/lib/utils";
import { CarryOverIcon } from "./CarryOverIcon";


export const  CarryOverIconComponent = forwardRef<SVGSVGElement, React.PropsWithChildren<{ className?: string }>>( 
  (props, ref) => {  
    return <CarryOverIcon ref={ref} {...props} className={cn("w-64 h-16", props.className)} />;
  },
);

