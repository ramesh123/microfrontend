import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { Copy } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { widgetsLibraryPopoverContentClass } from "./widgetsLibraryClasses";

import {
  clamp,
  colorToOutput,
  COLOR_PICKER_PRESETS_ROW_1,
  COLOR_PICKER_PRESETS_ROW_2,
  hexToRgb,
  hsvToRgb,
  hueToRgbString,
  normalizeHex,
  parseColorInput,
  parseInitialColor,
  rgbToHex,
  rgbToHsv,
  type Hsv,
} from "./colorPickerUtils";

interface ColorPickerPopoverProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  color: string;
  setColor: (color: string) => void;
  previewText: string;
  onApply?: () => void;
  disabled?: boolean;
  label?: string;
  previewIconName?: string;
  previewIconSizePx?: number;
  children: React.ReactNode;
  /** When set, skips auto-placement (use in narrow side panels). */
  popoverSide?: PopoverSide;
  popoverAlign?: "start" | "center" | "end";
}

const COLOR_PICKER_PANEL_WIDTH = 316;
const COLOR_PICKER_PANEL_HEIGHT = 420;
const VIEWPORT_PADDING = 16;

type PopoverSide = "top" | "right" | "bottom" | "left";

function pickColorPickerPlacement(trigger: HTMLElement): {
  side: PopoverSide;
  align: "start" | "end";
} {
  const rect = trigger.getBoundingClientRect();
  const vw = window.innerWidth;
  const vh = window.innerHeight;

  const space = {
    top: rect.top - VIEWPORT_PADDING,
    bottom: vh - rect.bottom - VIEWPORT_PADDING,
    left: rect.left - VIEWPORT_PADDING,
    right: vw - rect.right - VIEWPORT_PADDING,
  };

  const fits = {
    left: space.left >= COLOR_PICKER_PANEL_WIDTH,
    right: space.right >= COLOR_PICKER_PANEL_WIDTH,
    bottom: space.bottom >= COLOR_PICKER_PANEL_HEIGHT,
    top: space.top >= COLOR_PICKER_PANEL_HEIGHT,
  };

  // Right-side edit panel: prefer vertical placement so the picker stays over the panel,
  // not under the preview column to the left.
  const triggerCenterX = rect.left + rect.width / 2;
  const preferVertical = triggerCenterX > vw * 0.45;

  if (preferVertical) {
    if (fits.bottom) return { side: "bottom", align: "end" };
    if (fits.top) return { side: "top", align: "end" };
    if (fits.right) return { side: "right", align: "start" };
    if (fits.left) return { side: "left", align: "start" };
  } else {
    if (fits.right) return { side: "right", align: "start" };
    if (fits.left) return { side: "left", align: "start" };
    if (fits.bottom) return { side: "bottom", align: "end" };
    if (fits.top) return { side: "top", align: "end" };
  }

  if (Math.max(space.bottom, space.top) >= Math.max(space.left, space.right)) {
    return { side: space.bottom >= space.top ? "bottom" : "top", align: "end" };
  }
  return { side: space.left >= space.right ? "left" : "right", align: "start" };
}

function Checkerboard({ className }: { className?: string }) {
  return (
    <div
      className={cn("rounded-md", className)}
      style={{
        backgroundImage:
          "linear-gradient(45deg, #ccc 25%, transparent 25%), linear-gradient(-45deg, #ccc 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #ccc 75%), linear-gradient(-45deg, transparent 75%, #ccc 75%)",
        backgroundSize: "8px 8px",
        backgroundPosition: "0 0, 0 4px, 4px -4px, -4px 0",
        backgroundColor: "#fff",
      }}
    />
  );
}

