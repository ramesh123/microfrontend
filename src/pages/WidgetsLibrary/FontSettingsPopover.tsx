import React from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { widgetsLibraryPopoverContentClass } from "./widgetsLibraryClasses";

interface FontSettings {
  size: string;
  sizeUnit: string;
  fontFamily: string;
  weight: string;
  style: string;
  lineHeight: string;
}

interface FontSettingsPopoverProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  fontSettings: FontSettings;
  setFontSettings: (settings: FontSettings) => void;
  previewText: string;
  onApply?: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}

export function FontSettingsPopover({
  isOpen,
  onOpenChange,
  fontSettings,
  setFontSettings,
  previewText,
  onApply,
  disabled = false,
  children,
}: FontSettingsPopoverProps) {
  const handleClear = () => {
    setFontSettings({
      size: "",
      sizeUnit: "px",
      fontFamily: "",
      weight: "",
      style: "",
      lineHeight: "",
    });
  };

  const handleApply = () => {
    onApply?.();
    onOpenChange(false);
  };

  return (
    <Popover open={isOpen} onOpenChange={onOpenChange} modal={true}>
      <PopoverTrigger asChild disabled={disabled}>
        {children}
      </PopoverTrigger>
      <PopoverContent
        className={cn(widgetsLibraryPopoverContentClass, "w-[380px] p-0")}
        align="start"
        side="bottom"
        sideOffset={8}
        collisionPadding={16}
      >
        <div className="overflow-hidden rounded-lg bg-popover shadow-lg">
          <div className="flex items-center justify-between border-b border-border px-4 py-2">
            <h3 className="text-sm font-semibold text-foreground">Font settings</h3>
            <Button
              variant="ghost"
              size="icon"
              className="h-5 w-5"
              onClick={() => onOpenChange(false)}
            >
              <X className="h-3 w-3" />
            </Button>
          </div>

          <div className="space-y-2.5 px-4 py-3">
            <div className="flex items-center gap-3">
              <Label className="w-16 shrink-0 text-xs text-muted-foreground">Size</Label>
              <div className="flex flex-1 gap-1.5">
                <Select
                  value={fontSettings.size}
                  onValueChange={(value) => setFontSettings({ ...fontSettings, size: value })}
                >
                  <SelectTrigger className="h-8 flex-1 text-xs">
                    <SelectValue placeholder="Set" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="12">12</SelectItem>
                    <SelectItem value="14">14</SelectItem>
                    <SelectItem value="16">16</SelectItem>
                    <SelectItem value="18">18</SelectItem>
                    <SelectItem value="20">20</SelectItem>
                    <SelectItem value="24">24</SelectItem>
                  </SelectContent>
                </Select>
                <Select
                  value={fontSettings.sizeUnit}
                  onValueChange={(value) => setFontSettings({ ...fontSettings, sizeUnit: value })}
                >
                  <SelectTrigger className="h-8 w-16 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="px">px</SelectItem>
                    <SelectItem value="em">em</SelectItem>
                    <SelectItem value="rem">rem</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <Label className="w-16 shrink-0 text-xs text-muted-foreground">Font family</Label>
              <Select
                value={fontSettings.fontFamily}
                onValueChange={(value) => setFontSettings({ ...fontSettings, fontFamily: value })}
              >
                <SelectTrigger className="h-8 flex-1 text-xs">
                  <SelectValue placeholder="Set" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Roboto">Roboto</SelectItem>
                  <SelectItem value="monospace">monospace</SelectItem>
                  <SelectItem value="sans-serif">sans-serif</SelectItem>
                  <SelectItem value="serif">serif</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center gap-3">
              <Label className="w-16 shrink-0 text-xs text-muted-foreground">Weight</Label>
              <Select
                value={fontSettings.weight}
                onValueChange={(value) => setFontSettings({ ...fontSettings, weight: value })}
              >
                <SelectTrigger className="h-8 flex-1 text-xs">
                  <SelectValue placeholder="Set" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="100">Thin</SelectItem>
                  <SelectItem value="300">Light</SelectItem>
                  <SelectItem value="400">Normal</SelectItem>
                  <SelectItem value="500">Medium</SelectItem>
                  <SelectItem value="600">Semibold</SelectItem>
                  <SelectItem value="700">Bold</SelectItem>
                  <SelectItem value="900">Black</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center gap-3">
              <Label className="w-16 shrink-0 text-xs text-muted-foreground">Style</Label>
              <Select
                value={fontSettings.style}
                onValueChange={(value) => setFontSettings({ ...fontSettings, style: value })}
              >
                <SelectTrigger className="h-8 flex-1 text-xs">
                  <SelectValue placeholder="Set" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="normal">Normal</SelectItem>
                  <SelectItem value="italic">Italic</SelectItem>
                  <SelectItem value="oblique">Oblique</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center gap-3">
              <Label className="w-16 shrink-0 text-xs text-muted-foreground">Line height</Label>
              <Input
                value={fontSettings.lineHeight}
                onChange={(e) => setFontSettings({ ...fontSettings, lineHeight: e.target.value })}
                placeholder="Set"
                className="h-8 flex-1 text-xs"
              />
            </div>

            <div className="border-t border-border pt-2">
              <Label className="mb-1 block text-xs text-muted-foreground">Preview</Label>
              <div className="rounded bg-muted p-2 text-center">
                <p
                  className="text-sm text-foreground"
                  style={{
                    fontSize: fontSettings.size ? `${fontSettings.size}${fontSettings.sizeUnit}` : undefined,
                    fontFamily: fontSettings.fontFamily || undefined,
                    fontWeight: fontSettings.weight || undefined,
                    fontStyle: fontSettings.style || undefined,
                    lineHeight: fontSettings.lineHeight || undefined,
                  }}
                >
                  {previewText}
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between border-t border-border bg-muted px-4 py-2">
            <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={handleClear}>
              Clear
            </Button>
            <div className="flex gap-1.5">
              <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button size="sm" className="h-7 text-xs" onClick={handleApply}>
                Apply
              </Button>
            </div>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
