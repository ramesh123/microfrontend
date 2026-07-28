import React, { forwardRef } from "react";
import { cn } from "@/lib/utils";
import { APIConectorIcon } from "./ApiConnectorIcon";

export const  APIConectorIconComponent = forwardRef<SVGSVGElement, React.PropsWithChildren<{ className?: string }>>(
  (props, ref) => { 
    return <APIConectorIcon ref={ref} {...props} className={props.className} />;
  },
);

