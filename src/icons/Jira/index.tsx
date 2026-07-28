import React, { forwardRef } from "react";
import { cn } from "@/lib/utils";
import { JiraIcon } from "./jira-icon";

export const  JiraIconComponent = forwardRef<SVGSVGElement, React.PropsWithChildren<{ className?: string }>>( 
  (props, ref) => {  
    return <JiraIcon ref={ref} {...props} className={cn(props.className)}/>;
  },
);
