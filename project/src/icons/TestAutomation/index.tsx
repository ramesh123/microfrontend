import React, { forwardRef } from "react";
import { cn } from "@/lib/utils";
import { TestAutomationIcon } from "./TestAutomation";

export const  TestAutomationIconComponent = forwardRef<SVGSVGElement, React.PropsWithChildren<{ className?: string }>>( 
  (props, ref) => {  
    return <TestAutomationIcon ref={ref} {...props} className={cn(props.className)}/>;
  },
);

