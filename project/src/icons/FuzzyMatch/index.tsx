import React, { forwardRef } from "react";
import { cn } from "@/lib/utils";
import { FuzzyMatchIcon } from "./FuzzyMatchIcon";

export const FuzzyMatchIconComponent = forwardRef<
  HTMLSpanElement,
  React.PropsWithChildren<{ className?: string; size?: number }>
>((props, ref) => {
  return <FuzzyMatchIcon ref={ref} {...props} className={cn(props.className)} />;
});

FuzzyMatchIconComponent.displayName = "FuzzyMatchIconComponent";
