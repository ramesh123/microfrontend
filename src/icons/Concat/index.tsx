import React, { forwardRef } from "react";
import { cn } from "@/lib/utils";
import { ConcatIcon } from "./concatIcon";


export const ConcatIconComponent = forwardRef<
  HTMLSpanElement,
  React.PropsWithChildren<{ className?: string }>
>((props, ref) => {
  return <ConcatIcon ref={ref} {...props} className={cn(props.className)} />;
});

ConcatIconComponent.displayName = "ConcatIconComponent";

