import React from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

interface DayPickerProps {
  selectedDays: number[];
  onSelect: (days: number[]) => void;
  disabled?: boolean;
  maxDays?: number; // Maximum day number (default: 31)
}

export function DayPicker({ selectedDays = [], onSelect, disabled = false, maxDays = 31 }: DayPickerProps) {
  const handleDayClick = (day: number) => {
    if (disabled) return;

    const isSelected = selectedDays.includes(day);
    const newSelection = isSelected
      ? selectedDays.filter(d => d !== day)
      : [...selectedDays, day].sort((a, b) => a - b);

    onSelect(newSelection);
  };

  const handleSelectAll = () => {
    if (disabled) return;
    if (selectedDays.length === maxDays) {
      onSelect([]);
    } else {
      onSelect(Array.from({ length: maxDays }, (_, i) => i + 1));
    }
  };

  const days = Array.from({ length: maxDays }, (_, i) => i + 1);

  return (
    <div className="p-3">
      {/* Header */}
      <div className="flex items-center justify-between mb-3 pb-2 border-b">
        <h3 className="text-sm font-semibold">Select Days</h3>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={handleSelectAll}
          disabled={disabled}
          className="h-7 text-xs"
        >
          {selectedDays.length === maxDays ? 'Clear All' : 'Select All'}
        </Button>
      </div>

      {/* Day Grid */}
      <div className="grid grid-cols-7 gap-1">
        {days.map((day) => {
          const isSelected = selectedDays.includes(day);
          return (
            <Button
              key={day}
              type="button"
              variant="outline"
              size="sm"
              onClick={() => handleDayClick(day)}
              disabled={disabled}
              className={cn(
                'h-9 w-9 p-0 font-normal text-xs',
                isSelected && 'bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground',
                !isSelected && 'hover:bg-accent'
              )}
            >
              {day}
            </Button>
          );
        })}
      </div>

      {/* Selected Days Summary */}
      {selectedDays.length > 0 && (
        <div className="mt-3 pt-2 border-t">
          <p className="text-xs text-muted-foreground">
            Selected: {selectedDays.join(', ')}
          </p>
        </div>
      )}
    </div>
  );
}
