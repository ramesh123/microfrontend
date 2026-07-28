import React, { forwardRef } from "react";
import { cn } from "@/lib/utils";
import { MongoDBIcon } from "./mongodb-icon";

export const MongoDBIconComponent = forwardRef<SVGSVGElement, React.PropsWithChildren<{ className?: string }>>(
  (props, ref) => { 
    return <MongoDBIcon ref={ref} {...props} className={cn(props.className)}/>;
  },
);

