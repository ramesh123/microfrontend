import React, { forwardRef } from "react";
import { SignvioIcon } from "./signvio-icon";
import { cn } from "@/lib/utils";

export const SignvioIconComponent = forwardRef<
  SVGSVGElement,
  React.PropsWithChildren<{ className?: string }>
>((props, ref) => {
  return <SignvioIcon ref={ref} {...props} className={cn(props.className)} />;
});

SignvioIconComponent.displayName = "SignvioIconComponent";
