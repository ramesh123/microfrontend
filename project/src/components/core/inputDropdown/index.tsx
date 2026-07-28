import React, { useState } from 'react';
import { Label } from "@/components/ui/label";
import { Check, ChevronsUpDown, Info, PlusCircle } from "lucide-react";
import { cn } from '@/lib/utils';
import ShadTooltip from '@/components/common/shadTooltipComponent';
import { InputDropdownProps } from '@/types/form';
import { useFetchDropdownOptions } from '@/hooks/useFetchDropdownOptions';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command"

const InputDropdown: React.FC<InputDropdownProps> = ({ 
  name,
  displayName,
  placeholder = "Select an option",
  required = false,
  info,
  value = "",
  options,
  fetch,
  showAddButton = false,
  onAddClick,
  addButtonLabel = "Add new...",
  onChange,
  formValues,
}) => {
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const shouldFetch = !!fetch && (!options || options.length === 0);

  /** When the form hydrates with a saved id, we need options loaded to map value → label (not only after opening). */
  const hasPersistedSelection =
    value !== undefined &&
    value !== null &&
    String(value).trim() !== "";

  const [currentValue, setCurrentValue] = React.useState(value || "")
  const [cachedOptions, setCachedOptions] = React.useState(options || [])

  React.useEffect(() => {
    setCurrentValue(value !== undefined && value !== null ? String(value) : "");
  }, [value]);

  // Provide a safe dummy fetch object if fetch is undefined to prevent runtime error
  const safeFetch = fetch ?? { klass: "", method: "post", module: "", params: { payload: {} } };

  const fetchEnabled =
    shouldFetch && (dropdownOpen || hasPersistedSelection);

  const {
    data: fetchedOptions,
    isLoading: isFetching,
    refetch,
  } = useFetchDropdownOptions(safeFetch, fetchEnabled, formValues || {});

  // Handle dropdown open/close
  const handleOpenChange = (open: boolean) => { 
    setDropdownOpen(open);
    if (open && shouldFetch) {
      refetch();
    }
  };
  const finalOptions = React.useMemo(
    () => (options && options.length > 0 ? options : fetchedOptions || []),
    [options, fetchedOptions]
  );

  /** Keep a copy for closed state; label resolution prefers live `finalOptions` so the first pick isn't stuck on placeholder. */
  React.useEffect(() => {
    if (finalOptions.length > 0) {
      setCachedOptions([...finalOptions]);
    }
  }, [finalOptions]);

  const optionsForLabel =
    options && options.length > 0
      ? options
      : finalOptions.length > 0
        ? finalOptions
        : cachedOptions;

  const selectedLabel =
    currentValue &&
    optionsForLabel.find(
      (option) => String(option.value) === String(currentValue)
    )?.label;

  return ( 
    <div className="space-y-2">
      <div className="flex items-center gap-1 mb-0">
        <Label htmlFor={name} className="text-sm font-medium cursor-help inline-flex items-center gap-1">
          {displayName} {required && <span className="text-red-600">*</span>}
        </Label>
        {info && ( 
          <ShadTooltip content={info}>
            <Info className="h-3 w-3 text-muted-foreground cursor-help" />
          </ShadTooltip>
        )}
      </div>
      
      <Popover open={dropdownOpen} onOpenChange={handleOpenChange}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={dropdownOpen}
            className={cn("w-full !justify-between !border-gray-300")}
          >
            <span className="truncate text-foreground/60">
              {currentValue
                ? selectedLabel ?? String(currentValue)
                : placeholder}
            </span>
            <ChevronsUpDown className="opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent
          className="w-[var(--radix-popover-trigger-width)] min-w-0 p-0"
          onOpenAutoFocus={(e) => e.preventDefault()}
        >
          <Command className="w-full max-h-[280px]">
            <CommandInput placeholder={placeholder} className="h-9" />
            <CommandList className="max-h-[220px]">
              <CommandEmpty>
                {isFetching ? "Loading…" : "No options found."}
              </CommandEmpty>
              <CommandGroup>
                {finalOptions.map((option) => (
                  <CommandItem
                    key={String(option.value)}
                    value={String(option.value)}
                    onPointerDown={(e) => {
                      e.preventDefault();
                    }}
                    onSelect={() => {
                      const next = option.value;
                      setCurrentValue(String(next));
                      setDropdownOpen(false);
                      (onChange as any)?.(next, option);
                    }}
                  >
                    {option.label}
                    <Check
                      className={cn(
                        "ml-auto",
                        String(currentValue) === String(option.value)
                          ? "opacity-100"
                          : "opacity-0"
                      )}
                    />
                  </CommandItem>
                ))}
              </CommandGroup>
              {showAddButton && (
                <>
                  <CommandSeparator />
                  <CommandGroup>
                    <CommandItem
                      onPointerDown={(e) => e.preventDefault()}
                      onSelect={() => {
                        setDropdownOpen(false);
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
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  );
};

export default InputDropdown;