import React, { forwardRef } from "react";
import {  SingleStoreIcon } from "./single-store";
import { cn } from "@/lib/utils";

export const  SingleStoreIconComponent = forwardRef<SVGSVGElement, React.PropsWithChildren<{ className?: string }>>(
  (props, ref) => { 
    return <SingleStoreIcon ref={ref} {...props} className={cn(props.className)} />;
  },
);