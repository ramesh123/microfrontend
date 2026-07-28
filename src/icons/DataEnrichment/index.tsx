import React, { forwardRef } from "react";
import { cn } from "@/lib/utils";
import { DataEnrichmentIcon } from "./DataEnrichmentIcon";

export const DataEnrichmentIconComponent = forwardRef<
  HTMLSpanElement,
  React.PropsWithChildren<{ className?: string; size?: number }>
>((props, ref) => {
  return <DataEnrichmentIcon ref={ref} {...props} className={cn(props.className)} />;
});

DataEnrichmentIconComponent.displayName = "DataEnrichmentIconComponent";