function ColorPickerPanel({
  initialColor,
  onCancel,
  onSelect,
}: {
  initialColor: string;
  onCancel: () => void;
  onSelect: (color: string) => void;
}) {
  const parsed = parseInitialColor(initialColor);
  const [hsv, setHsv] = useState<Hsv>(parsed.hsv);
  const [alpha, setAlpha] = useState(parsed.alpha);
  const [hexInput, setHexInput] = useState(parsed.hex.replace("#", ""));
  const [format, setFormat] = useState<"HEX" | "RGB">("HEX");

  const satBrightRef = useRef<HTMLDivElement>(null);
  const hueRef = useRef<HTMLDivElement>(null);
  const alphaRef = useRef<HTMLDivElement>(null);

  const rgb = hsvToRgb(hsv);
  const hex = rgbToHex(rgb);
  const displayColor = colorToOutput(hex, alpha);

  useEffect(() => {
    setHexInput(hex.replace("#", ""));
  }, [hex]);

  const pickSatBright = useCallback((clientX: number, clientY: number) => {
    const el = satBrightRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const x = clamp((clientX - rect.left) / rect.width, 0, 1);
    const y = clamp((clientY - rect.top) / rect.height, 0, 1);
    setHsv((prev) => ({ ...prev, s: x * 100, v: (1 - y) * 100 }));
  }, []);

  const pickHue = useCallback((clientX: number) => {
    const el = hueRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const x = clamp((clientX - rect.left) / rect.width, 0, 1);
    setHsv((prev) => ({ ...prev, h: x * 360 }));
  }, []);

  const pickAlpha = useCallback((clientX: number) => {
    const el = alphaRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const x = clamp((clientX - rect.left) / rect.width, 0, 1);
    setAlpha(Math.round(x * 100));
  }, []);

  const bindDrag = (onMove: (x: number, y?: number) => void, needsY = false) => ({
    onPointerDown: (e: React.PointerEvent) => {
      e.preventDefault();
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
      onMove(e.clientX, needsY ? e.clientY : undefined);
    },
    onPointerMove: (e: React.PointerEvent) => {
      if (!(e.currentTarget as HTMLElement).hasPointerCapture(e.pointerId)) return;
      onMove(e.clientX, needsY ? e.clientY : undefined);
    },
    onPointerUp: (e: React.PointerEvent) => {
      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    },
  });

  const applyPreset = (presetHex: string) => {
    setHsv(rgbToHsv(hexToRgb(presetHex)));
    setAlpha(100);
    setHexInput(presetHex.replace("#", ""));
  };

  const handleHexChange = (value: string) => {
    const cleaned = value.replace(/[^0-9A-Fa-f]/g, "").slice(0, 6);
    setHexInput(cleaned);
    if (cleaned.length === 6) {
      const parsedHex = parseColorInput(`#${cleaned}`);
      if (parsedHex) {
        setHsv(rgbToHsv(parsedHex.rgb));
        setAlpha(parsedHex.alpha);
      }
    }
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(displayColor);
      toast.success("Color copied");
    } catch {
      toast.error("Could not copy color");
    }
  };

  const handleClear = () => {
    setHsv({ h: 0, s: 0, v: 0 });
    setAlpha(100);
    setHexInput("000000");
  };

  const hueColor = hueToRgbString(hsv.h);
  const satBrightBg = `linear-gradient(to top, #000, transparent), linear-gradient(to right, #fff, ${hueColor})`;

  return (
    <div className="w-[300px] space-y-3 p-3">
      <div
        ref={satBrightRef}
        className="relative h-[160px] w-full cursor-crosshair overflow-hidden rounded-md"
        style={{ background: satBrightBg }}
        {...bindDrag((x, y) => y != null && pickSatBright(x, y), true)}
      >
        <div
          className="pointer-events-none absolute h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow-md ring-1 ring-black/20"
          style={{
            left: `${hsv.s}%`,
            top: `${100 - hsv.v}%`,
            backgroundColor: hex,
          }}
        />
      </div>

      <div className="flex gap-3">
        <div
          className="h-10 w-10 shrink-0 rounded-md border border-border shadow-inner"
          style={{ backgroundColor: displayColor }}
        />

        <div className="flex min-w-0 flex-1 flex-col justify-center gap-2">
          <div
            ref={hueRef}
            className="relative h-3 w-full cursor-pointer rounded-full"
            style={{
              background:
                "linear-gradient(to right, #f00 0%, #ff0 17%, #0f0 33%, #0ff 50%, #00f 67%, #f0f 83%, #f00 100%)",
            }}
            {...bindDrag((x) => pickHue(x))}
          >
            <div
              className="pointer-events-none absolute top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow ring-1 ring-black/20"
              style={{ left: `${(hsv.h / 360) * 100}%`, backgroundColor: hueColor }}
            />
          </div>

          <div className="relative h-3 w-full">
            <Checkerboard className="absolute inset-0 h-3 rounded-full" />
            <div
              ref={alphaRef}
              className="absolute inset-0 cursor-pointer rounded-full"
              style={{ background: `linear-gradient(to right, transparent, ${hex})` }}
              {...bindDrag((x) => pickAlpha(x))}
            >
              <div
                className="pointer-events-none absolute top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow ring-1 ring-black/20"
                style={{ left: `${alpha}%`, backgroundColor: displayColor }}
              />
            </div>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <Select value={format} onValueChange={(v) => setFormat(v as "HEX" | "RGB")}>
          <SelectTrigger className="h-8 w-[72px] shrink-0 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="z-[1300]">
            <SelectItem value="HEX">HEX</SelectItem>
            <SelectItem value="RGB">RGB</SelectItem>
          </SelectContent>
        </Select>

        <div className="flex min-w-0 flex-1 items-center gap-1 rounded-md border border-border bg-background px-2">
          {format === "HEX" ? (
            <>
              <span className="text-xs text-muted-foreground">#</span>
              <Input
                value={hexInput}
                onChange={(e) => handleHexChange(e.target.value)}
                className="h-7 flex-1 border-0 bg-transparent p-0 font-mono text-xs uppercase shadow-none focus-visible:ring-0"
                maxLength={6}
              />
            </>
          ) : (
            <span className="truncate font-mono text-xs text-foreground">
              {rgb.r}, {rgb.g}, {rgb.b}
            </span>
          )}
          <Button type="button" variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={handleCopy}>
            <Copy className="h-3.5 w-3.5 text-muted-foreground" />
          </Button>
        </div>

        <div className="flex h-8 w-[72px] shrink-0 items-center rounded-md border border-border bg-background px-2">
          <Input
            type="number"
            min={0}
            max={100}
            value={alpha}
            onChange={(e) => setAlpha(clamp(Number(e.target.value) || 0, 0, 100))}
            className="h-7 w-full border-0 bg-transparent p-0 text-right text-xs shadow-none focus-visible:ring-0"
          />
          <span className="ml-0.5 text-xs text-muted-foreground">%</span>
        </div>
      </div>

      <div className="space-y-1.5">
        <div className="flex flex-wrap gap-1.5">
          {COLOR_PICKER_PRESETS_ROW_1.map((c) => (
            <button
              key={c}
              type="button"
              className="h-6 w-6 rounded-md border border-border/60 shadow-sm transition-transform hover:scale-110"
              style={{ backgroundColor: c }}
              onClick={() => applyPreset(c)}
              aria-label={`Preset ${c}`}
            />
          ))}
        </div>
        <div className="flex flex-wrap gap-1.5">
          {COLOR_PICKER_PRESETS_ROW_2.map((c) => (
            <button
              key={c}
              type="button"
              className="h-6 w-6 rounded-md border border-border/60 shadow-sm transition-transform hover:scale-110"
              style={{ backgroundColor: c }}
              onClick={() => applyPreset(c)}
              aria-label={`Preset ${c}`}
            />
          ))}
        </div>
      </div>

      <div className="flex items-center justify-between border-t border-border pt-3">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-8 px-2 text-xs text-primary"
          onClick={handleClear}
        >
          Clear
        </Button>
        <div className="flex gap-2">
          <Button type="button" variant="ghost" size="sm" className="h-8 px-3 text-xs" onClick={onCancel}>
            Cancel
          </Button>
          <Button type="button" size="sm" className="h-8 px-4 text-xs" onClick={() => onSelect(displayColor)}>
            Select
          </Button>
        </div>
      </div>
    </div>
  );
}

