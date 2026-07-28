import React, { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface ConditionalFiltersProps {
  name: string;
  condition: string;
  value: string;
  onNameChange: (value: string) => void;
  onConditionChange: (value: string) => void;
  onValueChange: (value: string) => void;
}

const ConditionalFilters: React.FC<ConditionalFiltersProps> = ({
  name,
  condition,
  value,
  onNameChange,
  onConditionChange,
  onValueChange,
}) => {
  const [operator, setOperator] = useState('');

  return (
    <div className="space-y-4">
      <div className="bg-green-50 border border-green-200 rounded-lg p-3">
        <h3 className="font-semibold text-green-900 mb-1 text-sm">Conditional Filters</h3>
        <p className="text-green-700 text-xs">Apply filters based on dynamic conditions and criteria</p>
      </div>
      
      <div className="space-y-3">
        <div className="space-y-1">
          <Label htmlFor="filter-name" className="text-sm">Filter Name</Label>
          <Input
            id="filter-name"
            placeholder="Enter filter name"
            value={name}
            onChange={(e) => onNameChange(e.target.value)}
            className="h-8 text-xs"
          />
        </div>
        
        <div className="grid sm:grid-cols-3 gap-3">
          <div className="space-y-1">
            <Label htmlFor="filter-field" className="text-sm">Field</Label>
            <Select value={condition} onValueChange={onConditionChange}>
              <SelectTrigger className="h-8 text-xs">
                <SelectValue placeholder="Select field" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="name">Name</SelectItem>
                <SelectItem value="email">Email</SelectItem>
                <SelectItem value="status">Status</SelectItem>
                <SelectItem value="date">Date</SelectItem>
                <SelectItem value="category">Category</SelectItem>
                <SelectItem value="priority">Priority</SelectItem>
                <SelectItem value="amount">Amount</SelectItem>
                <SelectItem value="location">Location</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label htmlFor="filter-operator" className="text-sm">Operator</Label>
            <Select value={operator} onValueChange={setOperator}>
              <SelectTrigger className="h-8 text-xs">
                <SelectValue placeholder="Select operator" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="equals">Equals</SelectItem>
                <SelectItem value="not_equals">Not Equals</SelectItem>
                <SelectItem value="contains">Contains</SelectItem>
                <SelectItem value="not_contains">Does Not Contain</SelectItem>
                <SelectItem value="starts_with">Starts With</SelectItem>
                <SelectItem value="ends_with">Ends With</SelectItem>
                <SelectItem value="greater">Greater Than</SelectItem>
                <SelectItem value="greater_equal">Greater Than or Equal</SelectItem>
                <SelectItem value="less">Less Than</SelectItem>
                <SelectItem value="less_equal">Less Than or Equal</SelectItem>
                <SelectItem value="is_empty">Is Empty</SelectItem>
                <SelectItem value="is_not_empty">Is Not Empty</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label htmlFor="filter-value" className="text-sm">Value</Label>
            <Input
              id="filter-value"
              placeholder="Enter value"
              value={value}
              onChange={(e) => onValueChange(e.target.value)}
              disabled={operator === 'is_empty' || operator === 'is_not_empty'}
              className="h-8 text-xs"
            />
          </div>
        </div>
        
        {condition && operator && (
          <div className="bg-slate-50 border border-slate-200 rounded-lg p-2">
            <p className="text-xs text-slate-600">
              <strong>Filter Preview:</strong> Show records where {condition} {operator.replace('_', ' ')} 
              {(operator !== 'is_empty' && operator !== 'is_not_empty') ? ` '${value || '...'}'` : ''}
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default ConditionalFilters;
