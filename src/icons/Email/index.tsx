import React, { forwardRef } from "react";
import { cn } from "@/lib/utils";
import { EmailIcon } from "./email-icon";

export const  EmailIconComponent = forwardRef<SVGSVGElement, React.PropsWithChildren<{ className?: string }>>( 
  (props, ref) => {  
    return <EmailIcon ref={ref} {...props} className={cn(props.className)}/>;
  },
);
