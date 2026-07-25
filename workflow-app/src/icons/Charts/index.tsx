import React, { forwardRef } from "react";
import { cn } from "@/lib/utils";
import { ChartsIcon } from "./ChartsIcon";


export const  ChartsIconComponent = forwardRef<SVGSVGElement, React.PropsWithChildren<{ className?: string }>>( 
  (props, ref) => {  
    return <ChartsIcon ref={ref} {...props} className={cn("w-64 h-16", props.className)} />;
  },
);

