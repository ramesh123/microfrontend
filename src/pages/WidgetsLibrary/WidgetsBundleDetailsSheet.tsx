import React, { useCallback, useLayoutEffect, useState } from "react";
import * as SheetPrimitive from "@radix-ui/react-dialog";

import { Sheet } from "@/components/ui/sheet";
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
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetPrimitive.Portal>
        <SheetPrimitive.Overlay
          className={cn(
            "data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 fixed z-50 bg-black/50",
            hasTopInset ? "inset-x-0 bottom-0" : "inset-0",
          )}
          style={hasTopInset ? { top: topInset } : undefined}
        />
        <SheetPrimitive.Content
          className={cn(
            "bg-background data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:slide-out-to-right data-[state=open]:slide-in-from-right fixed right-0 z-50 flex w-[90vw] min-w-0 max-w-none flex-col gap-0 overflow-hidden border-l shadow-lg transition ease-in-out data-[state=closed]:duration-300 data-[state=open]:duration-500 sm:max-w-2xl",
            hasTopInset ? "bottom-0 h-auto" : "inset-y-0 h-full",
            className,
          )}
          style={
            hasTopInset
              ? { top: topInset, height: `calc(100vh - ${topInset}px)` }
              : undefined
          }
        >
          {children}
        </SheetPrimitive.Content>
      </SheetPrimitive.Portal>
    </Sheet>
  );
}
