import React, { forwardRef } from "react";
import { cn } from "@/lib/utils";
import { RenameIcon } from "./RenameIcon";


export const  RenameIconComponent = forwardRef<SVGSVGElement, React.PropsWithChildren<{ className?: string }>>( 
  (props, ref) => {  
    return <RenameIcon ref={ref} {...props} className={cn(props.className)} />;
  },
);

