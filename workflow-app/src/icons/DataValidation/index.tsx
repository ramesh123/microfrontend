import React, { forwardRef } from "react";
import { cn } from "@/lib/utils";
import { DataValidationIcon } from "./DataValidationIcon";


export const  DataValidationIconComponent = forwardRef<SVGSVGElement, React.PropsWithChildren<{ className?: string }>>( 
  (props, ref) => {  
    return <DataValidationIcon ref={ref} {...props} className={cn(props.className)} />;
  },
);

