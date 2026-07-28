"use client"

import * as React from "react"
import { Check, ChevronsUpDown, PlusCircle } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { FormFieldOption } from "@/types/form"
import Spinner from "./spinner"

interface ComboboxProps {
  options: FormFieldOption[];
  value?: string | number;
  onChange: (value: string | number | any) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  emptyText?: string;
  isLoading?: boolean;
  disabled?: boolean;
  showAddButton?: boolean;
  onAddClick?: () => void;
  addButtonLabel?: string;
  className?: string;
  /** When set, the popover won't close on focus/interact outside if the target is inside this element (e.g. sibling Command panel) */
  ignoreCloseRef?: React.RefObject<HTMLElement | null>;
}

export function Combobox({ 
  options, 
  value, 
  onChange, 
  placeholder = "Select an option...",
  searchPlaceholder = "Search...",
  emptyText = "No option found.",
  isLoading = false,
  disabled = false,
  showAddButton = false,
  onAddClick,
  addButtonLabel = "Add new...",
  className,
  ignoreCloseRef,
}: ComboboxProps) {
  const [open, setOpen] = React.useState(false)

  const selectedLabel = options.find((option) => String(option.value) === String(value))?.label;

  const preventCloseWhenInsideRef = (e: { preventDefault: () => void; detail?: { originalEvent?: { target?: EventTarget | null } } }) => {
    const target = e.detail?.originalEvent?.target ?? (e as unknown as { target?: EventTarget | null }).target;
    if (ignoreCloseRef?.current && target instanceof Node && ignoreCloseRef.current.contains(target)) {
      e.preventDefault();
    }
  };

  return (  
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled || isLoading}
          className={cn("w-full !justify-between", className)}
        >
          <div className="flex items-center min-w-0 w-full">
            <span className="truncate">{value ? selectedLabel || placeholder : placeholder}</span>
          </div>
          <div className="flex items-center ml-2">
            {isLoading && <Spinner className="mr-2" />}
            <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" />
          </div>
        </Button>
      </PopoverTrigger>
       <PopoverContent
          side="bottom"
          align="start"
          sideOffset={4}
          className="w-[var(--radix-popover-trigger-width)] min-w-0 p-0 z-[99999] max-h-[250px] overflow-hidden"
          onFocusOutside={preventCloseWhenInsideRef}
          onInteractOutside={preventCloseWhenInsideRef}
      >
          <Command className="max-h-[300px]">
            <CommandInput placeholder={searchPlaceholder} />
          <CommandList className="max-h-[300px] overflow-y-auto overscroll-contain">
                {isLoading ? (
              <div className="p-4 text-center text-sm text-muted-foreground">Loading...</div>
            ) : (
              <>
                <CommandEmpty>{emptyText}</CommandEmpty>
                <CommandGroup>
                  {options.map((option) => (
                    <CommandItem
                      key={String(option.value)}
                      value={String(option.value)}
                      onSelect={() => {
                        const originalValue = option.value;
                        const isDeselecting = String(value) === String(originalValue);
                        onChange(isDeselecting ? '' : originalValue);
                        setOpen(false)
                      }}
                    >
                      <div className="flex items-center min-w-0">
                        <Check
                          className={cn(
                            "mr-2 h-4 w-4 flex-shrink-0",
                            String(value) === String(option.value) ? "opacity-100" : "opacity-0"
                          )}
                        />
                        <span className="truncate">{option.label}</span>
                      </div>
                    </CommandItem>
                  ))}
                </CommandGroup>
                {showAddButton && (
                  <>
                    <CommandSeparator />
                    <CommandGroup>
                      <CommandItem
                        onSelect={() => {
                          setOpen(false);
                          onAddClick?.();
                        }}
                        className="cursor-pointer"
                      >
                        <PlusCircle className="mr-2 h-4 w-4 text-blue-500" />
                        <span className="text-blue-500">{addButtonLabel}</span>
                      </CommandItem>
                    </CommandGroup>
                  </>
                )}
              </>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
