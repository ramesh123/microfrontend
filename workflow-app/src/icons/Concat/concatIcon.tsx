import { forwardRef, useMemo } from "react";

import mergeSvgRaw from "@/assets/images/merge-svgrepo-com.svg?raw";
import { cn } from "@/lib/utils";

function prepareMergeIconSvg(raw: string): string {
  return raw
    .replace(/<\?xml[^?]*\?>\s*/i, "")
    .replace(/<style[^>]*>[\s\S]*?<\/style>/i, "")
    .replace(/class="puchipuchi_een"/g, 'fill="currentColor"')
    .replace(/fill="#111918"/gi, 'fill="currentColor"')
    .trim();
}

export const ConcatIcon = forwardRef<
  HTMLSpanElement,
  React.HTMLAttributes<HTMLSpanElement> & { className?: string }
>(({ className, style, ...props }, ref) => {
  const html = useMemo(() => prepareMergeIconSvg(mergeSvgRaw), []);

  return (
    <span
      ref={ref}
      role="img"
      aria-hidden
      style={style}
      className={cn(
        "inline-flex shrink-0 items-center justify-center text-foreground",
        "[&>svg]:block [&>svg]:h-full [&>svg]:w-full [&>svg]:max-h-full [&>svg]:max-w-full",
        className,
      )}
      dangerouslySetInnerHTML={{ __html: html }}
      {...props}
    />
  );
});

ConcatIcon.displayName = "ConcatIcon";
