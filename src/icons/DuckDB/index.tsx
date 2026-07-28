import React, { forwardRef } from "react";
import {  DuckDBIcon } from "./duckDB";
import { cn } from "@/lib/utils";

export const  DuckDBIconComponent = forwardRef<SVGSVGElement, React.PropsWithChildren<{ className?: string }>>(
  (props, ref) => { 
    return <DuckDBIcon ref={ref} {...props} className={cn(props.className)} />;
  },
);