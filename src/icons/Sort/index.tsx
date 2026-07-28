import React, { forwardRef } from "react";
import { cn } from "@/lib/utils";
import { SortIcon } from "./sortIcon";


export const  SortIconComponent = forwardRef<SVGSVGElement, React.PropsWithChildren<{ className?: string }>>( 
  (props, ref) => {  
    return <SortIcon ref={ref} {...props} className={cn(props.className)} />;
  },
);

