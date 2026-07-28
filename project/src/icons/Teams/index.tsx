import React, { forwardRef } from "react";
import { cn } from "@/lib/utils";
import { TeamsIcon } from "./TeamsIcon";

export const  TeamsIconComponent = forwardRef<SVGSVGElement, React.PropsWithChildren<{ className?: string }>>( 
  (props, ref) => {  
    return <TeamsIcon ref={ref} {...props} className={cn(props.className)}/>;
  },
);

