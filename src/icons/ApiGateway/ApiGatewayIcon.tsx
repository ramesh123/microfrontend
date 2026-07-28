import { forwardRef } from "react";
import { cn } from "@/lib/utils";
import apiGatewayIconUrl from "@/assets/SVG/api-integration-icon.svg?url";

const resolvedApiGatewayIconUrl =
  typeof apiGatewayIconUrl === "string" ? apiGatewayIconUrl : String(apiGatewayIconUrl);

const apiGatewayMask = `url("${resolvedApiGatewayIconUrl.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}")`;

export type ApiGatewayIconProps = Omit<
  React.HTMLAttributes<HTMLSpanElement>,
  "children"
> & {
  size?: number;
};

export const ApiGatewayIcon = forwardRef<HTMLSpanElement, ApiGatewayIconProps>(
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
        WebkitMaskImage: apiGatewayMask,
        WebkitMaskSize: "contain",
        WebkitMaskRepeat: "no-repeat",
        WebkitMaskPosition: "center",
        maskImage: apiGatewayMask,
        maskSize: "contain",
        maskRepeat: "no-repeat",
        maskPosition: "center",
      }}
      {...props}
    />
  )
);

ApiGatewayIcon.displayName = "ApiGatewayIcon";
