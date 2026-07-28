import React, { forwardRef } from "react";
import { cn } from "@/lib/utils";
import { DataBricksLakehouseIcon } from "./databrickslakehouse-icon";

export const  DataBricksLakehouseIconComponent = forwardRef<SVGSVGElement, React.PropsWithChildren<{ className?: string }>>( 
  (props, ref) => {  
    return <DataBricksLakehouseIcon ref={ref} {...props} className={cn(props.className)}/>;
  },
);
