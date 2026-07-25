import React, { forwardRef } from "react";
import { SnowflakeIcon } from "./snowflake-icon";
import { cn } from "@/lib/utils";

export const SnowflakeIconComponent = forwardRef<SVGSVGElement, React.PropsWithChildren<{ className?: string }>>(
  (props, ref) => { 
    return <SnowflakeIcon ref={ref} {...props} className={cn(props.className)} />;
  },
);