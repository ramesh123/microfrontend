import React, { forwardRef } from "react";
import {  CockroachDBIcon } from "./cockroachDB";
import { cn } from "@/lib/utils";

export const  CockroachDBIconComponent = forwardRef<SVGSVGElement, React.PropsWithChildren<{ className?: string }>>(
  (props, ref) => { 
    return <CockroachDBIcon ref={ref} {...props} className={cn(props.className)} />;
  },
);