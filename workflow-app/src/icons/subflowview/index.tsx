import React, { forwardRef } from "react";
import { cn } from "@/lib/utils";
import { SubflowIcon } from "./subflowicon.tsx";


export const SubflowIconComponent = forwardRef<SVGSVGElement, React.PropsWithChildren<{ className?: string }>>( 
  (props, ref) => {  
    return <SubflowIcon ref={ref} {...props} className={cn("dark:invert w-64 h-16",props.className)}/>;
  },
);

export default SubflowIconComponent

