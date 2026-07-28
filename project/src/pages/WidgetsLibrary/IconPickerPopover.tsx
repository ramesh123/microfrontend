import React, { useMemo, useState } from "react";
import * as LucideIcons from "lucide-react";
import { Search, X } from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { widgetsLibraryPopoverContentClass } from "./widgetsLibraryClasses";

import {
  WIDGET_ICON_PICKER_ICONS,
  WIDGET_ICON_PICKER_INITIAL_COUNT,
  getAllLucideIconNames,
} from "./iconPickerIcons";

/** 5 rows: h-8 cells + gap-1 between rows */
const ICON_GRID_INITIAL_HEIGHT_PX = 5 * 32 + 4 * 4;

function LucideIconByName({
  name,
  className,
  style,
}: {
  name: string;
  className?: string;
  style?: React.CSSProperties;
}) {
  const Icon = (LucideIcons as unknown as Record<string, LucideIcon | undefined>)[name];
  if (!Icon) return null;
  return <Icon className={className} style={style} />;
}

interface IconPickerPopoverProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  icon: string;
  onIconChange: (icon: string) => void;
  disabled?: boolean;
  children: React.ReactNode;
}

export function IconPickerPopover({
  isOpen,
  onOpenChange,
  icon,
  onIconChange,
  disabled = false,
  children,
}: IconPickerPopoverProps) {
  const [search, setSearch] = useState("");
  const [showAllIcons, setShowAllIcons] = useState(false);

  const iconPool = useMemo(
    () => (showAllIcons ? getAllLucideIconNames() : [...WIDGET_ICON_PICKER_ICONS]),
    [showAllIcons],
  );

  const filteredIcons = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return iconPool;
    return iconPool.filter((name) => name.toLowerCase().includes(query));
  }, [iconPool, search]);

  const displayIcons = useMemo(() => {
    if (showAllIcons || search.trim()) return filteredIcons;
    return filteredIcons.slice(0, WIDGET_ICON_PICKER_INITIAL_COUNT);
  }, [filteredIcons, showAllIcons, search]);

  const hasMore =
    !showAllIcons &&
    !search.trim() &&
    filteredIcons.length > WIDGET_ICON_PICKER_INITIAL_COUNT;

  const handleOpenChange = (open: boolean) => {
    if (disabled && open) return;
    if (!open) {
      setSearch("");
      setShowAllIcons(false);
    }
    onOpenChange(open);
  };

  const handleSelect = (name: string) => {
    onIconChange(name);
    handleOpenChange(false);
  };

  const handleClear = () => {
    onIconChange("");
    handleOpenChange(false);
  };

  const handleShowMore = () => {
    setShowAllIcons(true);
  };

  return (
    <Popover open={disabled ? false : isOpen} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild disabled={disabled}>
        {children}
      </PopoverTrigger>
      <PopoverContent
        align="end"
        side="bottom"
        sideOffset={8}
        collisionPadding={16}
        className={cn(widgetsLibraryPopoverContentClass, "w-[460px] p-0 shadow-xl")}
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <div className="flex flex-col bg-popover">
          <div className="flex items-center justify-between border-b border-border px-4 py-2.5">
            <h3 className="text-sm font-semibold text-foreground">Icons</h3>
            <button
              type="button"
              className="flex h-7 w-7 items-center justify-center rounded-sm text-muted-foreground hover:bg-accent hover:text-foreground"
              onClick={() => handleOpenChange(false)}
              aria-label="Close"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="border-b border-border px-4 py-2.5">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search icon"
                className="h-9 w-full border-border bg-background pl-9 text-sm"
              />
            </div>
          </div>

          <div
            className={cn(
              "px-3 py-3 transition-[max-height] duration-200 ease-out",
              showAllIcons || search.trim()
                ? "max-h-[min(60vh,520px)] overflow-y-auto"
                : "overflow-hidden",
            )}
            style={
              showAllIcons || search.trim()
                ? undefined
                : { height: ICON_GRID_INITIAL_HEIGHT_PX }
            }
          >
            {displayIcons.length > 0 ? (
              <div className="grid grid-cols-10 gap-1">
                {displayIcons.map((name) => (
                  <button
                    key={name}
                    type="button"
                    title={name}
                    className={cn(
                      "flex h-8 w-8 items-center justify-center rounded-sm text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground",
                      icon === name && "bg-accent text-accent-foreground ring-1 ring-primary",
                    )}
                    onClick={() => handleSelect(name)}
                  >
                    <LucideIconByName name={name} className="h-[18px] w-[18px]" />
                  </button>
                ))}
              </div>
            ) : (
              <p className="py-6 text-center text-sm text-muted-foreground">No icons found</p>
            )}
          </div>

          <div className="flex items-center justify-between border-t border-border px-4 py-2.5">
            <button
              type="button"
              className="text-sm text-muted-foreground transition-colors hover:text-foreground"
              onClick={handleClear}
            >
              Clear
            </button>
            {hasMore ? (
              <button
                type="button"
                className="text-sm font-medium text-primary transition-colors hover:text-primary"
                onClick={handleShowMore}
              >
                Show more
              </button>
            ) : (
              <span className="text-sm text-transparent select-none" aria-hidden>
                —
              </span>
            )}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

export { LucideIconByName };
