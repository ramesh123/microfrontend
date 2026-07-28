import React, { forwardRef } from "react";
import { cn } from "@/lib/utils";
import { RedisIcon } from "./redis-icon";

export const RedisIconComponent = forwardRef<SVGSVGElement, React.PropsWithChildren<{ className?: string }>>(
  (props, ref) => { 
    return <RedisIcon ref={ref} {...props} className={cn(props.className)} />;
  },
);

