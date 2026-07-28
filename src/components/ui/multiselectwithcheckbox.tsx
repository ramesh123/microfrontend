"use client"

import * as React from "react"
import { Check, ChevronsUpDown, XIcon } from "lucide-react"

import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"

export interface MultiSelectOption {
  value: string;
  label: string;
}

export interface MultiSelectWithCheckboxProps {
  options: MultiSelectOption[];
  value: string[];
  onChange: (value: string[]) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  emptyText?: string;
  disabled?: boolean;
  className?: string;
  /** Class applied to the checkbox square when checked */
  checkedClassName?: string;
  /** Class applied to each selected badge */
  badgeClassName?: string;
  /** Show removable badge chips below the trigger */
  showBadges?: boolean;
  /** Render a custom trigger label; receives selected count */
  renderTriggerLabel?: (count: number) => React.ReactNode;
  /** Render a custom suffix for each option row */
  renderOptionSuffix?: (option: MultiSelectOption) => React.ReactNode;
}

export function MultiSelectWithCheckbox({
  options,
  value,
  onChange,
  placeholder = "Select items...",
  searchPlaceholder = "Search...",
  emptyText = "No items found.",
  disabled = false,
  className,
  checkedClassName = "border-primary bg-primary",
  badgeClassName,
  showBadges = true,
  renderTriggerLabel,
  renderOptionSuffix,
}: MultiSelectWithCheckboxProps) {
  const [open, setOpen] = React.useState(false)

  const handleToggle = (optionValue: string) => {
    onChange(
      value.includes(optionValue)
        ? value.filter((v) => v !== optionValue)
        : [...value, optionValue]
    )
  }

  const handleRemove = (optionValue: string) => {
    onChange(value.filter((v) => v !== optionValue))
  }

  const defaultTriggerLabel = (count: number) =>
    count > 0 ? (
      <span className="flex items-center gap-1.5">
        <span className="inline-flex h-5 w-5 items-center justify-center rounded-md text-[10px] font-bold text-primary">
          {count}
        </span>
        item{count !== 1 ? "s" : ""} selected
      </span>
    ) : (
      <span className="text-muted-foreground">{placeholder}</span>
    )

  const triggerLabel = renderTriggerLabel ?? defaultTriggerLabel

  const selectedOptions = options.filter((o) => value.includes(o.value))

  return (
    <div className="space-y-1.5">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            disabled={disabled}
            className={cn("w-full !justify-between", className)}
          >
            <span className="truncate text-sm">{triggerLabel(value.length)}</span>
            <ChevronsUpDown className="ml-2 h-3.5 w-3.5 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent
          className="w-[--radix-popover-trigger-width] p-0"
          align="start"
        >
          <Command>
            <CommandInput placeholder={searchPlaceholder} />
            <CommandList>
              <CommandEmpty>{emptyText}</CommandEmpty>
              <CommandGroup>
                {options.map((option) => {
                  const checked = value.includes(option.value)
                  return (
                    <CommandItem
                      key={option.value}
                      value={option.label}
                      onSelect={() => handleToggle(option.value)}
                      className={cn(
                        "cursor-pointer transition-colors",
                        checked && ""
                      )}
                    >
                      <div
                        className={cn(
                          "mr-2 flex h-4 w-4 items-center justify-center rounded border transition-all",
                          checked
                            ? checkedClassName
                            : "border-muted-foreground/30"
                        )}
                      >
                        {checked && <Check className="h-3 w-3 text-background" />}
                      </div>
                      <span
                        className={cn(
                          "flex-1 text-sm",
                          checked && "font-medium text-foreground"
                        )}
                      >
                        {option.label}
                      </span>
                      {renderOptionSuffix?.(option)}
                    </CommandItem>
                  )
                })}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      {showBadges && selectedOptions.length > 0 && (
        <div className="flex flex-wrap gap-1.5 animate-in fade-in duration-200">
          {selectedOptions.map((option, i) => (
            <Badge
              key={option.value}
              variant="secondary"
              className={cn(
                "gap-1.5 pr-1 text-xs font-medium border shadow-sm animate-in fade-in zoom-in-95 duration-200",
                badgeClassName ?? "bg-background text-primary border-primary/20"
              )}
              style={{ animationDelay: `${i * 30}ms` }}
            >
              <span className="inline-flex h-1.5 w-1.5 rounded-full bg-current opacity-60" />
              {option.label}
              <button
                onClick={() => handleRemove(option.value)}
                className="ml-0.5 rounded-full p-0.5 transition-colors"
              >
                <XIcon className="h-2.5 w-2.5" />
              </button>
            </Badge>
          ))}
        </div>
      )}
    </div>
  )
}
