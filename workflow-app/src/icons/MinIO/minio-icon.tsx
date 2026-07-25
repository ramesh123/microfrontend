import { forwardRef, useMemo, type SVGProps } from "react";
import { cn } from "@/lib/utils";
import minioBrandSvg from "./minio-brand.svg?raw";

/** MinIO wordmark from brand SVG (paths only; outer `<svg>` is this component). */
function minioPathsMarkup(raw: string): string {
  return raw
    .replace(/<\?xml[^?]*\?>\s*/i, "")
    .replace(/<svg[^>]*>/i, "")
    .replace(/<\/svg>\s*$/i, "")
    .trim();
}

type MinioIconProps = SVGProps<SVGSVGElement> & { size?: number };

const VIEWBOX = "-0.23 -10.01 566.44 1148";

export const MinioIcon = forwardRef<SVGSVGElement, MinioIconProps>(
  ({ className, size: _size, ...props }, ref) => {
    const innerHtml = useMemo(() => minioPathsMarkup(minioBrandSvg), []);

    return (
      <svg
        ref={ref}
        viewBox={VIEWBOX}
        xmlns="http://www.w3.org/2000/svg"
        role="img"
        aria-label="MinIO"
        className={cn("shrink-0 overflow-visible", className)}
        {...props}
        dangerouslySetInnerHTML={{ __html: innerHtml }}
      />
    );
  },
);

MinioIcon.displayName = "MinioIcon";
