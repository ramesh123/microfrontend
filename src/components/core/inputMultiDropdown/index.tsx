import React, { useMemo, useState } from 'react';
import { Label } from "@/components/ui/label";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Info, X, ChevronDown, Check, ChevronsUpDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useFetchDropdownOptions } from '@/hooks/useFetchDropdownOptions';
import { Skeleton } from "@/components/ui/skeleton";
import { InputMultiDropdownProps } from "@/types/form";

interface Option {
  value: string;
  label: string;
}

const InputMultiDropdown: React.FC<InputMultiDropdownProps> = ({
  name,
  displayName,
  placeholder,
  required = false,
  info,
  options = [],
  value = [],
  onChange,
  fetch,
  formValues = {}
}) => {
  const [open, setOpen] = useState(false);

  // Determine if we should fetch data
  const shouldFetch = !!fetch && (!options || options.length === 0);

  // Provide a safe dummy fetch object if fetch is undefined to prevent runtime error
  const safeFetch = fetch ?? { klass: "", method: "post", module: "", params: { payload: {} } };

  const {
    data: fetchedOptions,
    isError,
    isLoading: isFetching,
    refetch
  } = useFetchDropdownOptions(safeFetch, shouldFetch && open, formValues);

  // Handle dropdown open/close
  const handleOpenChange = (isOpen: boolean) => {  //if setOpen(is)
    setOpen(isOpen);
    if (isOpen && shouldFetch) {
      refetch();
    }
  };

  // Use fetched options if available, otherwise use provided options
  const finalOptions = options && options.length > 0 ? options : fetchedOptions || [];

  /** Props may pass string[] or { value, label }[]; downstream logic always uses string ids. */
  const selectionValues = useMemo(() => {
    if (!Array.isArray(value)) return [];
    return value.map((v: unknown) => {
      if (v != null && typeof v === 'object' && 'value' in (v as Option)) {
        return String((v as Option).value);
      }
      return String(v);
    });
  }, [value]);

  const handleSelect = (currentValue: string) => {
    const currentSelection = selectionValues;

    if (currentSelection.includes(currentValue)) {
      onChange(currentSelection.filter((v) => v !== currentValue));
    } else {
      onChange([...currentSelection, currentValue]);
    }
  };

  const handleRemove = (item: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    onChange(selectionValues.filter((v) => v !== item));
  };

  const truncateText = (text: string, maxLength: number = 20) => {
    return text.length > maxLength ? `${text.slice(0, maxLength)}...` : text;
  };

  const renderSelectedContent = () => {
    if (selectionValues.length === 0) {
      return <span className="text-muted-foreground">{placeholder}</span>;
    }

    if (selectionValues.length <= 2) {
      return (
        <div className="flex flex-wrap gap-1 max-w-full">
          {selectionValues.map((item) => {
            const optionLabel = finalOptions.find(option => option.value === item)?.label || item;
            return (
              <Badge
                key={item}
                variant="secondary"
                className="pr-1 max-w-[120px] flex items-center"
              >
                <span className="truncate">{truncateText(optionLabel, 15)}</span>
                <Button
                  variant="ghost"
                  size="xs"
                  className="h-4 w-4 p-0 ml-1 hover:bg-transparent"
                  onClick={(e) => handleRemove(item, e)}
                >
                  <X className="h-2 w-2" />
                </Button>
              </Badge>
            );
          })}
        </div>
      );
    }

    return <span className="text-foreground">{selectionValues.length} selected</span>;
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-1">
        <Label htmlFor={name}>
          {displayName} {required && <span className="text-slate-700">*</span>}
        </Label>
        {info && (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Info className="h-4 w-4 text-muted-foreground cursor-help" />
              </TooltipTrigger>
              <TooltipContent>
                <p>{info}</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
      </div>
      <Popover open={open} onOpenChange={handleOpenChange}>
        <PopoverTrigger asChild>
          <Button variant="outline" role="combobox" aria-expanded={open} className="w-full justify-between h-auto min-h-10">
            <div className="flex-1 text-left font-normal truncate">
              {renderSelectedContent()}
            </div>
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
          <Command>
            <CommandInput placeholder="Search columns..." />
            <CommandList>
              <CommandEmpty>No columns found.</CommandEmpty>
              <CommandGroup>
                {finalOptions.map((option) => (
                  <CommandItem key={option.value} value={`${option.value}`}
                    onSelect={() => handleSelect(option.value)}
                    className="cursor-pointer">
                    <Check className={cn("mr-2 h-4 w-4", selectionValues.includes(option.value) ? "opacity-100" : "opacity-0")} />
                    <div className="flex items-center gap-2 flex-1">
                      <span className="truncate">{option.label}</span>
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  );
};

export default InputMultiDropdown;