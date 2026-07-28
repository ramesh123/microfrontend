import React, { forwardRef } from "react";
import { cn } from "@/lib/utils";
import { DBTIcon } from "./dbt-icon";

export const  DBTIconComponent = forwardRef<SVGSVGElement, React.PropsWithChildren<{ className?: string }>>( 
  (props, ref) => {  
    return <DBTIcon ref={ref} {...props} className={cn(props.className)}/>;
  },
);
