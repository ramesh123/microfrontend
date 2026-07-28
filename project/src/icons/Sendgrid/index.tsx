import React, { forwardRef } from "react";
import { cn } from "@/lib/utils";
import { SendGridIcon } from "./sendgrid-icon";


export const  SendGridIconComponent = forwardRef<SVGSVGElement, React.PropsWithChildren<{ className?: string }>>( 
  (props, ref) => {  
    return <SendGridIcon ref={ref} {...props} className={cn(props.className)}/>;
  },
);
