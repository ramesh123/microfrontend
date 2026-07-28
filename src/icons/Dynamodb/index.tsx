import React, { forwardRef } from "react";
import { DynamodbIcon } from "./Dynamodb-icon";
import { cn } from "@/lib/utils";


export const DynamodbIconComponent = forwardRef<SVGSVGElement, React.PropsWithChildren<{ className?: string }>>(
  (props, ref) => {
    return <DynamodbIcon ref={ref} {...props} className={cn(props.className)} />;
  },
);