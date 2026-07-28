import React, { forwardRef } from "react";
import { OracleIcon } from "./oracle-icon";
import { cn } from "@/lib/utils";


export const OracleIconComponent = forwardRef<SVGSVGElement, React.PropsWithChildren<{ className?: string }>>(
  (props, ref) => {
    return <OracleIcon ref={ref} {...props} className={cn("dark:invert", props.className)} />;
  },
);