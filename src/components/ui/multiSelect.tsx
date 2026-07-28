import * as React from "react"
import { Check, ChevronDown, X } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList, CommandSeparator } from "@/components/ui/command"
import { Badge } from "@/components/ui/badge"

export interface MultiSelectOption {
  value: string
  label: string
}

interface MultiSelectProps { 
  options: MultiSelectOption[]
  selected: string[]
  onChange: (selected: string[]) => void
  placeholder?: string
  className?: string
  maxDisplay?: number
}

export function MultiSelect({
  options,
  selected,
  onChange,
  placeholder = "Select items...",
  className,
  maxDisplay = 3
}: MultiSelectProps) {
  const [open, setOpen] = React.useState(false)

  const selectedOptions = options.filter(option => selected.includes(option.value))

  const toggleOption = (value: string) => {
    onChange(
      selected.includes(value)
        ? selected.filter((item) => item !== value)
        : [...selected, value]
    )
  }

  const handleSelectAll = () => {
    if (selected.length === options.length) {
      onChange([])
    } else {
      onChange(options.map((option) => option.value))
    }
  }

  const allSelected = selected.length === options.length;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn(
            "w-full justify-between h-auto min-h-9 px-3 py-2",
            "bg-background",
            "hover:bg-secondary",
            "focus:ring-2 focus:ring-primary/20 focus:border-primary",
            className
          )}
        >
          <div className="flex gap-1 flex-wrap flex-1 min-h-5">
            {selectedOptions.length === 0 && (
              <span className="text-muted-foreground text-sm">{placeholder}</span>
            )}
            {selectedOptions.slice(0, maxDisplay).map((option) => (
              <Badge
                key={option.value}
                variant="secondary"
                className="text-xs h-6 px-2 bg-primary/10 text-primary hover:bg-primary/20"
              >
                {option.label}
                <span
                  role="button"
                  tabIndex={0}
                  aria-label={`Remove ${option.label}`}
                  className="ml-1 hover:bg-primary/30 rounded-full p-0.5 focus:outline-none focus:ring-2 focus:ring-ring"
                  onClick={(e) => {
                    e.preventDefault()
                    e.stopPropagation()
                    toggleOption(option.value)
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      e.stopPropagation();
                      toggleOption(option.value);
                    }
                  }}
                >
                  <X className="h-3 w-3" />
                </span>
              </Badge>
            ))}
            {selectedOptions.length > maxDisplay && (
              <Badge variant="secondary" className="text-xs h-6 px-2 bg-muted text-muted-foreground">
                +{selectedOptions.length - maxDisplay} more
              </Badge>
            )}
          </div>
          <ChevronDown className="h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-full p-0 bg-popover border-border" align="start">
        <Command className="bg-transparent">
          <CommandInput placeholder="Search options..." className="h-9" />
          <CommandList className="max-h-64 custom-scrollbar">
            <CommandEmpty>No options found.</CommandEmpty>
            <CommandGroup>
              <CommandItem
                onSelect={handleSelectAll}
                onMouseDown={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                }}
                className="flex items-center gap-2 px-2 py-1.5 hover:bg-accent/10 cursor-pointer"
              >
                 <div className={cn(
                    "flex h-4 w-4 items-center justify-center rounded-sm border transition-all",
                    allSelected
                      ? "bg-primary border-primary text-primary-foreground"
                      : "border-muted-foreground/50 hover:border-primary/50"
                  )}>
                    {allSelected && <Check className="h-3 w-3" />}
                  </div>
                  <span className="flex-1">{allSelected ? 'Deselect All' : 'Select All'}</span>
              </CommandItem>
              <CommandSeparator />
              {options.map((option) => (
                <CommandItem
                  key={option.value}
                  value={option.value}
                  onSelect={toggleOption}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                  }}
                  className="flex items-center gap-2 px-2 py-1.5 hover:bg-accent/10 cursor-pointer"
                >
                  <div className={cn(
                    "flex h-4 w-4 items-center justify-center rounded-sm border transition-all",
                    selected.includes(option.value)
                      ? "bg-primary border-primary text-primary-foreground"
                      : "border-muted-foreground/50 hover:border-primary/50"
                  )}>
                    {selected.includes(option.value) && (
                      <Check className="h-3 w-3" />
                    )}
                  </div>
                  <span className="flex-1">{option.label}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
