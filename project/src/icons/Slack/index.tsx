import React, { forwardRef } from "react";
import { cn } from "@/lib/utils";
import { SlackIcon } from "./SlackIcon";

export const  SlackIconComponent = forwardRef<SVGSVGElement, React.PropsWithChildren<{ className?: string }>>(
  (props, ref) => { 
    return <SlackIcon ref={ref} {...props} className={cn(props.className)} />;
  },
);