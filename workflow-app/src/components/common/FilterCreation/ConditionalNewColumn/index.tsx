import React, { useState, useEffect, useRef } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Trash2 } from 'lucide-react';

interface ConditionalNewColumnProps {
  name: string;
  condition: string;
  value: string;
  onNameChange: (value: string) => void;
  onConditionChange: (value: string) => void;
  onValueChange: (value: string) => void;
  isEditing?: boolean;
}

interface ConditionRow {
  id: string;
  field: string;
  operator: string;
  value: string;
  logicOperator: string;
}

const ConditionalNewColumn: React.FC<ConditionalNewColumnProps> = ({
  name,
  condition,
  value,
  onNameChange,
  onConditionChange,
  onValueChange,
  isEditing = false,
}) => {
  const [conditions, setConditions] = useState<ConditionRow[]>([
    {
      id: '1',
      field: '',
      operator: '',
      value: '',
      logicOperator: 'AND'
    }
  ]);
  const [newColumnName, setNewColumnName] = useState('');
  const [newColumnValue, setNewColumnValue] = useState('');
  
  const hasLoadedEditData = useRef(false);
  const previousIsEditing = useRef(isEditing);

  useEffect(() => {
    const switchingToEditMode = !previousIsEditing.current && isEditing;
    
    if (isEditing && (switchingToEditMode || !hasLoadedEditData.current)) {
      setNewColumnName(name);
      setNewColumnValue(value);
      hasLoadedEditData.current = true;
      
      if (condition) {
        try {
          const conditionParts = condition.split(/ (AND|OR) /);
          if (conditionParts.length > 0) {
            const parsedConditions: ConditionRow[] = [];
            
            for (let i = 0; i < conditionParts.length; i += 2) {
              const part = conditionParts[i];
              const nextLogicOp = conditionParts[i + 1] || 'AND';
              
              const words = part.trim().split(' ');
              if (words.length >= 3) {
                parsedConditions.push({
                  id: (i / 2 + 1).toString(),
                  field: words[0],
                  operator: words[1],
                  value: words.slice(2).join(' '),
                  logicOperator: nextLogicOp
                });
              }
            }
            
            if (parsedConditions.length > 0) {
              setConditions(parsedConditions);
            }
          }
        } catch (error) {
          console.warn('Failed to parse condition:', error);
        }
      }
    } else if (!isEditing && previousIsEditing.current) {
      setConditions([{
        id: '1',
        field: '',
        operator: '',
        value: '',
        logicOperator: 'AND'
      }]);
      setNewColumnName('');
      setNewColumnValue('');
      hasLoadedEditData.current = false;
    }
    
    previousIsEditing.current = isEditing;
  }, [isEditing, name, condition, value]);

  // Update parent component whenever internal state changes
  useEffect(() => {
    onNameChange(newColumnName);
    
    const validConditions = conditions.filter(c => c.field && c.operator);
    const conditionsString = validConditions
      .map((c, index) => {
        const part = `${c.field} ${c.operator} ${c.value}`;
        if (index < validConditions.length - 1) {
          return `${part} ${c.logicOperator}`;
        }
        return part;
      })
      .join(' ');

    onConditionChange(conditionsString);
    onValueChange(newColumnValue);
  }, [newColumnName, newColumnValue, conditions]);

  const addCondition = () => {
    const newCondition: ConditionRow = {
      id: Date.now().toString(),
      field: '',
      operator: '',
      value: '',
      logicOperator: 'AND'
    };
    setConditions([...conditions, newCondition]);
  };

  const removeCondition = (id: string) => {
    if (conditions.length > 1) {
      setConditions(conditions.filter(condition => condition.id !== id));
    }
  };

  const updateCondition = (id: string, field: keyof ConditionRow, value: string) => {
    setConditions(conditions.map(condition => 
      condition.id === id ? { ...condition, [field]: value } : condition
    ));
  };

  const handleNewColumnNameChange = (value: string) => {
    setNewColumnName(value);
  };

  const handleNewColumnValueChange = (value: string) => {
    setNewColumnValue(value);
  };

  return (
    <div className="space-y-4">
      <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
        <h3 className="font-semibold text-amber-900 mb-1 text-sm">Conditional New Column</h3>
        <p className="text-amber-700 text-xs">Create a column with values based on specific conditions</p>
      </div>
      
      <div className="space-y-2">
        {conditions.map((condition, index) => (
          <div key={condition.id} className="space-y-1">
            <div className="flex items-end gap-1">
              <div className="flex w-44 min-w-0">
                <Select 
                  value={condition.field} 
                  onValueChange={(value) => updateCondition(condition.id, 'field', value)}
                >
                  <SelectTrigger className="bg-white h-8 text-xs w-48">
                    <SelectValue placeholder="Msg Type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="msg_type">Msg Type</SelectItem>
                    <SelectItem value="status">Status</SelectItem>
                    <SelectItem value="category">Category</SelectItem>
                    <SelectItem value="priority">Priority</SelectItem>
                    <SelectItem value="user_role">User Role</SelectItem>
                    <SelectItem value="department">Department</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex w-44 min-w-0">
                <Select 
                  value={condition.operator} 
                  onValueChange={(value) => updateCondition(condition.id, 'operator', value)}
                >
                  <SelectTrigger className="bg-white h-8 text-xs w-48">
                    <SelectValue placeholder="Select Condition" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="startsWith">startsWith</SelectItem>
                    <SelectItem value="endsWith">endsWith</SelectItem>
                    <SelectItem value="contains">contains</SelectItem>
                    <SelectItem value="equals">equals</SelectItem>
                    <SelectItem value="notEquals">notEquals</SelectItem>
                    <SelectItem value="greaterThan">greaterThan</SelectItem>
                    <SelectItem value="lessThan">lessThan</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex w-44 min-w-0">
                <Input
                  placeholder="string value"
                  value={condition.value}
                  onChange={(e) => updateCondition(condition.id, 'value', e.target.value)}
                  className="border dark:bg-slate-900 p-2 w-44 rounded-md text-xs"
                />
              </div>

              <div className="w-24">
                {index < conditions.length - 1 && (
                  <Select 
                    value={condition.logicOperator} 
                    onValueChange={(value) => updateCondition(condition.id, 'logicOperator', value)}
                  >
                    <SelectTrigger className="bg-white h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="AND">AND</SelectItem>
                      <SelectItem value="OR">OR</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              </div>

              <div className="flex w-24 gap-1 shrink-0 my-auto">
                <Button
                  type="button"
                  size="iconMd"
                  variant="outline"
                  onClick={addCondition}
                  title="Add Condition"
                >
                  <Plus className="h-3 w-3" />
                </Button>
                {conditions.length > 1 && (
                  <Button
                    type="button"
                    size="iconMd"
                    variant="outline"
                    onClick={() => removeCondition(condition.id)}
                    title="Remove Condition"
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="space-y-1">
          <Label htmlFor="new-column" className="text-sm font-medium text-slate-700 dark:text-slate-200">
            New Column :
          </Label>
          <Input
            id="new-column"
            placeholder="Enter column name"
            value={newColumnName}
            onChange={(e) => handleNewColumnNameChange(e.target.value)}
            className="p-2 w-48 rounded-md border dark:border-slate-600 text-xs"
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="column-value" className="text-sm font-medium text-slate-700 dark:text-slate-200">
            Value :
          </Label>
          <Input
            id="column-value"
            placeholder="Enter value"
            value={newColumnValue}
            onChange={(e) => handleNewColumnValueChange(e.target.value)}
            className="p-2 w-48 rounded-md border dark:border-slate-600 text-xs"
          />
        </div>
      </div>

      {conditions.some(c => c.field && c.operator) && (
        <div className="bg-slate-50 border border-slate-200 rounded-lg p-3">
          <h4 className="font-medium text-slate-800 mb-1 text-sm">Condition Preview:</h4>
          <p className="text-xs text-slate-600 break-words">
            {conditions.map((condition, index) => (
              <span key={condition.id}>
                {condition.field && condition.operator && (
                  <>
                    <span className="font-medium">{condition.field}</span>
                    <span className="mx-1">{condition.operator}</span>
                    <span className="font-medium">'{condition.value || '...'}'</span>
                  </>
                )}
                {index < conditions.length - 1 && condition.field && condition.operator && (
                  <span className="mx-2 text-blue-600 font-medium">{condition.logicOperator}</span>
                )}
              </span>
            ))}
          </p>
          {newColumnName && (
            <p className="text-xs text-slate-600 mt-1">
              <span className="font-medium">Result:</span> Create column '{newColumnName}' with value '{newColumnValue || '...'}'
            </p>
          )}
        </div>
      )}
    </div>
  );
};

export default ConditionalNewColumn;
