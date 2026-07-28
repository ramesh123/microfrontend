import React from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface SetNewColumnProps {
  name: string;
  condition: string;
  value: string;
  onNameChange: (value: string) => void;
  onConditionChange: (value: string) => void;
  onValueChange: (value: string) => void;
}

const SetNewColumn: React.FC<SetNewColumnProps> = ({
  name,
  condition,
  value,
  onNameChange,
  onConditionChange,
  onValueChange,
}) => {
  return (
    <div className="space-y-4">
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
        <h3 className="font-semibold text-blue-900 mb-1 text-sm">Set New Column</h3>
        <p className="text-blue-700 text-xs">Create a new column with custom data or calculations</p>
      </div>
      
      <div className="grid sm:grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label htmlFor="column-name" className="text-sm">Column Name</Label>
          <Input
            id="column-name"
            placeholder="Enter column name"
            value={name}
            onChange={(e) => onNameChange(e.target.value)}
            className="p-2 w-72 text-xs border rounded-md light:border-slate-600 dark:border-slate-400"
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="data-type" className="text-sm">Data Type</Label>
          <Select value={condition} onValueChange={onConditionChange}>
            <SelectTrigger className="h-8 text-xs w-72">
              <SelectValue placeholder="Select data type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Select data type" disabled>Select data type</SelectItem>
              <SelectItem value="text">Text</SelectItem>
              <SelectItem value="number">Number</SelectItem>
              <SelectItem value="date">Date</SelectItem>
              <SelectItem value="boolean">Boolean</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      
      <div className="space-y-1">
        <Label htmlFor="default-value" className="text-sm">Default Value</Label>
        <Input
          id="default-value"
          placeholder="Enter default value"
          value={value}
          onChange={(e) => onValueChange(e.target.value)}
          className="p-2 w-72 text-xs border rounded-md light:border-slate-600 dark:border-slate-400"
        />
      </div>
    </div>
  );
};

export default SetNewColumn;