export function ColorPickerPopover({
  isOpen,
  onOpenChange,
  color,
  setColor,
  onApply,
  disabled = false,
  children,
  popoverSide,
  popoverAlign,
}: ColorPickerPopoverProps) {
  const triggerRef = useRef<HTMLSpanElement>(null);
  const [placement, setPlacement] = useState<{ side: PopoverSide; align: "start" | "center" | "end" }>({
    side: popoverSide ?? "left",
    align: popoverAlign ?? "start",
  });

  useLayoutEffect(() => {
    if (popoverSide) {
      setPlacement({ side: popoverSide, align: popoverAlign ?? "start" });
      return;
    }
    if (!isOpen || !triggerRef.current) return;

    const updatePlacement = () => {
      if (triggerRef.current) {
        setPlacement(pickColorPickerPlacement(triggerRef.current));
      }
    };

    updatePlacement();
    window.addEventListener("resize", updatePlacement);
    window.addEventListener("scroll", updatePlacement, true);
    return () => {
      window.removeEventListener("resize", updatePlacement);
      window.removeEventListener("scroll", updatePlacement, true);
    };
  }, [isOpen, popoverSide, popoverAlign]);

  const handleSelect = (nextColor: string) => {
    setColor(nextColor.startsWith("#") ? normalizeHex(nextColor) : nextColor);
    onApply?.();
    onOpenChange(false);
  };

  return (
    <Popover open={isOpen} onOpenChange={onOpenChange} modal={false}>
      <PopoverTrigger asChild disabled={disabled}>
        <span ref={triggerRef} className="inline-flex shrink-0">
          {children}
        </span>
      </PopoverTrigger>
      <PopoverContent
        className={cn(
          widgetsLibraryPopoverContentClass,
          "z-[1200] w-auto max-h-[min(520px,var(--radix-popover-content-available-height))] overflow-y-auto p-0",
        )}
        side={placement.side}
        align={placement.align}
        sideOffset={8}
        collisionPadding={VIEWPORT_PADDING}
        avoidCollisions={!popoverSide}
        sticky="partial"
        collisionBoundary={
          typeof document !== "undefined" ? document.documentElement : undefined
        }
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        {isOpen ? (
          <ColorPickerPanel
            key={color}
            initialColor={color || "#000000"}
            onCancel={() => onOpenChange(false)}
            onSelect={handleSelect}
          />
        ) : null}
      </PopoverContent>
    </Popover>
  );
}
