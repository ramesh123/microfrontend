import React, { forwardRef } from "react";
import { cn } from "@/lib/utils";
import { KafkaIcon } from "./kafka-icon";

export const  KafkaIconComponent = forwardRef<SVGSVGElement, React.PropsWithChildren<{ className?: string }>>( 
  (props, ref) => {  
    return <KafkaIcon ref={ref} {...props} className={cn(props.className)}/>;
  },
);
