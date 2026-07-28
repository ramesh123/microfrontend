import React, { forwardRef } from "react";
import { MysqlIcon } from "./mysql-icon";
import { cn } from "@/lib/utils";


export const MysqlIconComponent = forwardRef<SVGSVGElement, React.PropsWithChildren<{ className?: string }>>(
  (props, ref) => {
    return <MysqlIcon ref={ref} {...props} className={cn("dark:invert", props.className)} />;
  },
);