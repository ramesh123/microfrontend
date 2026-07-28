import React, { forwardRef } from "react";
import { cn } from "@/lib/utils";
import { MasterDataIcon } from "./masterDataIcon";

export const  MasterDataIconComponent = forwardRef<SVGSVGElement, React.PropsWithChildren<{ className?: string }>>( 
  (props, ref) => {  
    return <MasterDataIcon ref={ref} {...props} className={cn(props.className)}/>;
  },
);


