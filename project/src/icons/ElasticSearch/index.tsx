import React, { forwardRef } from "react";
import { cn } from "@/lib/utils";
import { ElasticSearchIcon } from "./elasticSearch-icon";

export const ElasticSearchIconComponent = forwardRef<SVGSVGElement, React.PropsWithChildren<{ className?: string }>>( 
  (props, ref) => { 
    return <ElasticSearchIcon ref={ref} {...props} className={cn(props.className)}/>;
  },
);

