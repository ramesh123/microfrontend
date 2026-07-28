import React, { forwardRef } from "react";
import { FileCsvIcon } from "./CSV-icon";
import { cn } from "@/lib/utils";


export const FileCsvIconComponent = forwardRef<SVGSVGElement, React.PropsWithChildren<{ className?: string }>>(
  (props, ref) => {
    return <FileCsvIcon ref={ref} {...props} className={cn("dark:invert", props.className)} />;
  },
);