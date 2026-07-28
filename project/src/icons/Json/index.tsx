import React, { forwardRef } from "react";
import { JsonIcon} from "./json-icon";
import { cn } from "@/lib/utils";

export const  JsonIconComponent = forwardRef<SVGSVGElement, React.PropsWithChildren<{ className?: string }>>( 
  (props, ref) => {  
    return <JsonIcon ref={ref} {...props} className={cn(props.className)}/>;
  },
);

