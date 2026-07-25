import React, { forwardRef, useMemo } from "react";
import { cn } from "@/lib/utils";
import fuzzySvgRaw from "./fuzzy.svg?raw";

function prepareSvgMarkup(raw: string): string {
  return raw.replace(/<\?xml[^?]*\?>\s*/i, "").trim();
}

export type FuzzyMatchIconProps = Omit<
  React.HTMLAttributes<HTMLSpanElement>,
  "dangerouslySetInnerHTML" | "children"
> & {
  size?: number;
};

export const FuzzyMatchIcon = forwardRef<HTMLSpanElement, FuzzyMatchIconProps>(
  ({ className, size = 24, style, ...props }, ref) => {
    const html = useMemo(() => prepareSvgMarkup(fuzzySvgRaw), []);

    return (
      <span
        ref={ref}
        role="img"
        aria-hidden
        style={{ width: size, height: size, ...style }}
        className={cn(
          "inline-flex shrink-0 items-center justify-center text-foreground",
          "[&>svg]:block [&>svg]:h-full [&>svg]:w-full [&>svg]:max-h-full [&>svg]:max-w-full",
          className
        )}
        dangerouslySetInnerHTML={{ __html: html }}
        {...props}
      />
    );
  }
);

FuzzyMatchIcon.displayName = "FuzzyMatchIcon";
