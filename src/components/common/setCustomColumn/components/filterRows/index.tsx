import React from 'react';
import { Plus, Trash2, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { CustomFilter } from '@/types/customColumn';

interface FilterRowProps {
  index: number;
  filter: CustomFilter;
  onUpdate: (filter: CustomFilter) => void;
  onAdd: () => void;
  onRemove: () => void;
  availableFields: string[];
  conditions: { value: string; label: string }[];
  showDeleteButton: boolean;
}

export const FilterRow: React.FC<FilterRowProps> = ({
  index,
  filter,
  onUpdate,
  onAdd,
  onRemove,
  availableFields,
  conditions,
  showDeleteButton
}) => {
  return (
    <TooltipProvider>
      <div className="flex items-center gap-2 p-2 rounded-md dark:bg-gray-800">
        {/* Field Section */}
        {index === 0 && (
          <div className="flex items-center gap-1 min-w-0" style={{ flex: '0 0 200px' }}>
            <Tooltip>
              <TooltipTrigger asChild>
                <div>
                  <Checkbox
                    checked={filter.text_sf_box}
                    onCheckedChange={(checked) => onUpdate({
                      ...filter,
                      text_sf_box: !!checked,
                      selected_field: checked ? '' : filter.selected_field
                    })}
                    className="border-blue-300 data-[state=checked]:bg-blue-600 data-[state=checked]:border-blue-600 dark:border-blue-600 dark:data-[state=checked]:bg-slate-600 dark:data-[state=checked]:border-slate-600"
                  />
                </div>
              </TooltipTrigger>
              <TooltipContent>
                <p>Manual Input</p>
              </TooltipContent>
            </Tooltip>
            
            {filter.text_sf_box ? (
              <Input
                placeholder="Enter field..."
                value={filter.selected_field}
                onChange={(e) => onUpdate({ ...filter, selected_field: e.target.value })}
                className="border p-3 py-3 w-full rounded-md focus:outline-none focus:border-blue-500 focus:ring-blue-500 h-9 text-xs dark:data-[state=checked]:bg-slate-600 dark:data-[state=checked]:border-slate-600"
              />
            ) : (
              <Select
                value={filter.selected_field}
                onValueChange={(value) => onUpdate({ ...filter, selected_field: value })}
              >
                <SelectTrigger className="focus:border-blue-500 focus:ring-blue-500 h-7 text-xs w-full">
                  <SelectValue placeholder="Select Field" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none" className="text-xs">Select Field</SelectItem>
                  {availableFields.map((field) => (
                    <SelectItem key={field} value={field} className="text-xs">
                      {field}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
        )}
        {/* Condition Section */}
        <div className="min-w-0" style={{ flex: '0 0 120px' }}>
          <Select
            value={filter.operation || ''}
            onValueChange={(value) => onUpdate({ ...filter, operation: value })}
          >
            <SelectTrigger className="h-7 text-xs w-full">
              <SelectValue placeholder="Condition" />
            </SelectTrigger>
            <SelectContent>
              {conditions.map((condition) => (
                <SelectItem key={condition.value} value={condition.value} className="text-xs">
                  {condition.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Value Section */}
        <div className="flex items-center gap-1 min-w-0" style={{ flex: '0 0 250px' }}>
          <Tooltip>
            <TooltipTrigger asChild>
              <div>
                <Checkbox
                  checked={filter.text_slf_box}
                  onCheckedChange={(checked) => onUpdate({
                    ...filter,
                    text_slf_box: !!checked,
                    selected_last_field: checked ? '' : filter.selected_last_field
                  })}
                  className="border-green-300 data-[state=checked]:bg-green-600 data-[state=checked]:border-green-600"
                />
              </div>
            </TooltipTrigger>
            <TooltipContent>
              <p>Manual Input</p>
            </TooltipContent>
          </Tooltip>

          {filter.text_slf_box ? (
            <div className="relative flex-1">
              <Input
                type="number"
                placeholder="Enter value..."
                value={filter.selected_last_field}
                onChange={(e) => onUpdate({ ...filter, selected_last_field: e.target.value })}
                className="border p-3 py-3 rounded-md focus:outline-none h-9 text-xs w-full"
              />
              {filter.operation === '* (Multiply)' && filter.selected_last_field && (
                <div className="absolute right-1 top-1/2 transform -translate-y-1/2">
                  <Check className="w-3 h-3 text-green-500" />
                </div>
              )}
            </div>
          ) : (
            <Select
              value={filter.selected_last_field}
              onValueChange={(value) => onUpdate({ ...filter, selected_last_field: value })}
            >
              <SelectTrigger className="h-7 text-xs w-full">
                <SelectValue placeholder="Select Value" />
              </SelectTrigger>
              <SelectContent>
                {availableFields.map((field) => (
                  <SelectItem key={field} value={field} className="text-xs">
                    {field}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-1" style={{ flex: '0 0 auto' }}>
          <Button
            variant="ghost"
            size="iconMd"
            onClick={onAdd}
            className="h-6 w-6 p-0 text-blue-500 hover:text-blue-700"
          >
            <Plus className="w-3 h-3" />
          </Button>
          
          {showDeleteButton && (
            <Button
              variant="ghost"
              size="iconMd"
              onClick={onRemove}
              className="h-6 w-6 p-0 text-red-500 hover:text-red-700"
            >
              <Trash2 className="w-3 h-3" />
            </Button>
          )}
        </div>
      </div>
    </TooltipProvider>
  );
};
