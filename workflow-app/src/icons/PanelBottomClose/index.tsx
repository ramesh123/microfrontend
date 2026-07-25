import React, { forwardRef } from "react";
import { PanelBottomCloseSolidIcon } from "./panel-bottom-close-icon";
import { cn } from "@/lib/utils";


export const PanelBottomCloseIconComponent = forwardRef<SVGSVGElement, React.PropsWithChildren<{ className?: string }>>(
  (props, ref) => {
    return <PanelBottomCloseSolidIcon ref={ref} {...props} className={cn("dark:invert", props.className)} />;
  },
);