import React, { forwardRef } from "react";
import {  SFTPIcon } from "./SFTPIcon";
import { cn } from "@/lib/utils";

export const  SFTPIconComponent = forwardRef<SVGSVGElement, React.PropsWithChildren<{ className?: string }>>(
  (props, ref) => { 
    return <SFTPIcon ref={ref} {...props} className={cn(props.className)} />;
  },
);