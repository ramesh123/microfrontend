import React, { useCallback, useLayoutEffect, useState } from "react";

import { cn } from "@/lib/utils";

// No @material/web drawer component exists at a stable path — plain
// fixed-position sliding panel + backdrop, same pattern as components/ui/sheet.tsx,
// but keeping this file's bespoke "top inset" positioning (panel starts below
// the dashboard tabs rather than the full viewport height).

/** Positions the widgets bundle details sheet below the library tabs (bundles dashboard only). */
function useBundleDetailsSheetTopInset(
  dashboardAnchorRef: React.RefObject<HTMLElement | null>,
  open: boolean,
) {
  const [topInset, setTopInset] = useState(0);

  const updateTopInset = useCallback(() => {
    const anchor = dashboardAnchorRef.current;
    if (!anchor) return;
    setTopInset(Math.max(0, Math.round(anchor.getBoundingClientRect().top)));
  }, [dashboardAnchorRef]);

  useLayoutEffect(() => {
    if (!open) return;

    updateTopInset();
    const anchor = dashboardAnchorRef.current;
    const resizeObserver = anchor ? new ResizeObserver(updateTopInset) : null;
    if (anchor) resizeObserver?.observe(anchor);

    window.addEventListener("resize", updateTopInset);
    return () => {
      resizeObserver?.disconnect();
      window.removeEventListener("resize", updateTopInset);
    };
  }, [open, updateTopInset, dashboardAnchorRef]);

  return topInset;
}

type WidgetsBundleDetailsSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Top of the widgets bundles table area (directly under Widgets / Widgets bundles tabs). */
  dashboardAnchorRef: React.RefObject<HTMLElement | null>;
  className?: string;
  children: React.ReactNode;
};

/** Bundle details sheet with dashboard top inset — does not use shared SheetContent. */
export function WidgetsBundleDetailsSheet({
  open,
  onOpenChange,
  dashboardAnchorRef,
  className,
  children,
}: WidgetsBundleDetailsSheetProps) {
  const topInset = useBundleDetailsSheetTopInset(dashboardAnchorRef, open);
  const hasTopInset = topInset > 0;

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 50, pointerEvents: open ? "auto" : "none" }}>
      <div
        onClick={() => onOpenChange(false)}
        className={cn(hasTopInset ? "inset-x-0 bottom-0" : undefined)}
        style={{
          position: "absolute",
          ...(hasTopInset ? { top: topInset } : { inset: 0 }),
          background: "rgba(0,0,0,0.5)",
          opacity: open ? 1 : 0,
          transition: "opacity 0.2s ease",
        }}
      />
      <div
        style={{
          position: "fixed",
          right: 0,
          transform: open ? "translateX(0)" : "translateX(100%)",
          transition: "transform 0.25s ease",
          ...(hasTopInset
            ? { top: topInset, height: `calc(100vh - ${topInset}px)` }
            : { top: 0, height: "100vh" }),
        }}
        className={cn(
          "bg-background flex flex-col gap-0 overflow-hidden border-l shadow-lg w-[90vw] min-w-0 max-w-none sm:max-w-2xl",
          className,
        )}
      >
        {children}
      </div>
    </div>
  );
}
