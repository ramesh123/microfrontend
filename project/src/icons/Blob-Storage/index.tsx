import React, { forwardRef } from "react";
import {  BlobStorageIcon } from "./BlobStorageIcon";
import { cn } from "@/lib/utils";


export const  BlobStorageIconComponent = forwardRef<SVGSVGElement, React.PropsWithChildren<{ className?: string }>>( 
  (props, ref) => {  
    return <BlobStorageIcon ref={ref} {...props} className={cn(props.className)}/>;
  },
);

