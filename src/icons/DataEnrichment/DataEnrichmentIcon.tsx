import { forwardRef } from "react";
import { cn } from "@/lib/utils";
import dataEnrichmentUrl from "@/assets/SVG/dataenrichment.svg?url";

const resolvedDataEnrichmentUrl =
  typeof dataEnrichmentUrl === "string" ? dataEnrichmentUrl : String(dataEnrichmentUrl);

const dataEnrichmentMask = `url("${resolvedDataEnrichmentUrl.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}")`;

export type DataEnrichmentIconProps = Omit<
  React.HTMLAttributes<HTMLSpanElement>,
  "children"
> & {
  size?: number;
};

export const DataEnrichmentIcon = forwardRef<HTMLSpanElement, DataEnrichmentIconProps>(
  ({ className, size = 24, style, ...props }, ref) => (
    <span
      ref={ref}
      role="img"
      aria-hidden
      className={cn("inline-block shrink-0 bg-current text-foreground", className)}
      style={{
        width: size,
        height: size,
        ...style,
        WebkitMaskImage: dataEnrichmentMask,
        WebkitMaskSize: "contain",
        WebkitMaskRepeat: "no-repeat",
        WebkitMaskPosition: "center",
        maskImage: dataEnrichmentMask,
        maskSize: "contain",
        maskRepeat: "no-repeat",
        maskPosition: "center",
      }}
      {...props}
    />
  )
);

DataEnrichmentIcon.displayName = "DataEnrichmentIcon";
