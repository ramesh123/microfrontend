import React, { forwardRef, useEffect, useRef, useState } from "react";
import { Maximize, Minus, Plus } from "lucide-react";

import {
  Panel,
  useStore,
  useReactFlow,
  useViewport,
  PanelProps,
} from "@xyflow/react";

import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type ZoomSliderProps = Omit<PanelProps, "children"> & {
  /** Tailwind width classes for the zoom track (default: wide track for rule-chain canvas). */
  sliderClassName?: string;
  /** Override maximize / fit (e.g. ThingsBoard-style fit for large rule chains). */
  onFitView?: () => void;
  /** Zoom level for the percent button (default 1 = 100%). */
  resetZoom?: number;
};

export const ZoomSlider = forwardRef<HTMLDivElement, ZoomSliderProps>(
  ({ className, sliderClassName, onFitView, resetZoom = 1, ...props }, ref) => {
  const { zoomTo, zoomIn, zoomOut, fitView } = useReactFlow();
  const { zoom } = useViewport();
  const isDraggingRef = useRef(false);
  const [sliderValue, setSliderValue] = useState(zoom);

  useEffect(() => {
    if (!isDraggingRef.current) {
      setSliderValue(zoom);
    }
  }, [zoom]);

  const { minZoom, maxZoom } = useStore(
    (state) => ({
      minZoom: state.minZoom,
      maxZoom: state.maxZoom,
    }),
    (a, b) => a.minZoom !== b.minZoom || a.maxZoom !== b.maxZoom,
  );

  return (
    <div ref={ref} className="inline-flex">
    <Panel
      className={cn(
        "noflow nopan nodrag nowheel flex gap-1 rounded-md bg-primary-foreground p-1 text-foreground",
        className,
      )}
      {...props}
    >
      <Button
        variant="ghost"
        size="icon"
        onClick={() => zoomOut({ duration: 300 })}
      >
        <Minus className="h-4 w-4" />
      </Button>
      <Slider
        className={cn("nopan nodrag noflow nowheel min-w-[240px] w-[min(42vw,360px)]", sliderClassName)}
        value={[sliderValue]}
        min={minZoom}
        max={maxZoom}
        step={0.01}
        onValueChange={(values) => {
          const z = values[0];
          if (z == null || !Number.isFinite(z)) return;
          isDraggingRef.current = true;
          setSliderValue(z);
          zoomTo(z);
        }}
        onValueCommit={() => {
          isDraggingRef.current = false;
        }}
        onPointerUp={() => {
          isDraggingRef.current = false;
        }}
      />
      <Button
        variant="ghost"
        size="icon"
        onClick={() => zoomIn({ duration: 300 })}
      >
        <Plus className="h-4 w-4" />
      </Button>
      <Button
        className="min-w-20 tabular-nums"
        variant="ghost"
        onClick={() => zoomTo(resetZoom, { duration: 300 })}
      >
        {(100 * zoom).toFixed(0)}%
      </Button>
      <Button
        variant="ghost"
        size="icon"
        onClick={() => (onFitView ? onFitView() : fitView({ duration: 300 }))}
      >
        <Maximize className="h-4 w-4" />
      </Button>
    </Panel>
    </div>
  );
});

ZoomSlider.displayName = "ZoomSlider";
