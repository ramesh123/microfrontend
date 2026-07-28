import React, { forwardRef } from "react";
import { ExcelIcon } from "./excel-icon";
import { cn } from "@/lib/utils";


export const ExcelIconComponent = forwardRef<SVGSVGElement, React.PropsWithChildren<{ className?: string }>>(
    (props, ref) => {
        return (
            <ExcelIcon ref={ref} {...props} className={cn( props.className)} />
        );
    }
);