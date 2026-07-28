import React, { forwardRef } from "react";
import { cn } from "@/lib/utils";
import { AWSLambdaIcon } from "./awsLambda-icon";

export const  AWSLambdaIconComponent = forwardRef<SVGSVGElement, React.PropsWithChildren<{ className?: string }>>( 
  (props, ref) => {  
    return <AWSLambdaIcon ref={ref} {...props} className={cn(props.className)}/>;
  },
);

