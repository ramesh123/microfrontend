import React, { forwardRef } from "react";
import { cn } from "@/lib/utils";
import { ParquetIcon } from "./parquet-icon";


export const ParquetIconComponent = forwardRef<SVGSVGElement, React.PropsWithChildren<{ className?: string }>>(
  (props, ref) => {
    return <ParquetIcon ref={ref} {...props} className={cn("dark:invert", props.className)} />;
  },
);