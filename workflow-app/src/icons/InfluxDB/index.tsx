import React, { forwardRef } from "react";
import { InfluxDBIcon } from "./influxdb-icon";
import { cn } from "@/lib/utils";

export const InfluxDBIconComponent = forwardRef<
  SVGSVGElement,
  React.PropsWithChildren<{ className?: string }>
>((props, ref) => {
  return <InfluxDBIcon ref={ref} {...props} className={cn(props.className)} />;
});
