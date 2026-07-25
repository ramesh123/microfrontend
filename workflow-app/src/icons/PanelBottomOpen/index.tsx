import React, { forwardRef } from "react";

import { cn } from "@/lib/utils";
import { PanelBottomOpenSolidIcon } from "./panel-bottom-open-icon";


export const PanelBottomOpenIconComponent = forwardRef<SVGSVGElement, React.PropsWithChildren<{ className?: string }>>(
  (props, ref) => {
    return <PanelBottomOpenSolidIcon ref={ref} {...props} className={cn("dark:invert", props.className)} />;
  },
);