import React, { forwardRef } from "react";
import { cn } from "@/lib/utils";
import { DataCollectorIcon } from "./DataCollectorIcon";


export const  DataCollectorIconComponent = forwardRef<SVGSVGElement, React.PropsWithChildren<{ className?: string }>>( 
  (props, ref) => {  
    return <DataCollectorIcon ref={ref} {...props} className={cn("w-64 h-16", props.className)} />;
  },
);

