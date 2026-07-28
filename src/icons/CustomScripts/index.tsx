import React, { forwardRef } from "react";
import { cn } from "@/lib/utils";
import { CustomScriptsIcon } from "./customScriptsIcon";


export const CustomScriptsIconComponent = forwardRef<SVGSVGElement, React.PropsWithChildren<{ className?: string }>>( 
  (props, ref) => {  
    return <CustomScriptsIcon ref={ref} {...props} className={cn(props.className)} />;
  },
);

