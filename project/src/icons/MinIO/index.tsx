import React, { forwardRef } from "react";
import { MinioIcon } from "./minio-icon";
import { cn } from "@/lib/utils";

export const MinioIconComponent = forwardRef<
  SVGSVGElement,
  React.PropsWithChildren<{ className?: string }>
>((props, ref) => {
  return <MinioIcon ref={ref} {...props} className={cn(props.className)} />;
});

MinioIconComponent.displayName = "MinioIconComponent";
