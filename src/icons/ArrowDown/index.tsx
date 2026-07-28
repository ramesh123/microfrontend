
import { forwardRef } from "react";
import { DoubleArrowIcon } from "./arrow-down-icon";
import { cn } from "@/lib/utils";

export const DoubleArrowIconComponent = forwardRef<SVGSVGElement, React.PropsWithChildren<{ className?: string }>>(
  (props, ref) => {
    return <DoubleArrowIcon ref={ref} {...props} className={cn(props.className)} />;
  },
);