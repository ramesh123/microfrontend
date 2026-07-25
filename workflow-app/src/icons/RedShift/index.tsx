import React, { forwardRef } from "react";
import {  RedShiftIcon } from "./redshift-icon";
import { cn } from "@/lib/utils";

export const  RedShiftIconComponent = forwardRef<SVGSVGElement, React.PropsWithChildren<{ className?: string }>>(
  (props, ref) => { 
    return < RedShiftIcon  ref={ref} {...props} className={cn(props.className)} />;
  },
);