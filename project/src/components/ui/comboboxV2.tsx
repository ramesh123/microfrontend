// src/components/ui/comboboxV2.tsx
"use client";

import * as React from "react";
import { Check, ChevronsUpDown, PlusCircle, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import Spinner from "./spinner";

export type FormFieldOption = {
  value: string | number;
  label: string;
  icon?: React.ComponentType<{ className?: string }>;
};

interface ComboboxProps {
  options: FormFieldOption[];
  value?: string | number;
  onChange: (value: string | number) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  emptyText?: string;
  isLoading?: boolean;
  disabled?: boolean;
  showAddButton?: boolean;
  onAddClick?: () => void;
  addButtonLabel?: string;
  // New prop for custom value input
  allowCustomValue?: boolean;
  customValueLabel?: string;
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
  // New prop for custom value with default
  allowCustomValue = false,
  customValueLabel = "Other...",
}: ComboboxProps) {
  const [open, setOpen] = React.useState(false);
  const [showCustomInput, setShowCustomInput] = React.useState(false);
  const [customValue, setCustomValue] = React.useState("");
  const customValueInputRef = React.useRef<HTMLInputElement>(null);

  const selectedOption = options.find(
    (option) => String(option.value) === String(value)
  );

  // For custom values that aren't in the options list, display the raw value
  const displayValue = selectedOption?.label || (value && String(value)) || placeholder;

  // Reset custom input state when opening/closing
  React.useEffect(() => {
    if (open) {
      setShowCustomInput(false);
      setCustomValue("");
    }
  }, [open]);

  // Focus custom input when it appears
  React.useEffect(() => {
    if (showCustomInput) {
      setTimeout(() => customValueInputRef.current?.focus(), 0);
    }
  }, [showCustomInput]);

  // Handle custom value submission
  const handleCustomValueSubmit = () => {
    if (customValue.trim()) {
      onChange(customValue.trim());
      setOpen(false);
      setShowCustomInput(false);
      setCustomValue("");
    }
  };

  // Handle custom input key down
  const handleCustomInputKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleCustomValueSubmit();
    } else if (e.key === "Escape") {
      e.preventDefault();
      setShowCustomInput(false);
      setCustomValue("");
    }
    e.stopPropagation();
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between font-normal !h-8 text-xs px-2 text-left"
          disabled={disabled || isLoading}
        >
          <div className="flex items-center truncate min-w-0 flex-1">
            {selectedOption?.icon && (
              <selectedOption.icon className="mr-2 h-3 w-3 text-muted-foreground flex-shrink-0" />
            )}
            <span className="truncate text-xs">
              {displayValue}
            </span>
          </div>
          <div className="flex items-center ml-2 flex-shrink-0">
            {isLoading && <Spinner className="mr-1 h-3 w-3" />}
            <ChevronsUpDown className="h-3 w-3 opacity-50" />
          </div>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0 z-[999]">
        {showCustomInput ? (
          /* Custom Value Input Form */
          <div className="p-3">
            <div className="flex items-center space-x-2 mb-2">
              <Plus className="h-3 w-3" />
              <span className="text-xs font-medium">{customValueLabel}</span>
            </div>
            <div className="flex items-center space-x-2">
              <Input
                ref={customValueInputRef}
                placeholder="Enter custom value..."
                value={customValue}
                onChange={(e) => setCustomValue(e.target.value)}
                className="h-7 flex-1 text-xs"
                onKeyDown={handleCustomInputKeyDown}
              />
              <Button
                size="sm"
                onClick={handleCustomValueSubmit}
                disabled={!customValue.trim()}
                className="h-7 text-xs px-2"
              >
                Add
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  setShowCustomInput(false);
                  setCustomValue("");
                }}
                className="h-7 text-xs px-2"
              >
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <Command>
            <CommandInput placeholder={searchPlaceholder} className="h-8 text-xs" />
            <CommandList>
              {isLoading ? (
                <div className="p-3 text-center text-xs text-muted-foreground">
                  Loading...
                </div>
              ) : (
                <>
                  <CommandEmpty className="text-xs p-3">{emptyText}</CommandEmpty>
                  <CommandGroup>
                    {options.map((option) => (
                      <CommandItem
                        key={String(option.value)}
                        value={option.label}
                        onSelect={() => {
                          const isDeselecting =
                            String(value) === String(option.value);
                          onChange(isDeselecting ? "" : option.value);
                          setOpen(false);
                        }}
                        className="text-xs py-1.5 px-2"
                      >
                        <div className="flex items-center w-full">
                          <Check
                            className={cn(
                              "mr-2 h-3 w-3 flex-shrink-0",
                              String(value) === String(option.value)
                                ? "opacity-100"
                                : "opacity-0"
                            )}
                          />
                          {option.icon && (
                            <option.icon className="mr-2 h-3 w-3 text-muted-foreground flex-shrink-0" />
                          )}
                          <span className="truncate text-xs flex-1">
                            {option.label}
                          </span>
                        </div>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                  {(showAddButton || allowCustomValue) && (
                    <>
                      <CommandSeparator />
                      <CommandGroup>
                        {showAddButton && (
                          <CommandItem
                            onSelect={() => {
                              setOpen(false);
                              onAddClick?.();
                            }}
                            className="cursor-pointer text-xs py-1.5 px-2"
                          >
                            <div className="flex items-center w-full">
                              <PlusCircle className="mr-2 h-3 w-3 text-blue-500 flex-shrink-0" />
                              <span className="text-blue-500 text-xs">{addButtonLabel}</span>
                            </div>
                          </CommandItem>
                        )}
                        {allowCustomValue && (
                          <CommandItem
                            onSelect={() => {
                              setShowCustomInput(true);
                            }}
                            className="cursor-pointer text-xs py-1.5 px-2"
                          >
                            <div className="flex items-center w-full">
                              <Plus className="mr-2 h-3 w-3 text-blue-500 flex-shrink-0" />
                              <span className="text-blue-500 text-xs">{customValueLabel}</span>
                            </div>
                          </CommandItem>
                        )}
                      </CommandGroup>
                    </>
                  )}
                </>
              )}
            </CommandList>
          </Command>
        )}
      </PopoverContent>
    </Popover>
  );
}