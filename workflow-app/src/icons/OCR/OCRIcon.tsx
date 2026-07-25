import { forwardRef, useId, useMemo, type SVGProps } from "react";
import { cn } from "@/lib/utils";

import frameSvg from "@/assets/SVG/Frame.svg?raw";

const DEFAULT_VIEWBOX = "0 0 1025 1024";

function parseSvgViewBox(raw: string): string {
  const viewBoxMatch = raw.match(/viewBox\s*=\s*["']([^"']+)["']/i);
  if (viewBoxMatch?.[1]) return viewBoxMatch[1].trim();

  const widthMatch = raw.match(/\bwidth="(\d+)"/i);
  const heightMatch = raw.match(/\bheight="(\d+)"/i);
  if (widthMatch && heightMatch) {
    return `0 0 ${widthMatch[1]} ${heightMatch[1]}`;
  }

  return DEFAULT_VIEWBOX;
}

function svgInnerMarkup(raw: string): string {
  return raw
    .replace(/<\?xml[^?]*\?>\s*/i, "")
    .replace(/<svg[^>]*>/i, "")
    .replace(/<\/svg>\s*$/i, "")
    .trim();
}

const CORNER_RADIUS = 200;

/** Frame.svg uses black paths as corner masks over a square cyan fill — strip both artifacts. */
function prepareFrameSvg(raw: string): string {
  return svgInnerMarkup(raw)
    .replace(/<path\b[^>]*\bfill="#000000"[^>]*\/?>/gi, "")
    .replace(
      /<path\b[^>]*\bfill="#1AAFD0"[^>]*\btransform="translate\(0,0\)"[^>]*\/?>/i,
      `<rect width="1025" height="1024" rx="${CORNER_RADIUS}" ry="${CORNER_RADIUS}" fill="#1AAFD0"/>`,
    );
}

type OCRIconProps = SVGProps<SVGSVGElement> & { size?: number };

export const OCRIcon = forwardRef<SVGSVGElement, OCRIconProps>(
  ({ className, size: _size, ...props }, ref) => {
    const clipId = useId();
    const viewBox = useMemo(() => parseSvgViewBox(frameSvg), []);
    const innerHtml = useMemo(() => prepareFrameSvg(frameSvg), []);

    return (
      <svg
        ref={ref}
        viewBox={viewBox}
        xmlns="http://www.w3.org/2000/svg"
        role="img"
        aria-label="OCR"
        preserveAspectRatio="xMidYMid meet"
        className={cn("shrink-0", className)}
        {...props}
      >
        <defs>
          <clipPath id={clipId}>
            <rect width="1025" height="1024" rx={CORNER_RADIUS} ry={CORNER_RADIUS} />
          </clipPath>
        </defs>
        <g clipPath={`url(#${clipId})`} dangerouslySetInnerHTML={{ __html: innerHtml }} />
      </svg>
    );
  },
);

OCRIcon.displayName = "OCRIcon";
