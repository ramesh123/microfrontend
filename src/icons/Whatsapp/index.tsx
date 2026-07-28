import React, { forwardRef } from "react";
import { cn } from "@/lib/utils";
import { WhatsappIcon } from "./whatsapp-icon";


export const  WhatsappIconComponent = forwardRef<SVGSVGElement, React.PropsWithChildren<{ className?: string }>>( 
  (props, ref) => {  
    return <WhatsappIcon ref={ref} {...props} className={cn(props.className)}/>;
  },
);

