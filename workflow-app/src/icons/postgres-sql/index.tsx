import React, { forwardRef } from "react";
import { PostgresIcon } from "./postgres-icon";
import { cn } from "@/lib/utils";

export const PostgresSQLIcon = forwardRef<SVGSVGElement, React.PropsWithChildren<{ className?: string }>>(
  (props, ref) => { 
    return <PostgresIcon ref={ref} {...props} className={cn(props.className)} />;
  },
);

