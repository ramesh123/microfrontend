"use client";

import * as React from "react";
import { Check, ChevronsUpDown, PlusCircle, Plus, X } from "lucide-react";

import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FormFieldOption } from "@/types/form";
import Spinner from "./spinner";

interface MultiSelectComboboxProps {
  options: FormFieldOption[];
  value: (string | number)[];
  onChange: (value: (string | number)[]) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  emptyText?: string;
  isLoading?: boolean;
  disabled?: boolean;
  showAddButton?: boolean;
  onAddClick?: () => void;
  addButtonLabel?: string;
  maxDisplay?: number; // Maximum number of selected items to display before showing "+ X more"
  allowCustomValue?: boolean; // Allow users to add custom values not in the options list
  className?: string;
}

export function MultiSelectCombobox({
  options,
  value = [],
  onChange,
  placeholder = "Select options...",
  searchPlaceholder = "Search...",
  emptyText = "No options found.",
  isLoading = false,
  disabled = false,
  showAddButton = false,
  onAddClick,
  addButtonLabel = "Add new...",
  maxDisplay,
  allowCustomValue = false,
  className,
}: MultiSelectComboboxProps) {
  const selectedValues = React.useMemo(() => {
    if (Array.isArray(value)) return value;
    if (value == null || value === "") return [];
    return [value];
  }, [value]);

  const [open, setOpen] = React.useState(false);
  const [searchTerm, setSearchTerm] = React.useState("");
  const searchInputRef = React.useRef<HTMLInputElement>(null);

  // Filter options based on search term
  const filteredOptions = React.useMemo(
    () =>
      options.filter(
        (option) =>
          option?.label &&
          typeof option.label === "string" &&
          option.label.toLowerCase().includes(searchTerm.toLowerCase()),
      ),
    [options, searchTerm],
  );

  // Check if current search term matches any option
  const searchMatchesOption = options.some(
    (opt) =>
      opt.label.toLowerCase() === searchTerm.toLowerCase() ||
      opt.value.toString().toLowerCase() === searchTerm.toLowerCase(),
  );

  // Show "Add custom" option when allowCustomValue is true and search doesn't match existing options
  const showAddCustomOption =
    allowCustomValue && searchTerm.trim() && !searchMatchesOption;

  // Reset search when opening/closing
  React.useEffect(() => {
    if (open) {
      setSearchTerm("");
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 0);
    }
  }, [open]);

  const handleSelect = (selectedValue: string | number) => {
    const isSelected = selectedValues
      .map(String)
      .includes(String(selectedValue));
    const newSelected = isSelected
      ? selectedValues.filter((v) => String(v) !== String(selectedValue))
      : [...selectedValues, selectedValue];
    onChange(newSelected);
  };

  const filteredValues = filteredOptions.map((option) => option.value);
  const allFilteredSelected =
    filteredValues.length > 0 &&
    filteredValues.every((v) =>
      selectedValues.map(String).includes(String(v)),
    );

  const handleSelectAll = () => {
    if (allFilteredSelected) {
      // Deselect only the filtered options, keep others
      onChange(
        selectedValues.filter(
          (v) => !filteredValues.map(String).includes(String(v)),
        ),
      );
    } else {
      // Add all filtered options to current selection (avoid duplicates)
      const newValues = [...selectedValues];
      filteredValues.forEach((v) => {
        if (!newValues.map(String).includes(String(v))) {
          newValues.push(v);
        }
      });
      onChange(newValues);
    }
  };

  const handleAddCustomValue = () => {
    if (searchTerm.trim() && !selectedValues.includes(searchTerm.trim())) {
      onChange([...selectedValues, searchTerm.trim()]);
      setSearchTerm("");
    }
  };

  const handleRemoveValue = (valueToRemove: string | number) => {
    onChange(selectedValues.filter((v) => String(v) !== String(valueToRemove)));
  };

  return (
    <div className="relative w-full">
      <Button
        variant="outliner"
        role="combobox"
        aria-expanded={open}
        className={cn(
          "w-full !justify-between h-auto min-h-[2.25rem] border-input hover:bg-accent hover:text-accent-foreground",
          className,
        )}
        onClick={() => !isLoading && setOpen(!open)}
        disabled={disabled || isLoading}
      >
        <div className="flex gap-1 flex-wrap items-center max-w-full overflow-hidden">
          {selectedValues.length > 0 ? (
            (() => {
              const displayLimit = maxDisplay !== undefined ? maxDisplay : 1;
              const itemsToShow = selectedValues.slice(0, displayLimit);
              const remainingCount = selectedValues.length - displayLimit;

              return (
                <>
                  {itemsToShow.map((val) => {
                    const option = options.find(
                      (o) => String(o.value) === String(val),
                    );
                    const displayLabel = option ? option.label : String(val);
                    return (
                      <Badge
                        key={String(val)}
                        variant="secondary"
                        className="shrink-0 max-w-[150px] truncate flex items-center gap-1"
                      >
                        <span className="truncate">{displayLabel}</span>
                        {allowCustomValue && !disabled && (
                          <X
                            className="h-3 w-3 cursor-pointer hover:text-destructive"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleRemoveValue(val);
                            }}
                          />
                        )}
                      </Badge>
                    );
                  })}
                  {remainingCount > 0 && (
                    <Badge variant="secondary" className="shrink-0">
                      +{remainingCount}
                    </Badge>
                  )}
                </>
              );
            })()
          ) : (
            <span className="text-muted-foreground">{placeholder}</span>
          )}
        </div>
        <div className="flex items-center">
          {isLoading && <Spinner className="mr-2" />}
          <ChevronsUpDown
            className={cn(
              "h-4 w-4 shrink-0 opacity-50 transition-transform",
              open && "rotate-180",
            )}
          />
        </div>
      </Button>

      {open && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-[9998]"
            onClick={() => setOpen(false)}
          />

          {/* Dropdown */}
          <div className="absolute top-full left-0 z-[9999] w-full mt-1 rounded-md bg-popover text-popover-foreground shadow-md border">
            {/* Search Input */}
            <div className="flex items-center border-b px-3 py-2 gap-2">
              <input
                ref={searchInputRef}
                placeholder={searchPlaceholder}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && showAddCustomOption) {
                    e.preventDefault();
                    handleAddCustomValue();
                  }
                }}
                className="h-8 flex-1 border-0 bg-transparent p-0 text-sm outline-none placeholder:text-muted-foreground"
                autoComplete="off"
              />
              {searchTerm && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 w-6 p-0 hover:bg-transparent"
                  onClick={() => setSearchTerm("")}
                >
                  <X className="h-3 w-3" />
                </Button>
              )}
              {allowCustomValue && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 w-6 p-0 hover:bg-transparent"
                  onClick={handleAddCustomValue}
                  disabled={
                    !searchTerm.trim() ||
                    selectedValues.includes(searchTerm.trim())
                  }
                  title="Add custom value"
                >
                  <Plus className="h-3 w-3" />
                </Button>
              )}
            </div>

            {/* Options List */}
            <div className="max-h-[200px] overflow-y-auto overflow-x-hidden">
              <div className="p-1 space-y-1">
                {isLoading ? (
                  <div className="py-6 text-center text-sm text-muted-foreground">
                    Loading...
                  </div>
                ) : filteredOptions.length === 0 ? (
                  <div className="py-6 text-center text-sm text-muted-foreground">
                    {emptyText}
                  </div>
                ) : (
                  <>
                    {/* Select All Option */}
                    <div
                      className={cn(
                        "relative flex cursor-pointer select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none transition-colors",
                        "hover:bg-accent hover:text-accent-foreground",
                      )}
                      onClick={handleSelectAll}
                    >
                      <div
                        className={cn(
                          "mr-2 flex h-4 w-4 items-center justify-center rounded-sm border border-input",
                          allFilteredSelected && filteredOptions.length > 0
                            ? "text-primary border-primary"
                            : "opacity-50 [&_svg]:invisible",
                        )}
                      >
                        <Check className="h-4 w-4" />
                      </div>
                      <span>
                        {allFilteredSelected ? "Deselect All" : "Select All"}
                      </span>
                    </div>

                    {/* Individual Options */}
                    {filteredOptions.map((option) => {
                      const isSelected = selectedValues
                        .map(String)
                        .includes(String(option.value));
                      return (
                        <div
                          key={String(option.value)}
                          className={cn(
                            "relative flex cursor-pointer select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none transition-colors",
                            "hover:bg-accent hover:text-accent-foreground",
                            isSelected && "bg-accent/50",
                          )}
                          onClick={() => handleSelect(option.value)}
                        >
                          <div
                            className={cn(
                              "mr-2 flex h-4 w-4 items-center justify-center rounded-sm border border-input",
                              isSelected
                                ? "text-primary border-primary"
                                : "opacity-50 [&_svg]:invisible",
                            )}
                          >
                            <Check className="h-4 w-4" />
                          </div>
                          <span className="flex-1">{option.label}</span>
                        </div>
                      );
                    })}
                  </>
                )}
              </div>
            </div>

            {/* Action Buttons */}
            {(showAddButton || showAddCustomOption) && (
              <div className="border-t bg-popover">
                <div className="p-1">
                  {showAddButton && (
                    <div
                      className={cn(
                        "relative flex cursor-pointer select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none transition-colors",
                        "hover:bg-accent hover:text-accent-foreground",
                      )}
                      onClick={() => {
                        setOpen(false);
                        onAddClick?.();
                      }}
                    >
                      <PlusCircle className="mr-2 h-4 w-4 text-blue-500" />
                      <span className="flex-1 text-blue-500">
                        {addButtonLabel}
                      </span>
                    </div>
                  )}
                  {showAddCustomOption && (
                    <div
                      className={cn(
                        "relative flex cursor-pointer select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none transition-colors",
                        "hover:bg-accent hover:text-accent-foreground",
                      )}
                      onClick={handleAddCustomValue}
                    >
                      <Plus className="mr-2 h-4 w-4" />
                      <span className="flex-1">Add "{searchTerm.trim()}"</span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Results count */}
            {searchTerm && (
              <div className="border-t px-3 py-2 text-xs text-muted-foreground">
                {filteredOptions.length} of {options.length} options
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
