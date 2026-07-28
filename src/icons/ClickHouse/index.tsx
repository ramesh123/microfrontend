import React, { forwardRef } from "react";
import {  ClickHouseIcon } from "./click-house";
import { cn } from "@/lib/utils";

export const  ClickHouseIconComponent = forwardRef<SVGSVGElement, React.PropsWithChildren<{ className?: string }>>(
  (props, ref) => { 
    return < ClickHouseIcon  ref={ref} {...props} className={cn(props.className)} />;
  },
);