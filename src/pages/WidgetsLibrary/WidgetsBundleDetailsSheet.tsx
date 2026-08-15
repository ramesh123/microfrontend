import React, { useCallback, useLayoutEffect, useState } from "react";
import MuiDrawer from "@mui/material/Drawer";

import { cn } from "@/lib/utils";

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
    <MuiDrawer
      anchor="right"
      open={open}
      onClose={() => onOpenChange(false)}
      sx={{ zIndex: 50 }}
      slotProps={{
        backdrop: {
          className: cn(hasTopInset ? "inset-x-0 bottom-0" : undefined),
          style: hasTopInset ? { top: topInset } : undefined,
        },
        paper: {
          className: cn(
            "bg-background flex flex-col gap-0 overflow-hidden border-l shadow-lg w-[90vw] min-w-0 max-w-none sm:max-w-2xl",
            hasTopInset ? "bottom-0 h-auto" : "inset-y-0 h-full",
            className,
          ),
          style: hasTopInset
            ? { top: topInset, height: `calc(100vh - ${topInset}px)`, position: "fixed" }
            : undefined,
        },
      }}
    >
      {children}
    </MuiDrawer>
  );
}
