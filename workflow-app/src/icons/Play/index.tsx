import React, { forwardRef } from "react";
import { cn } from "@/lib/utils";
import { PlayIcon } from "./execute-icon";


export const PlayIconComponent = forwardRef<SVGSVGElement, React.PropsWithChildren<{ className?: string }>>(
  (props, ref) => {
    return <PlayIcon ref={ref} {...props} className={cn("dark:invert", props.className)} />;
  },
);
