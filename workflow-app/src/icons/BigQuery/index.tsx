import React, { forwardRef } from "react";
import { cn } from "@/lib/utils";
import { BigQueryIcon } from "./bigQuery-icon";


export const  BigQueryIconComponent = forwardRef<SVGSVGElement, React.PropsWithChildren<{ className?: string }>>( 
  (props, ref) => {  
    return <BigQueryIcon ref={ref} {...props} className={cn(props.className)}/>;
  },
);

