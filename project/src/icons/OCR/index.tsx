import React, { forwardRef } from "react";
import { cn } from "@/lib/utils";
import { OCRIcon } from "./OCRIcon";

export const OCRIconComponent = forwardRef<
  SVGSVGElement,
  React.PropsWithChildren<{ className?: string }>
>((props, ref) => {
  return <OCRIcon ref={ref} {...props} className={cn(props.className)} />;
});

OCRIconComponent.displayName = "OCRIconComponent";
