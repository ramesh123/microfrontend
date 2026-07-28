import React, { forwardRef } from "react";
import { cn } from "@/lib/utils";
import { SourceSplitterIcon } from "./SourceSplitterIcon";


export const SourceSplitterIconComponent = forwardRef<SVGSVGElement, React.PropsWithChildren<{ className?: string }>>( 
  (props, ref) => {  
    return <SourceSplitterIcon ref={ref} {...props} className={cn("dark:invert w-64 h-16",props.className)}/>;
  },
);

