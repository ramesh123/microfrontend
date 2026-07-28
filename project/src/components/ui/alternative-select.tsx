"use client"

import type React from "react"

import { useState, useRef, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Input } from "@/components/ui/input"
import { Check, ChevronDown, ChevronsUpDown, PlusCircle, Search, X, Plus, Table, Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"
import { FormFieldOption } from "@/types/form"

interface AlternativeSelectProps {  
  options: FormFieldOption[];
  value?: string | number;
  onChange: (value: string | number, option?: FormFieldOption) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  emptyText?: string;
  isLoading?: boolean;
  disabled?: boolean;
  showAddButton?: boolean;
  onAddClick?: () => void;
  addButtonLabel?: string;
  className?: string;
  // New props for table creation
  showCreateTable?: boolean;
  /** When set, "Create table" opens this callback instead of the inline dropdown form. */
  onCreateTableClick?: () => void;
  onCreateTable?: (tableName: string) => void;
  createTableLabel?: string;
  // New prop for custom value input
  allowCustomValue?: boolean;
  onDropdownOpen?: () => void;
}

export function AlternativeSelect({
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
  showCreateTable = false,
  onCreateTableClick,
  onCreateTable,
  createTableLabel = "Create new table",
  // New prop for custom value with default
  allowCustomValue = false,
  onDropdownOpen
}: AlternativeSelectProps) {
  const [open, setOpen] = useState(false)
  const [searchTerm, setSearchTerm] = useState("")
  const [highlightedIndex, setHighlightedIndex] = useState(-1)
  const [openUpward, setOpenUpward] = useState(false)

  // State for inline forms
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [newTableName, setNewTableName] = useState("")
  const [showCustomInput, setShowCustomInput] = useState(false)
  const [customValue, setCustomValue] = useState("")

  // Refs for inputs and positioning
  const triggerRef = useRef<HTMLButtonElement>(null)
  const searchInputRef = useRef<HTMLInputElement>(null)
  const createTableInputRef = useRef<HTMLInputElement>(null)
  const customValueInputRef = useRef<HTMLInputElement>(null)
  const optionsRef = useRef<HTMLDivElement[]>([])

  const onDropdownOpenRef = useRef(onDropdownOpen)
  useEffect(() => {
    onDropdownOpenRef.current = onDropdownOpen
  }, [onDropdownOpen])

  // Filter options based on search term
  const filteredOptions = options.filter((option) => option.label.toLowerCase().includes(searchTerm.toLowerCase()))

  // Check if current search term matches any option
  const searchMatchesOption = options.some(
    (opt) => opt.label.toLowerCase() === searchTerm.toLowerCase() ||
             opt.value.toString().toLowerCase() === searchTerm.toLowerCase() ||
             (opt.description?.toString().toLowerCase() === searchTerm.toLowerCase())
  )

  // Show "Add custom" option when allowCustomValue is true and search doesn't match existing options
  const showAddCustomOption = allowCustomValue && searchTerm.trim() && !searchMatchesOption

  // Calculate total interactive items (options + buttons)
  const totalItems = filteredOptions.length +
                     (showAddButton ? 1 : 0) +
                     (showCreateTable ? 1 : 0) +
                     (showAddCustomOption ? 1 : 0)

  // Calculate dropdown position when opening
  useEffect(() => {
    if (open && triggerRef.current) {
      const triggerRect = triggerRef.current.getBoundingClientRect()
      const dropdownHeight = 300 // Approximate max height of dropdown
      const spaceBelow = window.innerHeight - triggerRect.bottom
      const spaceAbove = triggerRect.top

      // Open upward if there's more space above and not enough below
      setOpenUpward(spaceBelow < dropdownHeight && spaceAbove > spaceBelow)

      setSearchTerm("")
      setHighlightedIndex(-1)
      setShowCreateForm(false)
      setNewTableName("")
      setShowCustomInput(false)
      setCustomValue("")
      // Focus search input when dropdown opens
      setTimeout(() => {
        searchInputRef.current?.focus()
      }, 0)

      onDropdownOpenRef.current?.()
    }
  }, [open])

  // Focus form inputs when they appear
  useEffect(() => {
    if (showCreateForm) {
      setTimeout(() => createTableInputRef.current?.focus(), 0)
    }
    if (showCustomInput) {
      setTimeout(() => customValueInputRef.current?.focus(), 0)
    }
  }, [showCreateForm, showCustomInput])

  // Handle keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!open) return

    // Handle inline forms first
    if (showCreateForm) {
      if (e.key === "Enter") { e.preventDefault(); handleCreateTable() }
      if (e.key === "Escape") { e.preventDefault(); setShowCreateForm(false); setNewTableName(""); searchInputRef.current?.focus() }
      return
    }
    if (showCustomInput) {
      if (e.key === "Enter") { e.preventDefault(); handleCustomValueSubmit() }
      if (e.key === "Escape") { e.preventDefault(); setShowCustomInput(false); setCustomValue(""); searchInputRef.current?.focus() }
      return
    }

    // Handle list navigation
    switch (e.key) {
      case "ArrowDown":
        e.preventDefault()
        setHighlightedIndex((prev) => (prev < totalItems - 1 ? prev + 1 : 0))
        break
      case "ArrowUp":
        e.preventDefault()
        setHighlightedIndex((prev) => (prev > 0 ? prev - 1 : totalItems - 1))
        break
      case "Enter":
        e.preventDefault()
        handleEnterKey()
        break
      case "Escape":
        e.preventDefault()
        setOpen(false)
        break
    }
  }

  // --- Helper functions for keyboard navigation and actions ---

  const getButtonIndex = (type: 'add' | 'create' | 'custom'): number => {
    let index = filteredOptions.length;
    if (type === 'add') return index;
    if (showAddButton) index++;

    if (type === 'create') return index;
    if (showCreateTable) index++;

    if (type === 'custom') return index;

    return -1; // Should not happen
  }

  // Handle adding custom value from search input
  const handleAddCustomFromSearch = () => {
    if (searchTerm.trim()) {
      onChange(searchTerm.trim())
      setOpen(false)
    }
  }

  const handleEnterKey = () => {
    // If no item is highlighted but we have a search term and custom is allowed, add it
    if (highlightedIndex < 0) {
      if (showAddCustomOption) {
        handleAddCustomFromSearch()
      }
      return;
    }

    if (highlightedIndex < filteredOptions.length) {
      const selectedOption = filteredOptions[highlightedIndex];
      onChange(selectedOption.value, selectedOption)
      setOpen(false)
      return
    } else if (showAddButton && highlightedIndex === getButtonIndex('add')) {
      onAddClick?.()
      setOpen(false)
    } else if (showCreateTable && highlightedIndex === getButtonIndex('create')) {
      if (onCreateTableClick) {
        onCreateTableClick()
        setOpen(false)
      } else {
        setShowCreateForm(true)
      }
    } else if (showAddCustomOption && highlightedIndex === getButtonIndex('custom')) {
      // Handle the dynamic "Add [value]" option
      handleAddCustomFromSearch()
    } else if (allowCustomValue && !showAddCustomOption && highlightedIndex === getButtonIndex('custom')) {
      setShowCustomInput(true)
    }
  }

  const handleCreateTable = () => {   
    if (newTableName.trim() && onCreateTable) { 
      const tableName = newTableName.trim()
      onCreateTable(tableName)
      onChange(tableName) // Set the new table as selected value
      setOpen(false)
    }
  }

  const handleCustomValueSubmit = () => {
    if (customValue.trim()) {
      onChange(customValue.trim())
      setOpen(false)
    }
  }

  // Scroll highlighted option into view
  useEffect(() => {
    if (highlightedIndex >= 0 && optionsRef.current[highlightedIndex]) {
      optionsRef.current[highlightedIndex].scrollIntoView({ block: "nearest" })
    }
  }, [highlightedIndex])

  const clearSearch = () => {
    setSearchTerm("")
    searchInputRef.current?.focus()
  }

  const selectedOption = options.find(
    (option) =>
      String(option.value) === String(value ?? '') ||
      String(option.value).toLowerCase() === String(value ?? '').toLowerCase(),
  )
  const displayLabel =
    value != null && value !== ''
      ? selectedOption?.label ?? String(value)
      : null

  return (
    <div className="relative w-full" onKeyDown={handleKeyDown}>
      <Button
        ref={triggerRef}
        variant="outliner"
        role="combobox"
        aria-expanded={open}
        className={cn("!justify-between bg-transparent w-full border-input hover:bg-accent hover:text-accent-foreground", className)}
        onClick={() => !isLoading && setOpen(!open)}
        disabled={disabled || isLoading}
      >
        <span className={cn("truncate", !displayLabel && "text-muted-foreground")}>
          {displayLabel ?? placeholder}
        </span>
        {isLoading ? (
          <Loader2 className="ml-2 h-4 w-4 shrink-0 animate-spin" />
        ) : (
          <ChevronsUpDown className={cn("ml-2 h-4 w-4 shrink-0 transition-transform", open && "rotate-180")} />
        )}
      </Button>

      {open && (
        <>
          {/* Backdrop */}
          <div className="fixed inset-0 z-[9998]" onClick={() => setOpen(false)} />

          {/* Dropdown */}
          <div className={cn(
            "absolute left-0 z-[9999] w-full rounded-md bg-popover text-popover-foreground shadow-md",
            openUpward ? "bottom-full mb-1" : "top-full mt-1"
          )}>
            
            {showCreateForm ? (
              /* Create Table Form */
              <div className="p-3">
                <div className="flex items-center space-x-2 mb-2">
                  <Table className="h-4 w-4" />
                  <span className="text-sm font-medium">Create New Table</span>
                </div>
                <div className="flex items-center space-x-2">
                  <Input ref={createTableInputRef} placeholder="Enter table name..." value={newTableName} onChange={(e) => setNewTableName(e.target.value)} className="h-8 flex-1" onKeyDown={(e) => e.stopPropagation()} />
                  <Button size="sm" onClick={handleCreateTable} disabled={!newTableName.trim()}>Create</Button>
                  <Button size="sm" variant="ghost" onClick={() => { setShowCreateForm(false); setNewTableName(""); searchInputRef.current?.focus() }}>Cancel</Button>
                </div>
              </div>
            ) : (
              /* Search Input / Custom Input Mode */
              <div className="flex items-center border-b px-3 py-2">
                {showCustomInput ? (  
                  <>
                    <Plus className="mr-2 h-4 w-4 shrink-0 text-primary" />
                    <Input
                      ref={customValueInputRef}
                      placeholder="Enter custom value..."
                      value={customValue}
                      onChange={(e) => setCustomValue(e.target.value)}
                      className="h-8 border-0 p-0 outline-none placeholder:text-muted-foreground focus-visible:ring-0 focus-visible:ring-offset-0 flex-1"
                      autoComplete="off"
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && customValue.trim()) { 
                          e.preventDefault()
                          handleCustomValueSubmit()
                        } else if (e.key === "Escape") {
                          e.preventDefault()
                          setShowCustomInput(false)
                          setCustomValue("")
                          setTimeout(() => searchInputRef.current?.focus(), 0)
                        }
                      }}
                    />
                    {customValue && (
                      <Button variant="ghost" size="sm" className="h-6 px-2 text-xs text-primary hover:bg-primary/10" onClick={handleCustomValueSubmit}>
                        Add
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 w-6 p-0 hover:bg-transparent"
                      onClick={() => {
                        setShowCustomInput(false)
                        setCustomValue("")
                        setTimeout(() => searchInputRef.current?.focus(), 0)
                      }}
                    >
                      <Search className="h-3 w-3" />
                    </Button>
                  </>
                ) : (
                  <>
                    <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
                    <Input ref={searchInputRef} placeholder={searchPlaceholder} value={searchTerm} onChange={(e) => { setSearchTerm(e.target.value); setHighlightedIndex(-1) }} className="h-8 border-0 p-0 outline-none placeholder:text-muted-foreground focus-visible:ring-0 focus-visible:ring-offset-0" autoComplete="off" />
                    {searchTerm && (<Button variant="ghost" size="sm" className="h-6 w-6 p-0 hover:bg-transparent" onClick={clearSearch}><X className="h-3 w-3" /></Button>)}
                    {allowCustomValue && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 p-0 hover:bg-transparent ml-1"
                        onClick={() => {
                          setShowCustomInput(true)
                          setCustomValue(searchTerm) // Pre-fill with search term
                          setTimeout(() => customValueInputRef.current?.focus(), 0)
                        }}
                        title="Enter custom value"
                      >
                        <Plus className="h-3 w-3" />
                      </Button>
                    )}
                  </>
                )}
              </div>
            )}

            {!showCreateForm && (
              <>
                {/* Options List */}
                <ScrollArea>
                  <div className="p-1 space-y-1 max-h-[200px]">
                    {isLoading ? (
                      <div className="py-6 flex flex-col items-center justify-center text-sm text-muted-foreground"><Loader2 className="h-6 w-6 animate-spin mb-2" /><span>Loading options...</span></div>
                    ) : filteredOptions.length === 0 && !showAddButton && !showCreateTable && !allowCustomValue ? (
                      <div className="py-6 text-center text-sm text-muted-foreground">{emptyText}</div>
                    ) : (
                      filteredOptions.map((option, index) => (
                        <div key={option.value} ref={(el) => { if (el) optionsRef.current[index] = el }} className={cn("relative flex cursor-pointer select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none transition-colors", "hover:bg-accent hover:text-accent-foreground", String(value ?? '') === String(option.value) && "bg-accent text-accent-foreground", highlightedIndex === index && "bg-accent/50")} onClick={() => { onChange(option.value, option); setOpen(false) }} onMouseEnter={() => setHighlightedIndex(index)}>
                          <Check className={cn("mr-2 h-4 w-4", String(value ?? '') === String(option.value) ? "opacity-100" : "opacity-0")} />
                          <div className="flex flex-col flex-1">
                          <span className="font-medium">{option.label}</span>
                          {option.description && (
                            <span className="text-xs text-muted-foreground whitespace-normal">
                              {option.description}
                            </span>
                          )}
                        </div>
                        </div>
                      ))
                    )}
                  </div>
                </ScrollArea>

                {/* Sticky Action Buttons */}
                {(showAddButton || showCreateTable || showAddCustomOption) && (
                  <div className="border-t bg-popover">
                    <div className="p-1 space-y-1">
                      {showAddButton && (
                        <div className={cn("relative flex cursor-pointer select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none transition-colors", "hover:bg-accent hover:text-accent-foreground", highlightedIndex === getButtonIndex('add') && "bg-accent/50")} onClick={() => { onAddClick?.(); setOpen(false) }} onMouseEnter={() => setHighlightedIndex(getButtonIndex('add'))}>
                          <PlusCircle className="mr-2 h-4 w-4" />
                          <span className="flex-1">{addButtonLabel}</span>
                        </div>
                      )}
                      {showCreateTable && (
                        <div className={cn("relative flex cursor-pointer select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none transition-colors", "hover:bg-accent hover:text-accent-foreground", highlightedIndex === getButtonIndex('create') && "bg-accent/50")} onClick={() => { if (onCreateTableClick) { onCreateTableClick(); setOpen(false) } else { setShowCreateForm(true) } }} onMouseEnter={() => setHighlightedIndex(getButtonIndex('create'))}>
                          <Table className="mr-2 h-4 w-4" />
                          <span className="flex-1">{createTableLabel}</span>
                        </div>
                      )}
                      {showAddCustomOption && (
                        <div
                          className={cn("relative flex cursor-pointer select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none transition-colors", "hover:bg-accent hover:text-accent-foreground", highlightedIndex === getButtonIndex('custom') && "bg-accent/50")}
                          onClick={handleAddCustomFromSearch}
                          onMouseEnter={() => setHighlightedIndex(getButtonIndex('custom'))}
                        >
                          <Plus className="mr-2 h-4 w-4" />
                          <span className="flex-1">Add "{searchTerm.trim()}"</span>
                        </div>
                      )}
                    </div>
                  </div>
                )}
                {searchTerm && (
                  <div className="border-t px-3 py-2 text-xs text-muted-foreground">
                    {filteredOptions.length} of {options.length} options
                  </div>
                )}
              </>
            )}
          </div>
        </>
      )}
    </div>
  )
}