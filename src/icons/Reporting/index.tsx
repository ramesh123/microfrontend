import React, { forwardRef } from "react";
import { cn } from "@/lib/utils";
import { ReportingIcon } from "./ReportingIcon";
import { RenameIcon } from "../Rename/RenameIcon";


export const  ReportingIconComponent = forwardRef<SVGSVGElement, React.PropsWithChildren<{ className?: string }>>( 
  (props, ref) => {  
    return <ReportingIcon ref={ref} {...props} className={cn(props.className)} />;
  },
);

