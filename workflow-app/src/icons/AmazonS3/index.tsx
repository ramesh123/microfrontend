import React, { forwardRef } from "react";
import { cn } from "@/lib/utils";
import { AmazonS3Icon } from "./amazons3-icon";

export const  AmazonS3IconComponent = forwardRef<SVGSVGElement, React.PropsWithChildren<{ className?: string }>>(
  (props, ref) => { 
    return <AmazonS3Icon ref={ref} {...props} className={cn(props.className)} />;
  },
);

