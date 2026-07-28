import React, { forwardRef } from "react";
import { MicrosoftsqlserverIcon } from "./mssql-icon";
import { cn } from "@/lib/utils";


export const MicrosoftsqlserverIconComponent = forwardRef<SVGSVGElement, React.PropsWithChildren<{ className?: string }>>(
  (props, ref) => {
    return <MicrosoftsqlserverIcon ref={ref} {...props} className={cn(props.className)} />;
  },
);

