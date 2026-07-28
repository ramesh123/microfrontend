import React, { forwardRef } from "react";
import { cn } from "@/lib/utils";
import { ApiGatewayIcon } from "./ApiGatewayIcon";

export const ApiGatewayIconComponent = forwardRef<
  HTMLSpanElement,
  React.PropsWithChildren<{ className?: string; size?: number }>
>((props, ref) => {
  return <ApiGatewayIcon ref={ref} {...props} className={cn(props.className)} />;
});

ApiGatewayIconComponent.displayName = "ApiGatewayIconComponent";
