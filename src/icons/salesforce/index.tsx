import React, { forwardRef } from "react";
import { SalesforceIcon } from "./salesforce-icon";
import { cn } from "@/lib/utils";


export const SalesforceIconComponent = forwardRef<SVGSVGElement, React.PropsWithChildren<{ className?: string }>>(
  (props, ref) => {
    return <SalesforceIcon ref={ref} {...props} className={cn("dark:invert", props.className)} />;
  },
);